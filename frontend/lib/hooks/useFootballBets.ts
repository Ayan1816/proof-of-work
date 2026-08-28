"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import FootballBets from "../contracts/FootballBets";
import { getContractAddress, getStudioUrl } from "../genlayer/client";
import type { FeePresetLevel } from "../genlayer/fees";
import { useWallet } from "../genlayer/wallet";
import { success, error, configError } from "../utils/toast";
import type { ArenaCategory, LeaderboardEntry, Submission } from "../contracts/types";

export function useFootballBetsContract(): FootballBets | null {
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

    return new FootballBets(contractAddress, address, studioUrl);
  }, [contractAddress, address, studioUrl]);

  return contract;
}

export function useBets() {
  const contract = useFootballBetsContract();

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
  const contract = useFootballBetsContract();

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
  const contract = useFootballBetsContract();

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

export function useCreateBet() {
  const contract = useFootballBetsContract();
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  const mutation = useMutation({
    mutationFn: async ({
      category,
      content,
      feePresetLevel,
    }: {
      category: ArenaCategory;
      content: string;
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
      const feePreset = await contract.estimateSubmitFees(
        address,
        category,
        content,
        feePresetLevel ?? "standard"
      );
      return contract.submitEntry(address, category, content, feePreset);
    },
    onSuccess: async (receipt) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["submissions"] }),
        queryClient.invalidateQueries({ queryKey: ["playerPoints"] }),
        queryClient.invalidateQueries({ queryKey: ["leaderboard"] }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["submissions"] }),
        queryClient.refetchQueries({ queryKey: ["playerPoints"] }),
        queryClient.refetchQueries({ queryKey: ["leaderboard"] }),
      ]);
      setIsCreating(false);
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
      setIsCreating(false);
      error("Failed to submit entry", {
        description: err?.message || "Please try again.",
      });
    },
  });

  return {
    ...mutation,
    isCreating,
    createBet: mutation.mutate,
    createBetAsync: mutation.mutateAsync,
  };
}
