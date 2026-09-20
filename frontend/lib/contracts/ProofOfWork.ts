import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import type {
  Bounty,
  BountyStatus,
  Reputation,
  Submission,
  TransactionReceipt,
} from "./types";
import {
  estimateWriteFeePreset,
  feePresetToTransactionFees,
  type FeePresetEstimate,
} from "../genlayer/fees";
import {
  ensureGenLayerNetwork,
  getEthereumProvider,
} from "../genlayer/client";
import { formatGen } from "../format";
import { errorMessage } from "../utils/errorMessage";
import {
  ACTION_LABELS,
  isHistoryAction,
  type HistoryAction,
} from "../history/types";
import {
  createHistoryId,
  recordHistoryFailure,
  upsertHistoryItem,
} from "../history/store";
import {
  extractGasFeeWei,
  extractGasUsed,
  extractReceiptHash,
} from "../history/receipt";

const FAILED_TX_STATUSES = new Set([
  "UNDETERMINED",
  "CANCELED",
  "LEADER_TIMEOUT",
  "VALIDATORS_TIMEOUT",
]);

const COMMITTED_TX_STATUSES = new Set([
  "ACCEPTED",
  "FINALIZED",
  "READY_TO_FINALIZE",
]);

const FAILED_TX_RESULTS = new Set([
  "MAJORITY_DISAGREE",
  "NO_MAJORITY",
  "DETERMINISTIC_VIOLATION",
  "DISAGREE",
  "TIMEOUT",
  "FAILURE",
]);

const STATUS_BY_NUMBER: Record<string, string> = {
  "5": "ACCEPTED",
  "6": "UNDETERMINED",
  "7": "FINALIZED",
  "8": "CANCELED",
  "11": "READY_TO_FINALIZE",
  "12": "VALIDATORS_TIMEOUT",
  "13": "LEADER_TIMEOUT",
};

const BOUNTY_STATUSES = new Set<BountyStatus>([
  "Open",
  "InReview",
  "Approved",
  "Rejected",
  "Paid",
  "Appealed",
  "Refunded",
]);

function asRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }
  if (Array.isArray(value)) {
    const pairs =
      value.length > 0 &&
      value.every(
        (item) => Array.isArray(item) && item.length === 2
      );
    if (pairs) {
      return Object.fromEntries(
        (value as Array<[string, unknown]>).map(([k, v]) => [String(k), v])
      );
    }
    return {};
  }
  if (typeof value === "object") return value as Record<string, unknown>;
  return {};
}

function asText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    if (typeof rec.as_hex === "string") return rec.as_hex;
  }
  return String(value);
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const text = asText(value).toLowerCase();
  return text === "true" || text === "1";
}

function asBounty(raw: unknown): Bounty | null {
  const rec = asRecord(raw);
  const id = asText(rec.id);
  const title = asText(rec.title);
  const statusText = asText(rec.status) as BountyStatus;
  if (!id && !title) return null;
  const status = BOUNTY_STATUSES.has(statusText) ? statusText : "Open";
  return {
    id,
    creator: asText(rec.creator),
    title,
    spec: asText(rec.spec),
    reward: BigInt(asText(rec.reward || 0) || "0"),
    deadline: Number(rec.deadline || 0),
    status,
    escrowLocked: asBool(rec.escrow_locked ?? rec.escrowLocked),
    submitter: asText(rec.submitter),
    submissionId: asText(rec.submission_id ?? rec.submissionId),
    verdictReasoning: asText(rec.verdict_reasoning ?? rec.verdictReasoning),
    appealCount: Number(rec.appeal_count ?? rec.appealCount ?? 0),
    lastApproved: asBool(rec.last_approved ?? rec.lastApproved),
  };
}

function asSubmission(raw: unknown): Submission | null {
  const rec = asRecord(raw);
  const id = asText(rec.id);
  if (!id && !asText(rec.proof_link ?? rec.proofLink)) return null;
  return {
    id,
    bountyId: asText(rec.bounty_id ?? rec.bountyId),
    submitter: asText(rec.submitter),
    proofLink: asText(rec.proof_link ?? rec.proofLink),
    description: asText(rec.description),
    timestamp: Number(rec.timestamp || 0),
  };
}

function collectTextBlobs(value: unknown, out: string[], depth = 0): void {
  if (depth > 8 || value == null) return;
  if (typeof value === "string") {
    if (value.trim()) out.push(value.trim());
    return;
  }
  if (typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectTextBlobs(nested, out, depth + 1);
    }
  }
}

function extractJsonPayload(receipt: any): Record<string, unknown> {
  const blobs: string[] = [];
  collectTextBlobs(receipt?.consensus_data?.leader_receipt, blobs);
  collectTextBlobs(receipt?.result, blobs);
  collectTextBlobs(receipt?.data, blobs);
  for (const blob of blobs) {
    const start = blob.indexOf("{");
    const end = blob.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      const parsed = JSON.parse(blob.slice(start, end + 1));
      if (
        parsed &&
        typeof parsed === "object" &&
        (parsed.id || parsed.status || parsed.approved)
      ) {
        return parsed;
      }
    } catch {
      // keep scanning
    }
  }
  return {};
}

function normalizeStatus(value: unknown): string {
  if (value == null || value === "") return "";
  if (STATUS_BY_NUMBER[String(value)]) return STATUS_BY_NUMBER[String(value)];
  return String(value).toUpperCase();
}

function readStatus(receipt: any): string {
  return normalizeStatus(
    receipt?.statusName || receipt?.status_name || receipt?.status
  );
}

function readExecution(receipt: any): string {
  const named =
    receipt?.txExecutionResultName ||
    receipt?.tx_execution_result_name ||
    receipt?.txExecutionResult;
  if (named != null && named !== "") return String(named).toUpperCase();
  const leader = receipt?.consensus_data?.leader_receipt;
  const rec = Array.isArray(leader) ? leader[0] : leader;
  const fromLeader = rec?.execution_result;
  if (!fromLeader) return "";
  const upper = String(fromLeader).toUpperCase();
  if (upper === "SUCCESS") return ExecutionResult.FINISHED_WITH_RETURN;
  if (upper === "ERROR") return ExecutionResult.FINISHED_WITH_ERROR;
  return upper;
}

function readResult(receipt: any): string {
  return String(receipt?.resultName || receipt?.result_name || "").toUpperCase();
}

function readableContractError(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const match = cleaned.match(/(?:UserError|Exception|Error):\s*(.+)$/i);
  if (match?.[1]) return match[1].trim();
  return cleaned;
}

function leaderErrorDetail(receipt: any, fallback: string): string {
  const leader = receipt?.consensus_data?.leader_receipt;
  const rec = Array.isArray(leader) ? leader[0] : leader;
  const payload = rec?.result?.payload ?? rec?.result;
  if (typeof payload === "string" && payload.trim()) {
    return readableContractError(payload);
  }
  if (payload && typeof payload === "object") {
    const readable = (payload as any).readable ?? (payload as any).payload;
    if (typeof readable === "string" && readable.trim()) {
      return readableContractError(readable);
    }
  }
  return fallback;
}

function assertSuccessfulReceipt(receipt: any): void {
  const statusName = readStatus(receipt);
  if (!statusName || FAILED_TX_STATUSES.has(statusName)) {
    throw new Error(
      `The network did not reach consensus (${statusName || "UNKNOWN"}). Please try again.`
    );
  }
  if (!COMMITTED_TX_STATUSES.has(statusName)) {
    throw new Error(`Transaction is not committed yet (${statusName}). Please try again.`);
  }
  const resultName = readResult(receipt);
  if (resultName && FAILED_TX_RESULTS.has(resultName)) {
    throw new Error(`Validators disagreed (${resultName}). Please try again.`);
  }
  const execution = readExecution(receipt);
  if (execution && execution !== ExecutionResult.FINISHED_WITH_RETURN) {
    throw new Error(`Contract execution failed: ${leaderErrorDetail(receipt, execution)}`);
  }
}

function cloneStudioChain(rpcUrl: string) {
  return {
    ...studionet,
    rpcUrls: {
      default: {
        http: [rpcUrl],
      },
    },
  };
}

function buildClient(
  address?: string | null,
  studioUrl?: string,
  forWrite = false
) {
  const rpcUrl = studioUrl || "https://studio.genlayer.com/api";
  const chain = cloneStudioChain(rpcUrl);
  const config: any = { chain, endpoint: rpcUrl };
  if (address) config.account = address as `0x${string}`;
  // Reads must NOT use the wallet provider: gen_call has to hit the JSON-RPC
  // proxy, not Rabby/MetaMask. Writes MUST pass the injected provider so
  // eth_sendTransaction is signed by the wallet the user actually connected.
  if (forWrite) {
    const provider = getEthereumProvider();
    if (!provider) {
      throw new Error(
        "Connect a browser wallet (Rabby or MetaMask) to send transactions."
      );
    }
    config.provider = provider;
  }
  return createClient(config);
}

class ProofOfWork {
  private contractAddress: `0x${string}`;
  private client: any;
  private studioUrl?: string;
  private account: string | null;

  constructor(
    contractAddress: string,
    address?: string | null,
    studioUrl?: string
  ) {
    this.contractAddress = contractAddress as `0x${string}`;
    this.studioUrl = studioUrl;
    this.account = address || null;
    this.client = buildClient(address, studioUrl, false);
  }

  updateAccount(address: string): void {
    this.account = address;
    this.client = buildClient(address, this.studioUrl, false);
  }

  private async read(functionName: string, args: unknown[] = []) {
    return this.client.readContract({
      address: this.contractAddress,
      functionName,
      args,
    });
  }

  async listBounties(): Promise<Bounty[]> {
    const raw = await this.read("list_bounties");
    const rows = Array.isArray(raw)
      ? raw
      : raw instanceof Map
        ? Array.from(raw.values())
        : Object.values(asRecord(raw));
    return rows
      .map((row) => {
        try {
          return asBounty(row);
        } catch (err) {
          console.warn("Skipping unreadable bounty row", err, row);
          return null;
        }
      })
      .filter((item): item is Bounty => Boolean(item))
      .sort((a, b) => Number(b.id) - Number(a.id));
  }

  async getBounty(id: string): Promise<Bounty> {
    const parsed = asBounty(await this.read("get_bounty", [id]));
    if (!parsed) throw new Error("Bounty not found.");
    return parsed;
  }

  async getSubmission(id: string): Promise<Submission | null> {
    if (!id) return null;
    try {
      return asSubmission(await this.read("get_submission", [id]));
    } catch {
      return null;
    }
  }

  async getReputation(address: string): Promise<Reputation> {
    const rec = asRecord(await this.read("get_reputation", [address]));
    return {
      approvedCount: Number(rec.approved_count ?? rec.approvedCount ?? 0),
      rejectedCount: Number(rec.rejected_count ?? rec.rejectedCount ?? 0),
    };
  }

  async getTotalEscrowed(): Promise<bigint> {
    const raw = await this.read("get_total_escrowed");
    return BigInt(asText(raw || 0) || "0");
  }

  async getBalance(address: string): Promise<bigint> {
    if (!address || typeof this.client.getBalance !== "function") return 0n;
    const raw = await this.client.getBalance({
      address: address as `0x${string}`,
    });
    return BigInt(raw ?? 0);
  }

  private async bountyReward(bountyId: string): Promise<bigint> {
    try {
      const bounty = await this.getBounty(bountyId);
      return bounty.reward;
    } catch {
      return 0n;
    }
  }

  private async write(
    functionName: string,
    args: unknown[],
    value: bigint,
    retries = 80,
    interval = 5000
  ): Promise<TransactionReceipt> {
    const action: HistoryAction | null = isHistoryAction(functionName)
      ? functionName
      : null;
    const historyId = createHistoryId();
    const wallet = this.account || "";
    const bountyIdArg =
      functionName === "create_bounty"
        ? ""
        : typeof args[0] === "string"
          ? args[0]
          : "";
    const titleArg =
      functionName === "create_bounty" && typeof args[0] === "string"
        ? args[0]
        : "";
    let amountWei = value;
    if (
      (functionName === "release_payment" || functionName === "refund") &&
      bountyIdArg
    ) {
      const locked = await this.bountyReward(bountyIdArg);
      if (locked > 0n) amountWei = locked;
    }
    if (action && wallet) {
      upsertHistoryItem(wallet, {
        id: historyId,
        action,
        label: ACTION_LABELS[action],
        status: "pending",
        amountWei: amountWei.toString(),
        bountyId: bountyIdArg,
        title: titleArg,
        timestamp: Date.now(),
        source: "wallet",
      });
    }

    let writeClient: any;
    try {
      await ensureGenLayerNetwork();
      writeClient = buildClient(this.account, this.studioUrl, true);
    } catch (err) {
      const message = errorMessage(err, "Could not prepare the wallet transaction.");
      if (action && wallet) {
        recordHistoryFailure(wallet, historyId, action, message);
      }
      throw new Error(message);
    }
    const feePreset: FeePresetEstimate | undefined = await estimateWriteFeePreset(
      writeClient,
      { address: this.contractAddress, functionName, args, value },
      "standard"
    );
    const fees = feePresetToTransactionFees(feePreset);
    let txHash: string;
    try {
      txHash = await writeClient.writeContract({
        address: this.contractAddress,
        functionName,
        args,
        value,
        ...(fees ? { fees } : {}),
      });
      if (action && wallet) {
        upsertHistoryItem(wallet, {
          id: historyId,
          action,
          hash: txHash,
          status: "pending",
        });
      }
    } catch (err) {
      const message = errorMessage(
        err,
        "Wallet rejected or could not send the transaction."
      );
      if (action && wallet) {
        recordHistoryFailure(wallet, historyId, action, message);
      }
      throw new Error(message);
    }
    try {
      const receipt = await writeClient.waitForTransactionReceipt({
        hash: txHash,
        status: TransactionStatus.ACCEPTED,
        retries,
        interval,
      });
      assertSuccessfulReceipt(receipt);
      const payload = extractJsonPayload(receipt);
      const gasUsed = extractGasUsed(receipt);
      if (action && wallet) {
        upsertHistoryItem(wallet, {
          id: historyId,
          action,
          status: "success",
          hash: extractReceiptHash(receipt, txHash),
          gasUsed,
          gasFeeWei: extractGasFeeWei(receipt, gasUsed),
          bountyId: String(payload.id || bountyIdArg || ""),
          title: titleArg,
        });
      }
      return {
        ...(receipt as TransactionReceipt),
        hash: (receipt as any)?.hash || txHash,
        payload,
      };
    } catch (err) {
      const message = errorMessage(err, "Transaction failed.");
      if (action && wallet) {
        recordHistoryFailure(wallet, historyId, action, message);
        upsertHistoryItem(wallet, {
          id: historyId,
          action,
          hash: txHash,
          status: "failed",
        });
      }
      throw err instanceof Error ? err : new Error(message);
    }
  }

  async createBounty(
    title: string,
    spec: string,
    rewardWei: bigint,
    deadline: number
  ) {
    if (this.account) {
      try {
        const balance = await this.getBalance(this.account);
        if (balance < rewardWei) {
          throw new Error(
            `Not enough GEN to lock this reward. Wallet has ${formatGen(balance)} GEN; bounty locks ${formatGen(rewardWei)} GEN. Keep a little extra for network fees.`
          );
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("Not enough GEN")) {
          throw err;
        }
        // If balance lookup fails, still attempt the write — the wallet will
        // surface a real funding error after we have switched networks.
      }
    }
    return this.write(
      "create_bounty",
      [title, spec, rewardWei, deadline],
      rewardWei
    );
  }

  submitWork(bountyId: string, proofLink: string, description: string) {
    return this.write("submit_work", [bountyId, proofLink, description], 0n);
  }

  judgeSubmission(bountyId: string) {
    return this.write("judge_submission", [bountyId], 0n, 180, 8000);
  }

  releasePayment(bountyId: string) {
    return this.write("release_payment", [bountyId], 0n);
  }

  appeal(bountyId: string) {
    return this.write("appeal", [bountyId], 0n);
  }

  refund(bountyId: string) {
    return this.write("refund", [bountyId], 0n);
  }
}

export default ProofOfWork;
