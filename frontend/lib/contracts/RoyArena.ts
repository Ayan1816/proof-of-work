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
    return Object.fromEntries(value.entries());
  }
  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

function asSubmission(id: string, value: unknown): Submission {
  const raw = asRecord(value);
  return {
    id,
    user: String(raw.user ?? ""),
    category: String(raw.category ?? ""),
    content: String(raw.content ?? ""),
    score: Number(raw.score ?? 0) || 0,
    feedback: String(raw.feedback ?? ""),
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

function extractJudgment(receipt: any): { score?: number; feedback?: string } {
  const blobs: string[] = [];
  const leader = receipt?.consensus_data?.leader_receipt;
  collectTextBlobs(leader, blobs);
  collectTextBlobs(receipt?.result, blobs);

  for (const blob of blobs) {
    const start = blob.indexOf("{");
    const end = blob.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      const parsed = JSON.parse(blob.slice(start, end + 1));
      const score = Number(parsed.score ?? parsed.score_out_of_10);
      const feedback = parsed.feedback != null ? String(parsed.feedback) : undefined;
      if (Number.isFinite(score) || feedback) {
        return {
          ...(Number.isFinite(score) ? { score } : {}),
          ...(feedback ? { feedback } : {}),
        };
      }
    } catch {
      // Keep scanning other blobs.
    }
  }
  return {};
}

function assertSuccessfulReceipt(receipt: any): void {
  const statusName = String(receipt?.statusName || "").toUpperCase();
  if (FAILED_TX_STATUSES.has(statusName)) {
    throw new Error(
      `The AI judge did not reach consensus (${statusName}). Your score was not saved. Please try again.`
    );
  }

  const execution = receipt?.txExecutionResultName;
  if (execution && execution !== ExecutionResult.FINISHED_WITH_RETURN) {
    const leader = receipt?.consensus_data?.leader_receipt;
    const rec = Array.isArray(leader) ? leader[0] : leader;
    const payload = rec?.result?.payload;
    const detail =
      typeof payload === "string"
        ? payload
        : rec?.error || rec?.execution_result || execution;
    throw new Error(`Contract execution failed: ${detail}`);
  }
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
      retries: 60,
      interval: 5000,
    });

    assertSuccessfulReceipt(receipt);

    return {
      ...(receipt as TransactionReceipt),
      hash: (receipt as any)?.hash || txHash,
      judgment: extractJudgment(receipt),
    };
  }
}

export default RoyArena;
