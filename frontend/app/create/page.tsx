"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateBounty, useProofOfWorkContract } from "@/lib/hooks/useProofOfWork";
import { useWallet } from "@/lib/genlayer/wallet";
import { switchToGenLayerNetwork } from "@/lib/genlayer/client";
import { parseGen } from "@/lib/format";
import { error as toastError } from "@/lib/utils/toast";
import { errorMessage } from "@/lib/utils/errorMessage";

const MIN_TITLE_LEN = 4;
const MIN_SPEC_LEN = 20;

function toDatetimeLocalMin(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function CreateBountyPage() {
  const router = useRouter();
  const contract = useProofOfWorkContract();
  const { isConnected, address, isOnCorrectNetwork } = useWallet();
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const { mutateAsync: createBounty, isPending } = useCreateBounty();

  const [title, setTitle] = useState("");
  const [spec, setSpec] = useState("");
  const [reward, setReward] = useState("");
  const [deadline, setDeadline] = useState("");
  const [errors, setErrors] = useState({
    title: "",
    spec: "",
    reward: "",
    deadline: "",
  });
  const [submitError, setSubmitError] = useState("");

  const validate = (): {
    title: string;
    spec: string;
    rewardWei: bigint;
    deadline: number;
  } | null => {
    const next = { title: "", spec: "", reward: "", deadline: "" };
    const cleanTitle = title.trim();
    const cleanSpec = spec.trim();

    if (cleanTitle.length < MIN_TITLE_LEN) {
      next.title = "Title must be at least 4 characters";
    }
    if (cleanSpec.length < MIN_SPEC_LEN) {
      next.spec = "Spec must be at least 20 characters";
    }

    let rewardWei = 0n;
    try {
      rewardWei = parseGen(reward);
      if (rewardWei <= 0n) {
        next.reward = "Reward must be greater than zero";
      }
    } catch {
      next.reward = "Enter a valid GEN amount";
    }

    let deadlineUnix = 0;
    if (!deadline.trim()) {
      next.deadline = "Pick a deadline";
    } else {
      const ms = new Date(deadline).getTime();
      if (Number.isNaN(ms)) {
        next.deadline = "Pick a deadline";
      } else {
        deadlineUnix = Math.floor(ms / 1000);
        if (deadlineUnix <= Math.floor(Date.now() / 1000)) {
          next.deadline = "Deadline must be in the future";
        }
      }
    }

    setErrors(next);
    if (Object.values(next).some((value) => value !== "")) {
      return null;
    }

    return {
      title: cleanTitle,
      spec: cleanSpec,
      rewardWei,
      deadline: deadlineUnix,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (!isConnected || !address) {
      toastError("Connect your wallet to post a bounty.");
      return;
    }

    if (!isOnCorrectNetwork) {
      try {
        setIsSwitchingNetwork(true);
        await switchToGenLayerNetwork();
      } catch (err: unknown) {
        const message = errorMessage(err);
        setSubmitError(message);
        toastError(message);
        return;
      } finally {
        setIsSwitchingNetwork(false);
      }
    }

    const input = validate();
    if (!input) return;

    try {
      await createBounty(input);
      router.push("/");
    } catch (err: unknown) {
      setSubmitError(errorMessage(err));
    }
  };

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-accent mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Post a bounty</h1>
          <p className="text-muted-foreground">
            Lock test GEN with a clear spec. Funds stay in escrow until AI
            validators approve a submission.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Free testnet — no real funds
          </p>
        </div>

        {!contract ? (
          <div className="brand-card p-8 space-y-2">
            <h2 className="text-xl font-bold">Setup required</h2>
            <p className="text-sm text-muted-foreground">
              Set NEXT_PUBLIC_CONTRACT_ADDRESS in frontend/.env to the deployed
              Proof of Work contract.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="brand-card p-6 md:p-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setErrors((prev) => ({ ...prev, title: "" }));
                }}
                placeholder="e.g. Write a README for local setup"
                disabled={isPending}
                aria-invalid={!!errors.title}
                className={errors.title ? "border-destructive" : ""}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="spec">Spec / what “done” looks like</Label>
              <Textarea
                id="spec"
                value={spec}
                onChange={(e) => {
                  setSpec(e.target.value);
                  setErrors((prev) => ({ ...prev, spec: "" }));
                }}
                placeholder="Describe the work in enough detail that an independent reviewer can check it. Include links, required files, and acceptance criteria."
                rows={8}
                disabled={isPending}
                aria-invalid={!!errors.spec}
                className={errors.spec ? "border-destructive" : ""}
              />
              <p className="text-xs text-muted-foreground">
                {spec.trim().length}/{MIN_SPEC_LEN}
              </p>
              {errors.spec && (
                <p className="text-xs text-destructive">{errors.spec}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reward">Reward (GEN)</Label>
                <Input
                  id="reward"
                  inputMode="decimal"
                  value={reward}
                  onChange={(e) => {
                    setReward(e.target.value);
                    setErrors((prev) => ({ ...prev, reward: "" }));
                  }}
                  placeholder="1.0"
                  disabled={isPending}
                  aria-invalid={!!errors.reward}
                  className={errors.reward ? "border-destructive" : ""}
                />
                <p className="text-xs text-muted-foreground">
                  This amount is sent with the transaction and locked in escrow.
                  Testnet GEN is free.
                </p>
                {errors.reward && (
                  <p className="text-xs text-destructive">{errors.reward}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline</Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={deadline}
                  min={toDatetimeLocalMin(new Date())}
                  onChange={(e) => {
                    setDeadline(e.target.value);
                    setErrors((prev) => ({ ...prev, deadline: "" }));
                  }}
                  disabled={isPending}
                  aria-invalid={!!errors.deadline}
                  className={errors.deadline ? "border-destructive" : ""}
                />
                {errors.deadline && (
                  <p className="text-xs text-destructive">{errors.deadline}</p>
                )}
              </div>
            </div>

            {!isConnected && (
              <p className="text-sm text-destructive">
                Connect your wallet to post a bounty.
              </p>
            )}

            {isConnected && !isOnCorrectNetwork && (
              <div className="space-y-2">
                <p className="text-sm text-destructive">
                  Your wallet is on the wrong network. Switch to GenLayer Studio
                  (chain ID 61999) or Rabby will report “Gas balance is not
                  enough” even when you have GEN.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isSwitchingNetwork || isPending}
                  onClick={async () => {
                    try {
                      setIsSwitchingNetwork(true);
                      await switchToGenLayerNetwork();
                    } catch (err: unknown) {
                      setSubmitError(errorMessage(err));
                    } finally {
                      setIsSwitchingNetwork(false);
                    }
                  }}
                >
                  {isSwitchingNetwork ? "Switching…" : "Switch to GenLayer Studio"}
                </Button>
              </div>
            )}

            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}

            <Button
              type="submit"
              variant="gradient"
              className="w-full"
              disabled={isPending || isSwitchingNetwork || !isConnected}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Posting bounty…
                </>
              ) : (
                "Lock reward & post"
              )}
            </Button>
          </form>
        )}
      </div>
    </PageShell>
  );
}
