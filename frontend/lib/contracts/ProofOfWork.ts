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

function buildClient(address?: string | null, studioUrl?: string) {
  const rpcUrl = studioUrl || "https://studio.genlayer.com/api";
  const chain = {
    ...studionet,
    rpcUrls: {
      default: {
        http: [rpcUrl],
      },
    },
  };
  const config: any = { chain, endpoint: rpcUrl };
  if (address) config.account = address as `0x${string}`;
  // Do not attach window.ethereum for reads. gen_call must hit the JSON-RPC
  // endpoint (or our same-origin proxy), not MetaMask.
  return createClient(config);
}

class ProofOfWork {
  private contractAddress: `0x${string}`;
  private client: any;
  private studioUrl?: string;

  constructor(
    contractAddress: string,
    address?: string | null,
    studioUrl?: string
  ) {
    this.contractAddress = contractAddress as `0x${string}`;
    this.studioUrl = studioUrl;
    this.client = buildClient(address, studioUrl);
  }

  updateAccount(address: string): void {
    this.client = buildClient(address, this.studioUrl);
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

  private async write(
    functionName: string,
    args: unknown[],
    value: bigint,
    retries = 80,
    interval = 5000
  ): Promise<TransactionReceipt> {
    const feePreset: FeePresetEstimate | undefined = await estimateWriteFeePreset(
      this.client,
      { address: this.contractAddress, functionName, args, value },
      "standard"
    );
    const fees = feePresetToTransactionFees(feePreset);
    const txHash = await this.client.writeContract({
      address: this.contractAddress,
      functionName,
      args,
      value,
      ...(fees ? { fees } : {}),
    });
    const receipt = await this.client.waitForTransactionReceipt({
      hash: txHash,
      status: TransactionStatus.ACCEPTED,
      retries,
      interval,
    });
    assertSuccessfulReceipt(receipt);
    return {
      ...(receipt as TransactionReceipt),
      hash: (receipt as any)?.hash || txHash,
      payload: extractJsonPayload(receipt),
    };
  }

  createBounty(title: string, spec: string, rewardWei: bigint, deadline: number) {
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
}

export default ProofOfWork;
