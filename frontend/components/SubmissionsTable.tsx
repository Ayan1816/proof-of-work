"use client";

import { Loader2, Trophy, AlertCircle } from "lucide-react";
import {
  useResolveProjection,
  useRoyArenaContract,
  useSubmissions,
} from "@/lib/hooks/useRoyArena";
import { useWallet } from "@/lib/genlayer/wallet";
import { AddressDisplay } from "./AddressDisplay";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import type { Submission } from "@/lib/contracts/types";

function isDue(deadline: string): boolean {
  if (!deadline || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return false;
  return new Date().toISOString().slice(0, 10) >= deadline;
}

function realityLabel(submission: Submission): { text: string; className: string } {
  const outcome = String(submission.reality_outcome || "unresolved").toLowerCase();
  if (submission.resolved || outcome === "true") {
    return { text: "Confirmed", className: "border-emerald-400/40 text-emerald-300" };
  }
  if (outcome === "false") {
    return { text: "Denied", className: "border-red-400/40 text-red-300" };
  }
  if (outcome === "too_early") {
    return { text: "Too early", className: "border-amber-400/40 text-amber-300" };
  }
  return { text: "Unresolved", className: "border-white/20 text-muted-foreground" };
}

export function SubmissionsTable() {
  const contract = useRoyArenaContract();
  const { data: submissions, isLoading, isError } = useSubmissions();
  const { address } = useWallet();

  if (isLoading) {
    return (
      <div className="brand-card p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Loading submissions...</p>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="brand-card p-12">
        <div className="text-center space-y-4">
          <AlertCircle className="w-16 h-16 mx-auto text-yellow-400 opacity-60" />
          <h3 className="text-xl font-bold">Setup Required</h3>
          <p className="text-sm text-muted-foreground">
            Please set <code className="bg-muted px-1 py-0.5 rounded text-xs">NEXT_PUBLIC_CONTRACT_ADDRESS</code> in your .env file.
          </p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="brand-card p-8">
        <div className="text-center">
          <p className="text-destructive">Failed to load submissions. Please try again.</p>
        </div>
      </div>
    );
  }

  if (!submissions || submissions.length === 0) {
    return (
      <div className="brand-card p-12">
        <div className="text-center space-y-3">
          <Trophy className="w-16 h-16 mx-auto text-muted-foreground opacity-30" />
          <h3 className="text-xl font-bold">No Projections Yet</h3>
          <p className="text-muted-foreground">
            Be the first to submit an idea with a claim the internet can later confirm.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="brand-card p-6 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Idea
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Taste
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Reality
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Author
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {submissions.map((item, index) => (
              <SubmissionRow
                key={`${item.id}-${item.category}-${index}`}
                submission={item}
                currentAddress={address}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubmissionRow({
  submission,
  currentAddress,
}: {
  submission: Submission;
  currentAddress: string | null;
}) {
  const isOwner = currentAddress?.toLowerCase() === submission.user?.toLowerCase();
  const { resolveProjectionAsync, isResolving } = useResolveProjection();
  const reality = realityLabel(submission);
  const canResolve =
    Boolean(currentAddress) &&
    !submission.resolved &&
    submission.reality_outcome !== "true" &&
    submission.reality_outcome !== "false" &&
    isDue(submission.deadline);

  const handleResolve = async () => {
    await resolveProjectionAsync({ subId: submission.id });
  };

  return (
    <tr className="group hover:bg-white/5 transition-colors animate-fade-in align-top">
      <td className="px-4 py-4 max-w-sm">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-accent border-accent/30">
            {submission.category}
          </Badge>
          {submission.deadline && (
            <span className="text-xs text-muted-foreground">Due {submission.deadline}</span>
          )}
        </div>
        <p className="text-sm line-clamp-3">{submission.content}</p>
        {submission.claim && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
            Claim: {submission.claim}
          </p>
        )}
        {submission.evidence_url && (
          <a
            href={submission.evidence_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs text-accent hover:underline break-all"
          >
            {submission.evidence_url}
          </a>
        )}
      </td>
      <td className="px-4 py-4">
        <span className="text-lg font-bold text-accent">{submission.score}</span>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-3 max-w-[12rem]">
          {submission.feedback || "—"}
        </p>
      </td>
      <td className="px-4 py-4">
        <Badge variant="outline" className={reality.className}>
          {reality.text}
        </Badge>
        {submission.reality_note && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-3 max-w-[12rem]">
            {submission.reality_note}
          </p>
        )}
        {canResolve && (
          <Button
            variant="secondary"
            className="mt-3 h-8 px-3 text-xs"
            disabled={isResolving}
            onClick={handleResolve}
          >
            {isResolving ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Checking
              </>
            ) : (
              "Check reality"
            )}
          </Button>
        )}
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <AddressDisplay address={submission.user} maxLength={10} showCopy={true} />
          {isOwner && (
            <Badge variant="secondary" className="text-xs">
              You
            </Badge>
          )}
        </div>
      </td>
    </tr>
  );
}
