"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, History, Loader2, Wallet } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { HistoryEntry } from "@/components/HistoryEntry";
import { Button } from "@/components/ui/button";
import {
  filterHistory,
  useTransactionHistory,
} from "@/lib/hooks/useTransactionHistory";
import {
  ACTION_LABELS,
  HISTORY_ACTIONS,
  type HistoryAction,
  type HistoryStatus,
} from "@/lib/history/types";

const STATUS_FILTERS: Array<"all" | HistoryStatus> = [
  "all",
  "success",
  "pending",
  "failed",
];

const STATUS_FILTER_LABELS: Record<"all" | HistoryStatus, string> = {
  all: "All statuses",
  success: "Success",
  pending: "Pending",
  failed: "Failed",
};

export default function HistoryPage() {
  const { items, isLoading, isError, error, refetch, address } =
    useTransactionHistory();
  const [action, setAction] = useState<"all" | HistoryAction>("all");
  const [status, setStatus] = useState<"all" | HistoryStatus>("all");

  const filtered = useMemo(
    () => filterHistory(items, action, status),
    [items, action, status]
  );

  const succeeded = items.filter((item) => item.status === "success").length;
  const pending = items.filter((item) => item.status === "pending").length;
  const failed = items.filter((item) => item.status === "failed").length;

  return (
    <PageShell>
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-accent mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>

        <div className="mb-8">
          <p className="text-xs uppercase tracking-wider text-accent mb-2">
            Wallet activity
          </p>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">History</h1>
          <p className="text-muted-foreground">
            Every bounty you post, proof you submit, and payout you send or
            receive. Saved on this device and rebuilt from on-chain bounty
            state after a refresh.
          </p>
        </div>

        {!address ? (
          <div className="brand-card p-10 text-center space-y-3">
            <Wallet className="w-10 h-10 mx-auto text-accent" />
            <h2 className="text-xl font-bold">Connect your wallet</h2>
            <p className="text-sm text-muted-foreground">
              Transaction history is stored per address so a refresh does not
              wipe it. Connect Rabby or MetaMask to see yours.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <SummaryCard label="All" value={items.length} />
              <SummaryCard label="Success" value={succeeded} />
              <SummaryCard label="Pending" value={pending} />
              <SummaryCard label="Failed" value={failed} />
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              <FilterButton
                active={action === "all"}
                onClick={() => setAction("all")}
              >
                All actions
              </FilterButton>
              {HISTORY_ACTIONS.map((option) => (
                <FilterButton
                  key={option}
                  active={action === option}
                  onClick={() => setAction(option)}
                >
                  {ACTION_LABELS[option]}
                </FilterButton>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mb-6">
              {STATUS_FILTERS.map((option) => (
                <FilterButton
                  key={option}
                  active={status === option}
                  onClick={() => setStatus(option)}
                >
                  {STATUS_FILTER_LABELS[option]}
                </FilterButton>
              ))}
            </div>

            {isLoading && items.length === 0 ? (
              <div className="brand-card p-16 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <p className="text-sm text-muted-foreground">
                  Loading history…
                </p>
              </div>
            ) : isError && items.length === 0 ? (
              <div className="brand-card p-10 text-center space-y-4">
                <p className="text-destructive break-all">
                  {error?.message || "Could not load on-chain history."}
                </p>
                <Button type="button" variant="outline" onClick={() => refetch()}>
                  Try again
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="brand-card p-10 text-center space-y-3">
                <History className="w-10 h-10 mx-auto text-accent" />
                <h2 className="text-xl font-bold">No matching activity</h2>
                <p className="text-sm text-muted-foreground">
                  Post a bounty or submit proof and it will show up here, even
                  after you refresh.
                </p>
                <Button asChild variant="gradient">
                  <Link href="/create">Post a bounty</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((item) => (
                  <HistoryEntry key={item.id} item={item} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="brand-card p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "gradient" : "outline"}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
