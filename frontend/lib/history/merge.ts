import type { Bounty } from "../contracts/types";
import { sameWallet } from "../format";
import { ACTION_LABELS, type HistoryAction, type HistoryItem } from "./types";

function chainItem(
  wallet: string,
  action: HistoryAction,
  bounty: Bounty,
  extra?: Partial<HistoryItem>
): HistoryItem {
  return {
    id: `chain:${action}:${bounty.id}`,
    wallet: wallet.trim().toLowerCase(),
    action,
    label: ACTION_LABELS[action],
    status: "success",
    amountWei: bounty.reward.toString(),
    gasUsed: "",
    gasFeeWei: "",
    hash: "",
    bountyId: bounty.id,
    title: bounty.title,
    timestamp: extra?.timestamp || 0,
    source: "chain",
    ...extra,
  };
}

export function historyFromBounties(
  bounties: Bounty[],
  wallet: string
): HistoryItem[] {
  if (!wallet) return [];
  const items: HistoryItem[] = [];
  for (const bounty of bounties) {
    if (sameWallet(bounty.creator, wallet)) {
      items.push(
        chainItem(wallet, "create_bounty", bounty, {
          amountWei: bounty.reward.toString(),
        })
      );
      if (bounty.status === "Refunded") {
        items.push(chainItem(wallet, "refund", bounty));
      }
    }
    if (sameWallet(bounty.submitter, wallet)) {
      items.push(
        chainItem(wallet, "submit_work", bounty, {
          amountWei: "0",
        })
      );
      if (bounty.status === "Paid") {
        items.push(chainItem(wallet, "release_payment", bounty));
      }
    }
  }
  return items;
}

function covers(local: HistoryItem, chain: HistoryItem): boolean {
  if (local.action !== chain.action) return false;
  if (local.bountyId && chain.bountyId && local.bountyId === chain.bountyId) {
    return true;
  }
  if (
    local.action === "create_bounty" &&
    local.title &&
    chain.title &&
    local.title.trim().toLowerCase() === chain.title.trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}

export function mergeHistory(
  local: HistoryItem[],
  chain: HistoryItem[]
): HistoryItem[] {
  const merged = local.slice();
  for (const item of chain) {
    if (merged.some((existing) => covers(existing, item))) continue;
    merged.push(item);
  }
  return merged.sort((a, b) => {
    const time = (b.timestamp || 0) - (a.timestamp || 0);
    if (time !== 0) return time;
    return Number(b.bountyId || 0) - Number(a.bountyId || 0);
  });
}
