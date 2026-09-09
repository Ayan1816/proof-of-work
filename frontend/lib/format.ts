import type { BountyStatus } from "./contracts/types";

export const GEN_DECIMALS = 18n;

export function formatGen(wei: bigint | number | string): string {
  const value = BigInt(wei || 0);
  const whole = value / 10n ** GEN_DECIMALS;
  const frac = value % 10n ** GEN_DECIMALS;
  if (frac === 0n) return whole.toString();
  const padded = frac.toString().padStart(18, "0").replace(/0+$/, "");
  return `${whole}.${padded}`;
}

export function parseGen(input: string): bigint {
  const cleaned = input.trim();
  if (!cleaned) throw new Error("Reward is required");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    throw new Error("Reward must be a number");
  }
  const [whole, frac = ""] = cleaned.split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole || "0") * 10n ** GEN_DECIMALS + BigInt(fracPadded || "0");
}

export function formatDeadline(unix: number, locale: string): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function isExpired(unix: number): boolean {
  return unix > 0 && unix * 1000 < Date.now();
}

export const STATUS_STYLES: Record<BountyStatus, string> = {
  Open: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  InReview: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Approved: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  Rejected: "bg-red-500/15 text-red-300 border-red-500/30",
  Paid: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  Appealed: "bg-orange-500/15 text-orange-300 border-orange-500/30",
};

export function sameWallet(a?: string, b?: string): boolean {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}
