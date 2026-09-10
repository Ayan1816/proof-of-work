"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import ProofOfWork from "../contracts/ProofOfWork";
import { getContractAddress, getStudioUrl } from "../genlayer/client";
import { useWallet } from "../genlayer/wallet";
import { success, error, configError } from "../utils/toast";
import type { Bounty, Reputation, Submission } from "../contracts/types";

export function useProofOfWorkContract(): ProofOfWork | null {
  const { address } = useWallet();
  const contractAddress = getContractAddress();
  const studioUrl = getStudioUrl();

  useEffect(() => {
    if (!contractAddress) {
      configError(
        "Setup required",
        "Set NEXT_PUBLIC_CONTRACT_ADDRESS in frontend/.env to the deployed Proof of Work contract."
      );
    }
  }, [contractAddress]);

  return useMemo(() => {
    if (!contractAddress) return null;
    return new ProofOfWork(contractAddress, address, studioUrl);
  }, [contractAddress, address, studioUrl]);
}

export function useBounties() {
  const contract = useProofOfWorkContract();
  return useQuery<Bounty[], Error>({
    queryKey: ["bounties"],
    queryFn: () => (contract ? contract.listBounties() : Promise.resolve([])),
    enabled: !!contract,
    refetchInterval: 12000,
    staleTime: 4000,
  });
}

export function useBounty(id: string | undefined) {
  const contract = useProofOfWorkContract();
  return useQuery<Bounty, Error>({
    queryKey: ["bounty", id],
    queryFn: () => {
      if (!contract) throw new Error("Contract not configured");
      if (!id) throw new Error("Bounty id is required");
      return contract.getBounty(id);
    },
    enabled: !!contract && !!id,
    refetchInterval: 8000,
  });
}

export function useSubmission(id: string | undefined) {
  const contract = useProofOfWorkContract();
  return useQuery<Submission | null, Error>({
    queryKey: ["submission", id],
    queryFn: () => {
      if (!contract || !id) return Promise.resolve(null);
      return contract.getSubmission(id);
    },
    enabled: !!contract && !!id,
  });
}

export function useReputation(address: string | null) {
  const contract = useProofOfWorkContract();
  return useQuery<Reputation, Error>({
    queryKey: ["reputation", address],
    queryFn: () => {
      if (!contract || !address) {
        return Promise.resolve({ approvedCount: 0, rejectedCount: 0 });
      }
      return contract.getReputation(address);
    },
    enabled: !!contract && !!address,
    refetchInterval: 12000,
  });
}

function useContractMutation<T>(
  fn: (contract: ProofOfWork, input: T) => Promise<unknown>,
  messages: { success: string; error: string }
) {
  const contract = useProofOfWorkContract();
  const { address } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: T) => {
      if (!contract) throw new Error("Contract not configured.");
      if (!address) throw new Error("Connect your wallet first.");
      return fn(contract, input);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["bounties"] }),
        queryClient.invalidateQueries({ queryKey: ["bounty"] }),
        queryClient.invalidateQueries({ queryKey: ["submission"] }),
        queryClient.invalidateQueries({ queryKey: ["reputation"] }),
      ]);
      success(messages.success);
    },
    onError: (err: any) => {
      error(messages.error, {
        description:
          err?.shortMessage || err?.cause?.message || err?.message || "Try again.",
      });
    },
  });
}

export function useCreateBounty() {
  return useContractMutation(
    (
      c,
      input: { title: string; spec: string; rewardWei: bigint; deadline: number }
    ) => c.createBounty(input.title, input.spec, input.rewardWei, input.deadline),
    { success: "Bounty posted", error: "Could not post bounty" }
  );
}

export function useSubmitWork() {
  return useContractMutation(
    (
      c,
      input: { bountyId: string; proofLink: string; description: string }
    ) => c.submitWork(input.bountyId, input.proofLink, input.description),
    { success: "Work submitted", error: "Could not submit work" }
  );
}

export function useJudgeSubmission() {
  return useContractMutation(
    (c, bountyId: string) => c.judgeSubmission(bountyId),
    { success: "Verdict recorded", error: "Judgment failed" }
  );
}

export function useReleasePayment() {
  return useContractMutation(
    (c, bountyId: string) => c.releasePayment(bountyId),
    { success: "Payment released", error: "Could not release payment" }
  );
}

export function useAppeal() {
  return useContractMutation(
    (c, bountyId: string) => c.appeal(bountyId),
    { success: "Appeal filed", error: "Could not appeal" }
  );
}
