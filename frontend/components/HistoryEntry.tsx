"use client";

import Link from "next/link";
import {
  Coins,
  ExternalLink,
  FilePlus2,
  Fuel,
  Gavel,
  RotateCcw,
  Scale,
  Upload,
} from "lucide-react";
import type { HistoryAction, HistoryItem, HistoryStatus } from "@/lib/history/types";
import { explorerTxUrl } from "@/lib/history/types";
import { formatGen } from "@/lib/format";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

const ACTION_ICONS: Record<HistoryAction, typeof FilePlus2> = {
  create_bounty: FilePlus2,
  submit_work: Upload,
  judge_submission: Gavel,
  release_payment: Coins,
  appeal: Scale,
  refund: RotateCcw,
};

const STATUS_STYLES: Record<HistoryStatus, string> = {
  success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
};

const STATUS_LABELS: Record<HistoryStatus, string> = {
  success: "Success",
  pending: "Pending",
  failed: "Failed",
};

function shortenHash(hash: string): string {
  if (!hash) return "—";
  if (hash.length <= 18) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

function formatWhen(timestamp: number): string {
  if (!timestamp) return "On-chain record";
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatAmount(amountWei: string, action: HistoryAction): string {
  try {
    const value = BigInt(amountWei || "0");
    if (value === 0n) {
      return action === "release_payment" || action === "create_bounty" || action === "refund"
        ? "0 GEN"
        : "—";
    }
    const prefix =
      action === "create_bounty" ? "−" : action === "release_payment" || action === "refund" ? "+" : "";
    return `${prefix}${formatGen(value)} GEN`;
  } catch {
    return "—";
  }
}

function formatGas(item: HistoryItem): string {
  if (item.gasFeeWei) {
    try {
      const fee = BigInt(item.gasFeeWei);
      if (fee > 0n) return `${formatGen(fee)} GEN`;
    } catch {
      // fall through
    }
  }
  if (item.gasUsed && item.gasUsed !== "0") {
    return `${item.gasUsed} gas`;
  }
  if (item.source === "chain") return "—";
  if (item.status === "pending") return "Estimating…";
  return "Studio (included)";
}

export function HistoryEntry({ item }: { item: HistoryItem }) {
  const Icon = ACTION_ICONS[item.action] || FilePlus2;
  const explorer = item.hash ? explorerTxUrl(item.hash) : "";
  const amountClass =
    item.action === "release_payment" || item.action === "refund"
      ? "text-emerald-300"
      : item.action === "create_bounty" && item.amountWei !== "0"
        ? "text-pink-300"
        : "text-muted-foreground";

  return (
    <article className="brand-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 rounded-lg bg-accent/15 p-2 text-accent shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold leading-tight">{item.label}</h3>
            <p className="text-sm text-muted-foreground truncate">
              {item.title || (item.bountyId ? `Bounty #${item.bountyId}` : "Proof of Work")}
            </p>
          </div>
        </div>
        <Badge variant="outline" className={STATUS_STYLES[item.status]}>
          {STATUS_LABELS[item.status]}
        </Badge>
      </div>

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground mb-1">Amount</dt>
          <dd className={cn("font-medium", amountClass)}>
            {formatAmount(item.amountWei, item.action)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Fuel className="w-3 h-3" />
            Gas fee
          </dt>
          <dd className="font-medium">{formatGas(item)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground mb-1">When</dt>
          <dd className="font-medium">{formatWhen(item.timestamp)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground mb-1">Transaction</dt>
          <dd className="font-mono text-xs truncate">
            {explorer ? (
              <a
                href={explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                {shortenHash(item.hash)}
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="text-muted-foreground">
                {item.source === "chain" ? "Rebuilt from contract state" : "—"}
              </span>
            )}
          </dd>
        </div>
      </dl>

      {item.bountyId && (
        <Link
          href={`/bounty/${item.bountyId}`}
          className="text-xs text-muted-foreground hover:text-accent"
        >
          Open bounty #{item.bountyId}
        </Link>
      )}

      {item.error && item.status === "failed" && (
        <p className="text-xs text-destructive break-words">{item.error}</p>
      )}
    </article>
  );
}
