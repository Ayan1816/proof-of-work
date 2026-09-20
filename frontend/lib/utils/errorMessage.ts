export function errorMessage(
  err: unknown,
  fallback = "Something went wrong"
): string {
  if (err instanceof Error && err.message) {
    return humanizeWalletError(err.message);
  }
  if (typeof err === "string" && err.trim()) {
    return humanizeWalletError(err);
  }
  const anyErr = err as {
    shortMessage?: string;
    message?: string;
    cause?: { message?: string };
  } | null;
  const raw =
    anyErr?.shortMessage ||
    anyErr?.cause?.message ||
    anyErr?.message ||
    fallback;
  return humanizeWalletError(raw);
}

export function humanizeWalletError(raw: string): string {
  const text = String(raw || "").replace(/\s+/g, " ").trim();
  if (!text) return "Something went wrong";
  if (
    /gas balance is not enough|insufficient funds|insufficient balance|exceeds allowance|intrinsic gas too low/i.test(
      text
    )
  ) {
    return (
      "Not enough GEN for the reward plus network fees, or the wallet is on the wrong network. " +
      "Switch to GenLayer Studio (chain ID 61999) and keep a little GEN extra beyond the bounty reward."
    );
  }
  if (/user rejected|rejected the request|denied transaction/i.test(text)) {
    return "Transaction cancelled in the wallet.";
  }
  if (/unrecognized chain|chain id|wrong network|not been added/i.test(text)) {
    return "Switch your wallet to GenLayer Studio (chain ID 61999) and try again.";
  }
  return text;
}
