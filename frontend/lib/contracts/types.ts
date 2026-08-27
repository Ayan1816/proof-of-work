export interface Submission {
  id: string;
  user: string;
  category: string;
  content: string;
  score: number;
  feedback: string;
}

export interface LeaderboardEntry {
  address: string;
  points: number;
}

export interface TransactionReceipt {
  status: string;
  hash: string;
  blockNumber?: number;
  [key: string]: any;
}

export type ArenaCategory = "Startup" | "Meme" | "Poem";
