"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { BountyCard } from "@/components/BountyCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BountyStatus } from "@/lib/contracts/types";
import { STATUS_LABELS } from "@/lib/format";
import { useBounties, useProofOfWorkContract } from "@/lib/hooks/useProofOfWork";

const STATUS_FILTERS: Array<"all" | BountyStatus> = [
  "all",
  "Open",
  "InReview",
  "Approved",
  "Rejected",
  "Paid",
  "Appealed",
  "Refunded",
];

export default function HomePage() {
  const contract = useProofOfWorkContract();
  const {
    data: bounties = [],
    isLoading,
    isError,
    isFetching,
    error,
    refetch,
  } = useBounties();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | BountyStatus>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bounties.filter((bounty) => {
      if (status !== "all" && bounty.status !== status) return false;
      if (!q) return true;
      return (
        bounty.title.toLowerCase().includes(q) ||
        bounty.spec.toLowerCase().includes(q)
      );
    });
  }, [bounties, query, status]);

  return (
    <PageShell>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
            Open bounties, judged by AI
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Anyone can post a spec and lock a reward. Contributors submit a
            public proof link. Independent GenLayer validators fetch the work
            and decide if it matches. Approved work can release payment
            automatically.
          </p>
          <p className="text-xs text-muted-foreground mt-3">
            Free testnet — no real funds
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or spec…"
            className="md:max-w-sm"
            aria-label="Search title or spec"
          />
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground mr-1">Status</span>
            {STATUS_FILTERS.map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={status === option ? "gradient" : "outline"}
                onClick={() => setStatus(option)}
              >
                {option === "all" ? "All" : STATUS_LABELS[option]}
              </Button>
            ))}
            {isFetching && !isLoading && (
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
            )}
          </div>
        </div>

        {!contract ? (
          <div className="brand-card p-12">
            <div className="text-center space-y-4">
              <AlertCircle className="w-16 h-16 mx-auto text-yellow-400 opacity-60" />
              <h3 className="text-xl font-bold">Setup required</h3>
              <p className="text-sm text-muted-foreground">
                Set{" "}
                <code className="bg-muted px-1 py-0.5 rounded text-xs">
                  NEXT_PUBLIC_CONTRACT_ADDRESS
                </code>{" "}
                in frontend/.env to the deployed Proof of Work contract.
              </p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="brand-card p-8 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
              <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
          </div>
        ) : isError ? (
          <div className="brand-card p-8 text-center space-y-4">
            <p className="text-destructive break-all whitespace-pre-wrap">
              {error?.message || "Something went wrong"}
            </p>
            <Button type="button" variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="brand-card p-12 text-center space-y-4">
            <h3 className="text-xl font-bold">
              No bounties match these filters yet.
            </h3>
            {bounties.length === 0 && (
              <Button asChild variant="gradient">
                <Link href="/create">Post the first bounty</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((bounty) => (
              <BountyCard key={bounty.id} bounty={bounty} />
            ))}
          </div>
        )}

        <div className="mt-8 brand-card p-6 md:p-8 text-center space-y-4">
          <h2 className="text-2xl font-bold">New here?</h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Proof of Work is a bounty board with independent AI review. You do
            not need to know crypto to use it.
          </p>
          <Button asChild variant="outline">
            <Link href="/faq">How it works</Link>
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
