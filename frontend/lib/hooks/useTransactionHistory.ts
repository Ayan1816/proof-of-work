"use client";

import { useEffect, useMemo, useState } from "react";
import { useBounties } from "./useProofOfWork";
import { useWallet } from "../genlayer/wallet";
import { loadHistory, subscribeHistory } from "../history/store";
import { historyFromBounties, mergeHistory } from "../history/merge";
import type { HistoryAction, HistoryItem, HistoryStatus } from "../history/types";

export function useLocalHistory(address: string | null) {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (!address) {
      setItems([]);
      return;
    }
    setItems(loadHistory(address));
    return subscribeHistory((wallet) => {
      if (wallet.toLowerCase() === address.toLowerCase()) {
        setItems(loadHistory(address));
      }
    });
  }, [address]);

  return items;
}

export function useTransactionHistory() {
  const { address, isConnected } = useWallet();
  const local = useLocalHistory(isConnected ? address : null);
  const { data: bounties = [], isLoading, isError, error, refetch } = useBounties();

  const items = useMemo(() => {
    if (!address || !isConnected) return [];
    return mergeHistory(local, historyFromBounties(bounties, address));
  }, [address, isConnected, local, bounties]);

  return {
    items,
    isLoading,
    isError,
    error,
    refetch,
    address: isConnected ? address : null,
  };
}

export function filterHistory(
  items: HistoryItem[],
  action: "all" | HistoryAction,
  status: "all" | HistoryStatus
): HistoryItem[] {
  return items.filter((item) => {
    if (action !== "all" && item.action !== action) return false;
    if (status !== "all" && item.status !== status) return false;
    return true;
  });
}
