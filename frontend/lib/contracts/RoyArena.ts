import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import type {
  ArenaCategory,
  LeaderboardEntry,
  ProjectionInput,
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
    const pairEntries =
      value.length > 0 &&
      value.every(
        (item) =>
          Array.isArray(item) &&
          item.length === 2 &&
          (typeof item[0] === "string" || typeof item[0] === "number")
      );
    if (pairEntries) {
      const second = asRecord(value[0][1]);
      if (second.user || second.content || second.category || second.id) {
        return Object.fromEntries(
          (value as Array<[string | number, unknown]>).map(([key, val]) => [
            String(key),
            val,
          ])
        );
      }
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

function asSubmission(id: string, value: unknown, index = 0): Submission {
  const raw = asRecord(value);
  const nestedId = asText(raw.id).trim();
  const fallback = id && id !== "undefined" && id !== "null" ? id : "";
  const reality = asText(raw.reality_outcome ?? raw.realityOutcome ?? "unresolved");
  const resolvedRaw = raw.resolved;
  const resolved =
    resolvedRaw === true ||
    resolvedRaw === 1 ||
    String(resolvedRaw).toLowerCase() === "true";
  return {
    id: nestedId || fallback || `row-${index}`,
    user: asText(raw.user ?? raw.author ?? ""),
    category: asText(raw.category ?? ""),
    content: asText(raw.content ?? ""),
    score: Number(raw.score ?? 0) || 0,
    feedback: asText(raw.feedback ?? ""),
    claim: asText(raw.claim ?? ""),
    deadline: asText(raw.deadline ?? ""),
    evidence_url: asText(raw.evidence_url ?? raw.evidenceUrl ?? ""),
    resolved,
    reality_outcome: reality || "unresolved",
    reality_note: asText(raw.reality_note ?? raw.realityNote ?? ""),
  };
}

function looksLikeSubmission(value: unknown): boolean {
  if (value == null || typeof value !== "object") return false;
  const raw = asRecord(value);
  return Boolean(raw.user || raw.author || raw.content || raw.category);
}

function collectSubmissions(raw: unknown): Submission[] {
  if (raw == null || raw === "") return [];
  if (typeof raw === "string") {
    try {
      return collectSubmissions(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (raw instanceof Map) {
    return Array.from(raw.entries()).map(([id, value], index) =>
      asSubmission(String(id), value, index)
    );
  }
  if (Array.isArray(raw)) {
    if (
      raw.length > 0 &&
      raw.every(
        (item) =>
          Array.isArray(item) &&
          item.length === 2 &&
          (typeof item[0] === "string" || typeof item[0] === "number") &&
          looksLikeSubmission(item[1])
      )
    ) {
      return (raw as Array<[string | number, unknown]>).map(([id, value], index) =>
        asSubmission(String(id), value, index)
      );
    }
    return raw
      .map((item, index) => asSubmission(String(index + 1), item, index))
      .filter((item) => item.user || item.content);
  }
  if (typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, value]) => looksLikeSubmission(value) || typeof value === "object")
      .map(([id, value], index) => asSubmission(id, value, index));
  }
  return [];
}

function submissionSortId(id: string): number {
  const digits = String(id).match(/\d+/);
  if (!digits) return 0;
  return Number(digits[0]) || 0;
}

function sameWallet(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
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
  collectTextBlobs(receipt?.return_value, blobs);
  collectTextBlobs(receipt?.returnValue, blobs);

  let committed: { id?: string; score?: number; feedback?: string; status?: string } = {};
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
      if (candidate.status === "Success" && candidate.id) {
        return candidate;
      }
      if (candidate.id || candidate.status === "Success") {
        committed = { ...committed, ...candidate };
      }
      if (candidate.score != null || candidate.feedback) {
        best = { ...best, ...candidate };
      }
    } catch {
      // Keep scanning other blobs.
    }
  }
  if (committed.id || committed.status === "Success") {
    return { ...best, ...committed };
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

const EXECUTION_BY_NUMBER: Record<string, string> = {
  "1": ExecutionResult.FINISHED_WITH_RETURN,
  "2": ExecutionResult.FINISHED_WITH_ERROR,
};

function readExecution(receipt: any): string {
  const named =
    receipt?.txExecutionResultName ||
    receipt?.tx_execution_result_name ||
    receipt?.txExecutionResult ||
    receipt?.tx_execution_result;
  if (named != null && named !== "") {
    const asNum = EXECUTION_BY_NUMBER[String(named)];
    if (asNum) return asNum;
    return String(named).toUpperCase();
  }

  const leader = receipt?.consensus_data?.leader_receipt;
  const rec = Array.isArray(leader) ? leader[0] : leader;
  const fromLeader = rec?.execution_result;
  if (fromLeader == null || fromLeader === "") return "";
  const asNum = EXECUTION_BY_NUMBER[String(fromLeader)];
  if (asNum) return asNum;
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

function readableContractError(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const match = cleaned.match(
    /(?:UserError|Exception|Error):\s*(.+)$/i
  );
  if (match?.[1]) return match[1].trim();
  if (
    /too short|invalid category|rejected by AI|failed to parse/i.test(cleaned)
  ) {
    return cleaned;
  }
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
  if (typeof rec?.error === "string" && rec.error.trim()) {
    return readableContractError(rec.error);
  }
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  private async readContractSafe(functionName: string, args: unknown[] = []): Promise<unknown> {
    return this.client.readContract({
      address: this.contractAddress,
      functionName,
      args,
    });
  }

  private async readSubmissionsRaw(): Promise<unknown> {
    try {
      return await this.readContractSafe("get_submissions");
    } catch {
      return this.readContractSafe("get_leaderboard");
    }
  }

  async getSubmissions(): Promise<Submission[]> {
    try {
      const raw = await this.readSubmissionsRaw();
      return collectSubmissions(raw)
        .filter((item) => item.user || item.content)
        .sort((a, b) => submissionSortId(b.id) - submissionSortId(a.id));
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
      const totals = new Map<string, { address: string; points: number }>();

      for (const item of submissions) {
        const address = item.user || "unknown";
        const key = address.toLowerCase();
        const prev = totals.get(key);
        if (prev) {
          prev.points += item.score;
        } else {
          totals.set(key, { address, points: item.score });
        }
      }

      try {
        const rawPoints = await this.readContractSafe("get_points_board");
        const rec = asRecord(rawPoints);
        for (const [addr, pts] of Object.entries(rec)) {
          const key = String(addr).toLowerCase();
          const points = Number(pts) || 0;
          const prev = totals.get(key);
          if (!prev) {
            totals.set(key, { address: String(addr), points });
          } else if (points > prev.points) {
            prev.points = points;
          }
        }
      } catch {
        // Older deployments may not expose get_points_board.
      }

      return Array.from(totals.values()).sort((a, b) => b.points - a.points);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      throw error;
    }
  }

  private submissionAppeared(
    list: Submission[],
    before: Submission[],
    userAddr: string,
    id?: string
  ): boolean {
    if (list.length > before.length) return true;
    if (
      id &&
      list.some((item) => String(item.id) === String(id)) &&
      !before.some((item) => String(item.id) === String(id))
    ) {
      return true;
    }
    const fromUser = (item: Submission) => sameWallet(item.user, userAddr);
    return list.filter(fromUser).length > before.filter(fromUser).length;
  }

  private async waitForPersistedSubmission(
    userAddr: string,
    before: Submission[],
    id?: string
  ): Promise<boolean> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const list = await this.getSubmissions();
      if (this.submissionAppeared(list, before, userAddr, id)) {
        return true;
      }
      await sleep(1500);
    }
    return false;
  }

  async estimateSubmitFees(
    userAddr: string,
    category: ArenaCategory,
    content: string,
    projection: ProjectionInput,
    level: FeePresetLevel = "standard"
  ): Promise<FeePresetEstimate | undefined> {
    return estimateWriteFeePreset(
      this.client,
      {
        address: this.contractAddress,
        functionName: "submit_and_judge",
        args: [
          userAddr,
          category,
          content,
          projection.claim,
          projection.deadline,
          projection.evidenceUrl,
        ],
      },
      level
    );
  }

  async estimateResolveFees(
    subId: string,
    level: FeePresetLevel = "standard"
  ): Promise<FeePresetEstimate | undefined> {
    return estimateWriteFeePreset(
      this.client,
      {
        address: this.contractAddress,
        functionName: "resolve_projection",
        args: [subId],
      },
      level
    );
  }

  async submitEntry(
    userAddr: string,
    category: ArenaCategory,
    content: string,
    projection: ProjectionInput,
    feePreset?: FeePresetEstimate
  ): Promise<TransactionReceipt> {
    const before = await this.getSubmissions().catch(() => [] as Submission[]);
    const fees = feePresetToTransactionFees(feePreset);
    const txHash = await this.client.writeContract({
      address: this.contractAddress,
      functionName: "submit_and_judge",
      args: [
        userAddr,
        category,
        content,
        projection.claim,
        projection.deadline,
        projection.evidenceUrl,
      ],
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
    const persisted = await this.waitForPersistedSubmission(
      userAddr,
      before,
      judgment.id
    );
    if (!persisted) {
      throw new Error(
        "The transaction finished, but your new submission was not saved to the arena. Please try again."
      );
    }

    return {
      ...(receipt as TransactionReceipt),
      hash: (receipt as any)?.hash || txHash,
      judgment,
    };
  }

  async resolveProjection(
    subId: string,
    feePreset?: FeePresetEstimate
  ): Promise<TransactionReceipt> {
    const fees = feePresetToTransactionFees(feePreset);
    const txHash = await this.client.writeContract({
      address: this.contractAddress,
      functionName: "resolve_projection",
      args: [subId],
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

    return {
      ...(receipt as TransactionReceipt),
      hash: (receipt as any)?.hash || txHash,
    };
  }
}

export default RoyArena;
