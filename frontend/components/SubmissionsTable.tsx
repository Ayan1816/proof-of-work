"use client";

import { Loader2, Trophy, AlertCircle } from "lucide-react";
import { useSubmissions, useRoyArenaContract } from "@/lib/hooks/useRoyArena";
import { useWallet } from "@/lib/genlayer/wallet";
import { AddressDisplay } from "./AddressDisplay";
import { Badge } from "./ui/badge";
import type { Submission } from "@/lib/contracts/types";

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
          <h3 className="text-xl font-bold">No Submissions Yet</h3>
          <p className="text-muted-foreground">
            Be the first to submit a Startup, Meme, or Poem to the AI judge.
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
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Content
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Score
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Feedback
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Author
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {submissions.map((item) => (
              <SubmissionRow
                key={item.id}
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

  return (
    <tr className="group hover:bg-white/5 transition-colors animate-fade-in">
      <td className="px-4 py-4">
        <Badge variant="outline" className="text-accent border-accent/30">
          {submission.category}
        </Badge>
      </td>
      <td className="px-4 py-4 max-w-xs">
        <p className="text-sm line-clamp-3">{submission.content}</p>
      </td>
      <td className="px-4 py-4">
        <span className="text-lg font-bold text-accent">{submission.score}</span>
      </td>
      <td className="px-4 py-4 max-w-xs">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {submission.feedback || "—"}
        </p>
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
