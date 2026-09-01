export type RealityOutcome = "unresolved" | "true" | "false" | "too_early";

export interface Submission {
  id: string;
  user: string;
  category: string;
  content: string;
  score: number;
  feedback: string;
  claim: string;
  deadline: string;
  evidence_url: string;
  resolved: boolean;
  reality_outcome: RealityOutcome | string;
  reality_note: string;
}

export interface ProjectionInput {
  claim: string;
  deadline: string;
  evidenceUrl: string;
}

export interface LeaderboardEntry {
  address: string;
  points: number;
}

export interface TransactionReceipt {
  status: string;
  hash: string;
  blockNumber?: number;
  statusName?: string;
  txExecutionResultName?: string;
  judgment?: {
    id?: string;
    score?: number;
    feedback?: string;
    status?: string;
  };
  [key: string]: any;
}

export type ArenaCategory = "Startup" | "Meme" | "Poem";
