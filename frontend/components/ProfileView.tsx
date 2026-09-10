"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, User } from "lucide-react";
import { AddressDisplay } from "./AddressDisplay";
import { BountyCard } from "./BountyCard";
import { Button } from "./ui/button";
import {
  useBounties,
  useProofOfWorkContract,
  useReputation,
} from "@/lib/hooks/useProofOfWork";
import { sameWallet } from "@/lib/format";

export function ProfileView({
  address,
  isOwn = false,
  walletLoading = false,
}: {
  address: string | null;
  isOwn?: boolean;
  walletLoading?: boolean;
}) {
  const contract = useProofOfWorkContract();
  const {
    data: reputation,
    isLoading: reputationLoading,
    isError: reputationError,
    refetch: refetchReputation,
  } = useReputation(address);
  const {
    data: bounties = [],
    isLoading: bountiesLoading,
    isError: bountiesError,
    refetch: refetchBounties,
  } = useBounties();

  const created = bounties.filter((bounty) =>
    sameWallet(bounty.creator, address || undefined)
  );
  const submitted = bounties.filter((bounty) =>
    sameWallet(bounty.submitter, address || undefined)
  );

  if (walletLoading) {
    return (
      <div className="max-w-5xl mx-auto brand-card p-16 flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-accent mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>
        <div className="brand-card p-10 text-center space-y-3">
          <User className="w-10 h-10 mx-auto text-accent" />
          <h1 className="text-2xl font-bold">Contributor profile</h1>
          <p className="text-sm text-muted-foreground">
            Connect your wallet to view your address and reputation history.
          </p>
        </div>
      </div>
    );
  }

  const loading = reputationLoading || bountiesLoading;
  const error = reputationError || bountiesError;

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-accent mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Link>

      <div className="brand-card p-6 md:p-8 mb-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          {isOwn ? "Your profile" : "Contributor profile"}
        </p>
        <h1 className="text-2xl md:text-3xl font-bold mb-3 break-all font-mono">
          {address}
        </h1>
        <AddressDisplay address={address} maxLength={20} showCopy />
      </div>

      {!contract ? (
        <div className="brand-card p-8 space-y-2">
          <h2 className="text-xl font-bold">Setup required</h2>
          <p className="text-sm text-muted-foreground">
            Set NEXT_PUBLIC_CONTRACT_ADDRESS in frontend/.env to the deployed
            Proof of Work contract.
          </p>
        </div>
      ) : loading ? (
        <div className="brand-card p-16 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      ) : error ? (
        <div className="brand-card p-8 text-center space-y-4">
          <p className="text-destructive">Something went wrong</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              refetchReputation();
              refetchBounties();
            }}
          >
            Try again
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="brand-card p-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Approved
              </p>
              <p className="text-4xl font-bold text-emerald-300">
                {reputation?.approvedCount ?? 0}
              </p>
            </div>
            <div className="brand-card p-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Rejected
              </p>
              <p className="text-4xl font-bold text-red-300">
                {reputation?.rejectedCount ?? 0}
              </p>
            </div>
          </div>

          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">
              Bounties posted ({created.length})
            </h2>
            {created.length === 0 ? (
              <p className="text-sm text-muted-foreground brand-card p-6">
                No bounty history for this address yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {created.map((bounty) => (
                  <BountyCard key={bounty.id} bounty={bounty} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-xl font-bold mb-4">
              Work submitted ({submitted.length})
            </h2>
            {submitted.length === 0 ? (
              <p className="text-sm text-muted-foreground brand-card p-6">
                No submissions from this address yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {submitted.map((bounty) => (
                  <BountyCard key={bounty.id} bounty={bounty} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
