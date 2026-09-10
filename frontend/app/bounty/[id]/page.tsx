"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Coins,
  ExternalLink,
  Gavel,
  Loader2,
  Lock,
  Scale,
  Wallet,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { AddressDisplay } from "@/components/AddressDisplay";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitModal } from "@/components/SubmitModal";
import { Button } from "@/components/ui/button";
import {
  useAppeal,
  useBounty,
  useJudgeSubmission,
  useProofOfWorkContract,
  useReleasePayment,
  useSubmission,
} from "@/lib/hooks/useProofOfWork";
import { useWallet } from "@/lib/genlayer/wallet";
import {
  formatDeadline,
  formatGen,
  isExpired,
  sameWallet,
} from "@/lib/format";

function hasSubmissionId(id?: string): boolean {
  return Boolean(id && id !== "0");
}

export default function BountyDetailPage() {
  const params = useParams<{ id: string }>();
  const bountyId = String(params?.id || "");
  const contract = useProofOfWorkContract();
  const { address, isConnected } = useWallet();
  const {
    data: bounty,
    isLoading,
    isError,
    refetch,
  } = useBounty(bountyId);
  const submissionId = hasSubmissionId(bounty?.submissionId)
    ? bounty?.submissionId
    : undefined;
  const { data: submission, isLoading: submissionLoading } =
    useSubmission(submissionId);

  const judge = useJudgeSubmission();
  const release = useReleasePayment();
  const appeal = useAppeal();

  const expired = bounty ? isExpired(bounty.deadline) : false;
  const isCreator = sameWallet(address || undefined, bounty?.creator);
  const isSubmitter = sameWallet(address || undefined, bounty?.submitter);
  const canSubmit =
    bounty?.status === "Open" &&
    !expired &&
    !isCreator &&
    !hasSubmissionId(bounty.submissionId);
  const canJudge =
    bounty?.status === "InReview" || bounty?.status === "Appealed";
  const canRelease = bounty?.status === "Approved" && bounty.escrowLocked;
  const canAppeal =
    (bounty?.status === "Approved" || bounty?.status === "Rejected") &&
    (isCreator || isSubmitter) &&
    (bounty?.appealCount || 0) < 1;

  const actionPending = judge.isPending || release.isPending || appeal.isPending;

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-accent mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to bounties
        </Link>

        {!contract ? (
          <div className="brand-card p-10 text-center space-y-2">
            <h2 className="text-xl font-bold">Setup required</h2>
            <p className="text-sm text-muted-foreground">
              Set NEXT_PUBLIC_CONTRACT_ADDRESS in frontend/.env to the deployed
              Proof of Work contract.
            </p>
          </div>
        ) : isLoading ? (
          <div className="brand-card p-16 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        ) : isError || !bounty ? (
          <div className="brand-card p-10 text-center space-y-4">
            <p className="text-destructive">Bounty not found.</p>
            <Button type="button" variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <section className="brand-card p-6 md:p-8">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <h1 className="text-3xl md:text-4xl font-bold leading-tight">
                    {bounty.title}
                  </h1>
                  <StatusBadge status={bounty.status} />
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    Posted by{" "}
                    <Link
                      href={`/profile/${bounty.creator}`}
                      className="hover:text-accent"
                    >
                      <AddressDisplay address={bounty.creator} maxLength={14} />
                    </Link>
                  </span>
                  {expired && bounty.status === "Open" && (
                    <span className="text-destructive">Expired</span>
                  )}
                </div>
              </section>

              <section className="brand-card p-6 md:p-8 space-y-3">
                <h2 className="text-xl font-bold">Specification</h2>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {bounty.spec}
                </p>
              </section>

              <section className="brand-card p-6 md:p-8 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold">Submissions</h2>
                </div>

                {submissionLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading…
                  </div>
                ) : !submission ? (
                  <p className="text-sm text-muted-foreground">
                    {bounty.status === "Open"
                      ? "No work submitted yet."
                      : "No submission on record for this bounty."}
                  </p>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Link
                        href={`/profile/${submission.submitter}`}
                        className="text-sm hover:text-accent"
                      >
                        <AddressDisplay
                          address={submission.submitter}
                          maxLength={16}
                          showCopy
                        />
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {formatDeadline(submission.timestamp)}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                        Proof link
                      </p>
                      <a
                        href={submission.proofLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-accent hover:underline break-all"
                      >
                        {submission.proofLink}
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                        Description
                      </p>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {submission.description}
                      </p>
                    </div>
                  </div>
                )}
              </section>

              <section className="brand-card p-6 md:p-8 space-y-3">
                <h2 className="text-xl font-bold">AI verdict</h2>
                {bounty.verdictReasoning ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
                    <StatusBadge status={bounty.status} />
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {bounty.verdictReasoning}
                    </p>
                    {bounty.appealCount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Appeals filed: {bounty.appealCount}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Not judged yet.
                  </p>
                )}
              </section>
            </div>

            <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-24 h-fit">
              <div className="brand-card p-6 space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Reward
                  </p>
                  <p className="text-2xl font-bold text-accent inline-flex items-center gap-2">
                    <Coins className="w-5 h-5" />
                    {formatGen(bounty.reward)} GEN
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Deadline
                  </p>
                  <p className="text-sm inline-flex items-center gap-2">
                    <Clock className="w-4 h-4 text-accent" />
                    {formatDeadline(bounty.deadline)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Escrow
                  </p>
                  <p className="text-sm inline-flex items-center gap-2">
                    <Lock className="w-4 h-4 text-accent" />
                    {bounty.status === "Paid"
                      ? "Paid to submitter"
                      : bounty.escrowLocked
                        ? "Locked in contract"
                        : "Not locked"}
                  </p>
                </div>
                {bounty.submitter && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                      Submitter
                    </p>
                    <Link
                      href={`/profile/${bounty.submitter}`}
                      className="text-sm inline-flex items-center gap-2 hover:text-accent"
                    >
                      <Wallet className="w-4 h-4 text-accent" />
                      <AddressDisplay address={bounty.submitter} maxLength={14} />
                    </Link>
                  </div>
                )}
              </div>

              <div className="brand-card p-6 space-y-3">
                <h3 className="font-semibold">Actions</h3>
                {!isConnected && (
                  <p className="text-sm text-muted-foreground">
                    Connect your wallet to submit work, request judgment, or
                    release payment.
                  </p>
                )}
                {canSubmit && <SubmitModal bountyId={bounty.id} />}
                {canJudge && (
                  <Button
                    variant="gradient"
                    className="w-full"
                    disabled={actionPending}
                    onClick={() => judge.mutate(bounty.id)}
                  >
                    {judge.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Judging… this can take a minute
                      </>
                    ) : (
                      <>
                        <Gavel className="w-4 h-4 mr-2" />
                        Ask AI to judge
                      </>
                    )}
                  </Button>
                )}
                {canRelease && (
                  <Button
                    variant="gradient"
                    className="w-full"
                    disabled={actionPending}
                    onClick={() => release.mutate(bounty.id)}
                  >
                    {release.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Releasing…
                      </>
                    ) : (
                      "Release payment"
                    )}
                  </Button>
                )}
                {canAppeal && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={actionPending}
                    onClick={() => appeal.mutate(bounty.id)}
                  >
                    {appeal.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Filing appeal…
                      </>
                    ) : (
                      <>
                        <Scale className="w-4 h-4 mr-2" />
                        Appeal verdict
                      </>
                    )}
                  </Button>
                )}
                {!canSubmit && !canJudge && !canRelease && !canAppeal && (
                  <p className="text-sm text-muted-foreground">
                    No actions available for this bounty right now.
                  </p>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </PageShell>
  );
}
