function asText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return value.trim();
  return "";
}

function leaderReceipt(receipt: any): Record<string, unknown> | null {
  const leader = receipt?.consensus_data?.leader_receipt;
  const rec = Array.isArray(leader) ? leader[0] : leader;
  if (rec && typeof rec === "object") return rec as Record<string, unknown>;
  return null;
}

export function extractGasUsed(receipt: any): string {
  const leader = leaderReceipt(receipt);
  const candidates = [
    receipt?.gasUsed,
    receipt?.gas_used,
    receipt?.gas,
    leader?.gas_used,
    leader?.gasUsed,
  ];
  for (const value of candidates) {
    const text = asText(value);
    if (text && text !== "0") return text;
  }
  const fallback = asText(candidates.find((value) => asText(value)));
  return fallback;
}

export function extractGasFeeWei(receipt: any, gasUsed: string): string {
  const price = asText(
    receipt?.effectiveGasPrice ?? receipt?.gasPrice ?? receipt?.gas_price
  );
  if (gasUsed && price) {
    try {
      return (BigInt(gasUsed) * BigInt(price)).toString();
    } catch {
      // fall through
    }
  }
  const fee = asText(
    receipt?.fee ?? receipt?.txFee ?? receipt?.transactionFee
  );
  return fee;
}

export function extractReceiptHash(receipt: any, fallback: string): string {
  const hash = asText(
    receipt?.hash || receipt?.transactionHash || receipt?.tx_hash || fallback
  );
  return hash;
}
