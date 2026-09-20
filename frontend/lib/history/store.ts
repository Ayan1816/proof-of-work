import {
  ACTION_LABELS,
  isHistoryAction,
  type HistoryAction,
  type HistoryItem,
  type HistoryStatus,
} from "./types";

const STORAGE_PREFIX = "pow:tx-history:v1:";
const MAX_ITEMS = 200;
const CHANGE_EVENT = "pow-tx-history";

type Listener = (wallet: string) => void;

const listeners = new Set<Listener>();

function storageKey(wallet: string): string {
  return STORAGE_PREFIX + wallet.trim().toLowerCase();
}

function safeParse(raw: string | null): HistoryItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidItem);
  } catch {
    return [];
  }
}

function isValidItem(value: unknown): value is HistoryItem {
  if (!value || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.id === "string" &&
    typeof rec.wallet === "string" &&
    isHistoryAction(String(rec.action)) &&
    typeof rec.status === "string"
  );
}

function persist(wallet: string, items: HistoryItem[]): void {
  if (typeof window === "undefined") return;
  const key = storageKey(wallet);
  const trimmed = items
    .slice()
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, MAX_ITEMS);
  window.localStorage.setItem(key, JSON.stringify(trimmed));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { wallet } }));
  listeners.forEach((fn) => fn(wallet));
}

export function loadHistory(wallet: string): HistoryItem[] {
  if (typeof window === "undefined" || !wallet) return [];
  return safeParse(window.localStorage.getItem(storageKey(wallet)));
}

export function subscribeHistory(listener: Listener): () => void {
  listeners.add(listener);
  if (typeof window === "undefined") return () => undefined;

  const onStorage = (event: StorageEvent) => {
    if (event.key && event.key.startsWith(STORAGE_PREFIX)) {
      listener(event.key.slice(STORAGE_PREFIX.length));
    }
  };
  const onCustom = (event: Event) => {
    const wallet = (event as CustomEvent<{ wallet?: string }>).detail?.wallet;
    if (wallet) listener(wallet);
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onCustom);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onCustom);
  };
}

export function createHistoryId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `tx_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function upsertHistoryItem(
  wallet: string,
  patch: Partial<HistoryItem> & { id: string; action: HistoryAction }
): HistoryItem | null {
  if (typeof window === "undefined" || !wallet) return null;
  try {
    const items = loadHistory(wallet);
    const index = items.findIndex((item) => item.id === patch.id);
    const previous = index >= 0 ? items[index] : null;
    const next: HistoryItem = {
      id: patch.id,
      wallet: wallet.trim().toLowerCase(),
      action: patch.action,
      label: patch.label || ACTION_LABELS[patch.action],
      status: (patch.status || previous?.status || "pending") as HistoryStatus,
      amountWei: patch.amountWei ?? previous?.amountWei ?? "0",
      gasUsed: patch.gasUsed ?? previous?.gasUsed ?? "",
      gasFeeWei: patch.gasFeeWei ?? previous?.gasFeeWei ?? "",
      hash: patch.hash ?? previous?.hash ?? "",
      bountyId: patch.bountyId ?? previous?.bountyId ?? "",
      title: patch.title ?? previous?.title ?? "",
      timestamp: patch.timestamp ?? previous?.timestamp ?? Date.now(),
      source: patch.source || previous?.source || "wallet",
      error: patch.error ?? previous?.error,
    };
    if (index >= 0) items[index] = next;
    else items.unshift(next);
    persist(wallet, items);
    return next;
  } catch (err) {
    console.warn("Could not persist transaction history", err);
    return null;
  }
}

export function recordHistoryFailure(
  wallet: string,
  id: string,
  action: HistoryAction,
  error: string
): void {
  upsertHistoryItem(wallet, {
    id,
    action,
    status: "failed",
    error,
  });
}
