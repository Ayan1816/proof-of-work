import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import type {
  ArenaCategory,
  LeaderboardEntry,
  Submission,
  TransactionReceipt,
} from "./types";
import {
  estimateWriteFeePreset,
  feePresetToTransactionFees,
  type FeePresetEstimate,
  type FeePresetLevel,
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

function asRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      return asRecord(parsed);
    } catch {
      return {};
    }
  }
  if (Array.isArray(value)) {
    const pairEntries = value.every(
      (item) =>
        Array.isArray(item) &&
        item.length === 2 &&
        (typeof item[0] === "string" || typeof item[0] === "number")
    );
    if (pairEntries) {
      return Object.fromEntries(
        (value as Array<[string | number, unknown]>).map(([key, val]) => [
          String(key),
          val,
        ])
      );
    }
    return Object.fromEntries(value.map((item, index) => [String(index), item]));
  }
  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

function asText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.as_hex === "string") return record.as_hex;
    if (typeof record.asHex === "string") return record.asHex;
  }
  return String(value);
}

function asSubmission(id: string, value: unknown): Submission {
  const raw = asRecord(value);
  const nestedId = asText(raw.id).trim();
  return {
    id: nestedId || id,
    user: asText(raw.user ?? raw.author ?? ""),
    category: asText(raw.category ?? ""),
    content: asText(raw.content ?? ""),
    score: Number(raw.score ?? 0) || 0,
    feedback: asText(raw.feedback ?? ""),
  };
}

function collectTextBlobs(value: unknown, out: string[], depth = 0): void {
  if (depth > 6 || value == null) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) out.push(trimmed);
    return;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.readable === "string") out.push(record.readable);
    if (typeof record.payload === "string") out.push(record.payload);
    for (const nested of Object.values(record)) {
      collectTextBlobs(nested, out, depth + 1);
    }
  }
}

function extractJudgment(receipt: any): {
  id?: string;
  score?: number;
  feedback?: string;
  status?: string;
} {
  const blobs: string[] = [];
  const leader = receipt?.consensus_data?.leader_receipt;
  collectTextBlobs(leader, blobs);
  collectTextBlobs(receipt?.result, blobs);
  collectTextBlobs(receipt?.data, blobs);

  let best: { id?: string; score?: number; feedback?: string; status?: string } = {};
  for (const blob of blobs) {
    const start = blob.indexOf("{");
    const end = blob.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      const parsed = JSON.parse(blob.slice(start, end + 1));
      const score = Number(parsed.score ?? parsed.score_out_of_10);
      const feedback = parsed.feedback != null ? String(parsed.feedback) : undefined;
      const id = parsed.id != null ? String(parsed.id) : undefined;
      const status = parsed.status != null ? String(parsed.status) : undefined;
      const candidate = {
        ...(Number.isFinite(score) ? { score } : {}),
        ...(feedback ? { feedback } : {}),
        ...(id ? { id } : {}),
        ...(status ? { status } : {}),
      };
      if (candidate.id || candidate.status === "Success") {
        return candidate;
      }
      if ((candidate.score != null || candidate.feedback) && !best.score && !best.feedback) {
        best = candidate;
      }
    } catch {
      // Keep scanning other blobs.
    }
  }
  return best;
}

function normalizeStatus(value: unknown): string {
  if (value == null || value === "") return "";
  const raw = String(value).toUpperCase();
  if (STATUS_BY_NUMBER[String(value)]) {
    return STATUS_BY_NUMBER[String(value)];
  }
  return raw;
}

function readStatus(receipt: any): string {
  return normalizeStatus(
    receipt?.statusName || receipt?.status_name || receipt?.status
  );
}

function readExecution(receipt: any): string {
  const named =
    receipt?.txExecutionResultName || receipt?.tx_execution_result_name;
  if (named) return String(named).toUpperCase();

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
  return String(
    receipt?.resultName || receipt?.result_name || ""
  ).toUpperCase();
}

function leaderErrorDetail(receipt: any, fallback: string): string {
  const leader = receipt?.consensus_data?.leader_receipt;
  const rec = Array.isArray(leader) ? leader[0] : leader;
  const payload = rec?.result?.payload ?? rec?.result;
  if (typeof payload === "string" && payload.trim()) return payload;
  if (typeof rec?.error === "string" && rec.error.trim()) return rec.error;
  if (typeof rec?.execution_result === "string") return rec.execution_result;
  return fallback;
}

function assertSuccessfulReceipt(receipt: any): void {
  const statusName = readStatus(receipt);
  if (!statusName || FAILED_TX_STATUSES.has(statusName)) {
    throw new Error(
      `The AI judge did not reach consensus (${statusName || "UNKNOWN"}). Your score was not saved. Please try again.`
    );
  }
  if (!COMMITTED_TX_STATUSES.has(statusName)) {
    throw new Error(
      `Submission is not committed yet (${statusName}). Your score was not saved. Please try again.`
    );
  }

  const resultName = readResult(receipt);
  if (resultName && FAILED_TX_RESULTS.has(resultName)) {
    throw new Error(
      `Validators disagreed on this judgment (${resultName}). Your score was not saved. Please try again.`
    );
  }

  const execution = readExecution(receipt);
  if (execution && execution !== ExecutionResult.FINISHED_WITH_RETURN) {
    throw new Error(
      `Contract execution failed: ${leaderErrorDetail(receipt, execution)}`
    );
  }
}

function boardHasId(board: Record<string, unknown>, id: string): boolean {
  if (Object.prototype.hasOwnProperty.call(board, id)) return true;
  return Object.keys(board).some((key) => String(key) === String(id));
}

function buildClient(address?: string | null, studioUrl?: string) {
  const config: any = {
    chain: studionet,
  };

  if (address) {
    config.account = address as `0x${string}`;
  }

  if (studioUrl) {
    config.endpoint = studioUrl;
  }

  if (typeof window !== "undefined" && (window as any).ethereum) {
    config.provider = (window as any).ethereum;
  }

  return createClient(config);
}

class RoyArena {
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

  private async readLeaderboardRaw(): Promise<Record<string, unknown>> {
    const raw = await this.client.readContract({
      address: this.contractAddress,
      functionName: "get_leaderboard",
      args: [],
    });
    return asRecord(raw);
  }

  async getSubmissions(): Promise<Submission[]> {
    try {
      const board = await this.readLeaderboardRaw();
      return Object.entries(board)
        .map(([id, value]) => asSubmission(id, value))
        .filter((item) => item.user || item.content)
        .sort((a, b) => Number(b.id) - Number(a.id));
    } catch (error) {
      console.error("Error fetching submissions:", error);
      throw error;
    }
  }

  async getPlayerPoints(address: string | null): Promise<number> {
    if (!address) {
      return 0;
    }

    try {
      const points = await this.client.readContract({
        address: this.contractAddress,
        functionName: "get_player_points",
        args: [address],
      });
      const numeric = Number(points);
      return Number.isFinite(numeric) ? numeric : 0;
    } catch (error) {
      console.error("Error fetching player points:", error);
      return 0;
    }
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      const submissions = await this.getSubmissions();
      const totals = new Map<string, number>();

      for (const item of submissions) {
        const key = item.user || "unknown";
        totals.set(key, (totals.get(key) || 0) + item.score);
      }

      return Array.from(totals.entries())
        .map(([address, points]) => ({ address, points }))
        .sort((a, b) => b.points - a.points);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      throw error;
    }
  }

  async estimateSubmitFees(
    userAddr: string,
    category: ArenaCategory,
    content: string,
    level: FeePresetLevel = "standard"
  ): Promise<FeePresetEstimate | undefined> {
    return estimateWriteFeePreset(
      this.client,
      {
        address: this.contractAddress,
        functionName: "submit_and_judge",
        args: [userAddr, category, content],
      },
      level
    );
  }

  async submitEntry(
    userAddr: string,
    category: ArenaCategory,
    content: string,
    feePreset?: FeePresetEstimate
  ): Promise<TransactionReceipt> {
    const fees = feePresetToTransactionFees(feePreset);
    const txHash = await this.client.writeContract({
      address: this.contractAddress,
      functionName: "submit_and_judge",
      args: [userAddr, category, content],
      value: BigInt(0),
      ...(fees ? { fees } : {}),
    });

    const receipt = await this.client.waitForTransactionReceipt({
      hash: txHash,
      status: TransactionStatus.ACCEPTED,
      retries: 80,
      interval: 5000,
    });

    assertSuccessfulReceipt(receipt);

    const judgment = extractJudgment(receipt);
    if (judgment.id) {
      let board = await this.readLeaderboardRaw();
      if (!boardHasId(board, judgment.id)) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        board = await this.readLeaderboardRaw();
      }
      if (!boardHasId(board, judgment.id)) {
        throw new Error(
          "The AI judge scored your entry, but validators did not commit it to the arena. Please try again."
        );
      }
    }

    return {
      ...(receipt as TransactionReceipt),
      hash: (receipt as any)?.hash || txHash,
      judgment,
    };
  }
}

export default RoyArena;
