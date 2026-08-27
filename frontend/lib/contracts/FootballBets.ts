import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
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

class FootballBets {
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

    const config: any = {
      chain: studionet,
    };

    if (address) {
      config.account = address as `0x${string}`;
    }

    if (studioUrl) {
      config.endpoint = studioUrl;
    }

    this.client = createClient(config);
  }

  updateAccount(address: string): void {
    const config: any = {
      chain: studionet,
      account: address as `0x${string}`,
    };

    if (this.studioUrl) {
      config.endpoint = this.studioUrl;
    }

    this.client = createClient(config);
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
        .sort((a, b) => Number(b.id) - Number(a.id));
    } catch (error) {
      console.error("Error fetching submissions:", error);
      throw error;
    }
  }

  async getBets(): Promise<Submission[]> {
    return this.getSubmissions();
  }

  async getPlayerPoints(address: string | null): Promise<number> {
    if (!address) {
      return 0;
    }

    try {
      const submissions = await this.getSubmissions();
      return submissions
        .filter((item) => item.user.toLowerCase() === address.toLowerCase())
        .reduce((sum, item) => sum + item.score, 0);
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
      status: "ACCEPTED" as any,
      retries: 24,
      interval: 5000,
    });

    return receipt as TransactionReceipt;
  }
}

export default FootballBets;
