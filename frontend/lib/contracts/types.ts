export type BountyStatus =
  | "Open"
  | "InReview"
  | "Approved"
  | "Rejected"
  | "Paid"
  | "Appealed"
  | "Refunded";

export interface Bounty {
  id: string;
  creator: string;
  title: string;
  spec: string;
  reward: bigint;
  deadline: number;
  status: BountyStatus;
  escrowLocked: boolean;
  submitter: string;
  submissionId: string;
  verdictReasoning: string;
  appealCount: number;
  lastApproved: boolean;
}

export interface Submission {
  id: string;
  bountyId: string;
  submitter: string;
  proofLink: string;
  description: string;
  timestamp: number;
}

export interface Reputation {
  approvedCount: number;
  rejectedCount: number;
}

export interface TransactionReceipt {
  status: string;
  hash: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}
