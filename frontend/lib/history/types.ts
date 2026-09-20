export type HistoryAction =
  | "create_bounty"
  | "submit_work"
  | "judge_submission"
  | "release_payment"
  | "appeal"
  | "refund";

export type HistoryStatus = "pending" | "success" | "failed";

export type HistorySource = "wallet" | "chain";

export interface HistoryItem {
  id: string;
  wallet: string;
  action: HistoryAction;
  label: string;
  status: HistoryStatus;
  amountWei: string;
  gasUsed: string;
  gasFeeWei: string;
  hash: string;
  bountyId: string;
  title: string;
  timestamp: number;
  source: HistorySource;
  error?: string;
}

export const ACTION_LABELS: Record<HistoryAction, string> = {
  create_bounty: "Bounty Created",
  submit_work: "Proof Submitted",
  judge_submission: "Verdict Recorded",
  release_payment: "Reward Paid",
  appeal: "Appeal Filed",
  refund: "Escrow Refunded",
};

export const HISTORY_ACTIONS: HistoryAction[] = [
  "create_bounty",
  "submit_work",
  "judge_submission",
  "release_payment",
  "appeal",
  "refund",
];

export const EXPLORER_TX_URL = "https://explorer-studio.genlayer.com/tx";

export function isHistoryAction(value: string): value is HistoryAction {
  return HISTORY_ACTIONS.includes(value as HistoryAction);
}

export function explorerTxUrl(hash: string): string {
  const clean = hash.trim();
  if (!clean) return "";
  return `${EXPLORER_TX_URL}/${clean}`;
}
