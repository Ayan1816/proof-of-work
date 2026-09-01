"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import RoyArena from "../contracts/RoyArena";
import { getContractAddress, getStudioUrl } from "../genlayer/client";
import type { FeePresetLevel } from "../genlayer/fees";
import { useWallet } from "../genlayer/wallet";
import { success, error, configError } from "../utils/toast";
import type { ArenaCategory, LeaderboardEntry, Submission } from "../contracts/types";

export function useRoyArenaContract(): RoyArena | null {
  const { address } = useWallet();
  const contractAddress = getContractAddress();
  const studioUrl = getStudioUrl();

  const contract = useMemo(() => {
    if (!contractAddress) {
      configError(
        "Setup Required",
        "Contract address not configured. Please set NEXT_PUBLIC_CONTRACT_ADDRESS in your .env file.",
        {
          label: "Setup Guide",
          onClick: () => window.open("/docs/setup", "_blank"),
        }
      );
      return null;
    }

    return new RoyArena(contractAddress, address, studioUrl);
  }, [contractAddress, address, studioUrl]);

  return contract;
}

export function useSubmissions() {
  const contract = useRoyArenaContract();

  return useQuery<Submission[], Error>({
    queryKey: ["submissions"],
    queryFn: () => {
      if (!contract) {
        return Promise.resolve([]);
      }
      return contract.getSubmissions();
    },
    refetchOnWindowFocus: true,
    refetchInterval: 8000,
    staleTime: 2000,
    enabled: !!contract,
  });
}

export function usePlayerPoints(address: string | null) {
  const contract = useRoyArenaContract();

  return useQuery<number, Error>({
    queryKey: ["playerPoints", address],
    queryFn: () => {
      if (!contract) {
        return Promise.resolve(0);
      }
      return contract.getPlayerPoints(address);
    },
    refetchOnWindowFocus: true,
    enabled: !!address && !!contract,
    staleTime: 2000,
    refetchInterval: 8000,
  });
}

export function useLeaderboard() {
  const contract = useRoyArenaContract();

  return useQuery<LeaderboardEntry[], Error>({
    queryKey: ["leaderboard"],
    queryFn: () => {
      if (!contract) {
        return Promise.resolve([]);
      }
      return contract.getLeaderboard();
    },
    refetchOnWindowFocus: true,
    refetchInterval: 8000,
    staleTime: 2000,
    enabled: !!contract,
  });
}

export function useSubmitEntry() {
  const contract = useRoyArenaContract();
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  const mutation = useMutation({
    mutationFn: async ({
      category,
      content,
      claim,
      deadline,
      evidenceUrl,
      feePresetLevel,
    }: {
      category: ArenaCategory;
      content: string;
      claim: string;
      deadline: string;
      evidenceUrl: string;
      feePresetLevel?: FeePresetLevel;
    }) => {
      if (!contract) {
        throw new Error(
          "Contract not configured. Please set NEXT_PUBLIC_CONTRACT_ADDRESS in your .env file."
        );
      }
      if (!address) {
        throw new Error("Wallet not connected. Please connect your wallet to submit.");
      }
      setIsCreating(true);
      const projection = { claim, deadline, evidenceUrl };
      const feePreset = await contract.estimateSubmitFees(
        address,
        category,
        content,
        projection,
        feePresetLevel ?? "standard"
      );
      return contract.submitEntry(address, category, content, projection, feePreset);
    },
    onSuccess: async (receipt) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["submissions"] }),
        queryClient.invalidateQueries({ queryKey: ["playerPoints"] }),
        queryClient.invalidateQueries({ queryKey: ["leaderboard"] }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["submissions"], type: "all" }),
        queryClient.refetchQueries({ queryKey: ["playerPoints"], type: "all" }),
        queryClient.refetchQueries({ queryKey: ["leaderboard"], type: "all" }),
      ]);
      const score = receipt?.judgment?.score;
      const feedback = receipt?.judgment?.feedback;
      success("Submission judged!", {
        description:
          score != null
            ? `Score ${score}/10${feedback ? ` — ${feedback}` : ""}`
            : "The AI judge recorded your score on-chain.",
      });
    },
    onError: (err: any) => {
      console.error("Error submitting entry:", err);
      const message =
        err?.shortMessage ||
        err?.cause?.message ||
        err?.message ||
        "The submission did not save. Please try again.";
      error("Submission failed", {
        description: message,
      });
    },
    onSettled: () => {
      setIsCreating(false);
    },
  });

  return {
    ...mutation,
    isCreating,
    submitEntry: mutation.mutate,
    submitEntryAsync: mutation.mutateAsync,
  };
}

export function useResolveProjection() {
  const contract = useRoyArenaContract();
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const [isResolving, setIsResolving] = useState(false);

  const mutation = useMutation({
    mutationFn: async ({
      subId,
      feePresetLevel,
    }: {
      subId: string;
      feePresetLevel?: FeePresetLevel;
    }) => {
      if (!contract) {
        throw new Error(
          "Contract not configured. Please set NEXT_PUBLIC_CONTRACT_ADDRESS in your .env file."
        );
      }
      if (!address) {
        throw new Error("Wallet not connected. Please connect your wallet to resolve.");
      }
      setIsResolving(true);
      const feePreset = await contract.estimateResolveFees(
        subId,
        feePresetLevel ?? "standard"
      );
      return contract.resolveProjection(subId, feePreset);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["submissions"] }),
        queryClient.invalidateQueries({ queryKey: ["leaderboard"] }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["submissions"], type: "all" }),
        queryClient.refetchQueries({ queryKey: ["leaderboard"], type: "all" }),
      ]);
      success("Projection resolved", {
        description: "Validators independently re-fetched the evidence URL.",
      });
    },
    onError: (err: any) => {
      console.error("Error resolving projection:", err);
      const message =
        err?.shortMessage ||
        err?.cause?.message ||
        err?.message ||
        "The projection could not be resolved. Please try again.";
      error("Resolve failed", {
        description: message,
      });
    },
    onSettled: () => {
      setIsResolving(false);
    },
  });

  return {
    ...mutation,
    isResolving,
    resolveProjection: mutation.mutate,
    resolveProjectionAsync: mutation.mutateAsync,
  };
}
