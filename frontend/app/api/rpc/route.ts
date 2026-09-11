const UPSTREAM =
  process.env.GENLAYER_RPC_URL ||
  process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ||
  "https://studio.genlayer.com/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxy(body: string): Promise<Response> {
  const res = await fetch(UPSTREAM, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  });
  const text = await res.text();
  if (text.trimStart().startsWith("<")) {
    return Response.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message: `GenLayer RPC at ${UPSTREAM} returned HTML instead of JSON.`,
        },
      },
      { status: 502 }
    );
  }
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") || "application/json",
    },
  });
}

export async function POST(request: Request) {
  return proxy(await request.text());
}

export async function GET() {
  return proxy(
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] })
  );
}
