export const DEFAULT_GENLAYER_RPC_URL = "https://studio.genlayer.com/api";

export function sanitizeRpcUrl(raw?: string | null): string {
  const fallback = DEFAULT_GENLAYER_RPC_URL;
  if (!raw) return fallback;
  const match = raw.match(/https?:\/\/[^\s)\]"'<>]+/i);
  const candidate = (match ? match[0] : raw).trim();
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return fallback;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      (host === "studio.genlayer.com" || host === "studio-dev.genlayer.com") &&
      (parsed.pathname === "/" || parsed.pathname === "")
    ) {
      return `${parsed.origin}/api`;
    }
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "") || fallback;
  } catch {
    return fallback;
  }
}
