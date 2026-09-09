import { readFileSync, existsSync } from "fs";
import path from "path";
import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

function loadEnv(filePath) {
  const env = {};
  if (!existsSync(filePath)) return env;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function jsonSafe(value) {
  return JSON.stringify(
    value,
    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    2
  );
}

function extractReturn(receipt) {
  const blobs = [];
  const collect = (value, depth = 0) => {
    if (depth > 8 || value == null) return;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) blobs.push(trimmed);
      return;
    }
    if (typeof value === "object") {
      for (const nested of Object.values(value)) collect(nested, depth + 1);
    }
  };
  collect(receipt?.consensus_data?.leader_receipt);
  collect(receipt?.result);
  collect(receipt?.data);
  collect(receipt?.return_value);
  for (const blob of blobs) {
    const start = blob.indexOf("{");
    const end = blob.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      return JSON.parse(blob.slice(start, end + 1));
    } catch {
      // keep scanning
    }
  }
  return null;
}

function assertAccepted(receipt, label) {
  const statusName = String(
    receipt?.statusName || receipt?.status_name || receipt?.status || ""
  ).toUpperCase();
  const execution = receipt?.consensus_data?.leader_receipt?.[0];
  const executionError =
    execution?.result?.status === "contract_error" ||
    execution?.execution_result === "ERROR";
  if (
    executionError ||
    (statusName &&
      !["ACCEPTED", "FINALIZED", "READY_TO_FINALIZE", "5", "7", "11"].includes(
        statusName
      ))
  ) {
    throw new Error(
      `${label} failed (${statusName || execution?.execution_result}). Receipt: ${jsonSafe(receipt)}`
    );
  }
}

async function fundStudioAccount(address, amountWei) {
  const res = await fetch("https://studio.genlayer.com/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sim_fundAccount",
      params: {
        account_address: address,
        amount: Number(amountWei),
      },
    }),
  });
  const body = await res.json();
  if (body.error) {
    throw new Error(`sim_fundAccount failed: ${jsonSafe(body.error)}`);
  }
  return body.result;
}

const env = loadEnv(path.resolve(process.cwd(), ".env"));
const rawKey = env.PRIVATE_KEY || env.private_key;
if (!rawKey) throw new Error("No PRIVATE_KEY in .env");
const creatorKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
const contractAddress = env.CONTRACT_ADDRESS || env.NEXT_PUBLIC_CONTRACT_ADDRESS;
if (!contractAddress) throw new Error("No CONTRACT_ADDRESS in .env — deploy first");

const creator = createAccount(creatorKey);
const contributor = createAccount(generatePrivateKey());
const creatorClient = createClient({ chain: studionet, account: creator });
const contributorClient = createClient({ chain: studionet, account: contributor });

const REWARD = 10n ** 15n; // 0.001 GEN, fits JS Number and calldata int
const TITLE = "Example Domain page";
const SPEC =
  "The submitted page must identify itself as Example Domain, a domain used in illustrative examples in documents. It should mention that it is used in documentation.";
const PROOF_LINK = "https://example.com";
const DESCRIPTION =
  "Live example.com page used as proof that the site identifies itself as Example Domain for documentation examples.";
const DEADLINE = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

async function writeAndWait(client, label, request, retries = 80, interval = 5000) {
  console.log(`\n>> ${label}`);
  const hash = await client.writeContract(request);
  console.log("tx:", hash);
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries,
    interval,
  });
  console.log("status:", receipt.status, receipt.statusName);
  assertAccepted(receipt, label);
  const decoded = extractReturn(receipt);
  if (decoded) console.log("return:", jsonSafe(decoded));
  return { hash, receipt, decoded };
}

console.log("Network: studionet");
console.log("Contract:", contractAddress);
console.log("Creator:", creator.address);
console.log("Contributor:", contributor.address);

await creatorClient.initializeConsensusSmartContract();
await contributorClient.initializeConsensusSmartContract();

const creatorBal = await creatorClient.getBalance({ address: creator.address });
console.log("Creator balance:", creatorBal.toString(), "wei");

console.log("Funding contributor via Studio faucet...");
await fundStudioAccount(contributor.address, 10n ** 15n);
const contribBal = await contributorClient.getBalance({
  address: contributor.address,
});
console.log("Contributor balance:", contribBal.toString(), "wei");

const name = await creatorClient.readContract({
  address: contractAddress,
  functionName: "get_name",
  args: [],
});
console.log("get_name:", name);
if (name !== "Proof of Work") {
  throw new Error(`Unexpected contract name: ${name}`);
}

const created = await writeAndWait(creatorClient, "create_bounty", {
  address: contractAddress,
  functionName: "create_bounty",
  args: [TITLE, SPEC, REWARD, DEADLINE],
  value: REWARD,
});
const count = await creatorClient.readContract({
  address: contractAddress,
  functionName: "get_bounty_count",
  args: [],
});
const bountyId = String(created.decoded?.id || count);
console.log("bounty id:", bountyId, "(count:", count, ")");

const afterCreate = await creatorClient.readContract({
  address: contractAddress,
  functionName: "get_bounty",
  args: [bountyId],
});
console.log("bounty after create:", jsonSafe(afterCreate));
if (afterCreate?.status !== "Open") {
  throw new Error(
    `Created bounty ${bountyId} is ${afterCreate?.status}, expected Open`
  );
}

const submitted = await writeAndWait(contributorClient, "submit_work", {
  address: contractAddress,
  functionName: "submit_work",
  args: [bountyId, PROOF_LINK, DESCRIPTION],
  value: 0n,
});
console.log("submission:", jsonSafe(submitted.decoded));

const afterSubmit = await creatorClient.readContract({
  address: contractAddress,
  functionName: "get_bounty",
  args: [bountyId],
});
console.log("bounty after submit:", jsonSafe(afterSubmit));

const judged = await writeAndWait(
  contributorClient,
  "judge_submission",
  {
    address: contractAddress,
    functionName: "judge_submission",
    args: [bountyId],
    value: 0n,
  },
  180,
  8000
);
console.log("judgment:", jsonSafe(judged.decoded));

const afterJudge = await creatorClient.readContract({
  address: contractAddress,
  functionName: "get_bounty",
  args: [bountyId],
});
console.log("bounty after judge:", jsonSafe(afterJudge));

const status = afterJudge?.status || judged.decoded?.status;
if (status === "Rejected") {
  console.log("First verdict was Rejected; appealing for a second independent judgment...");
  await writeAndWait(contributorClient, "appeal", {
    address: contractAddress,
    functionName: "appeal",
    args: [bountyId],
    value: 0n,
  });
  const rejudged = await writeAndWait(
    contributorClient,
    "judge_submission (after appeal)",
    {
      address: contractAddress,
      functionName: "judge_submission",
      args: [bountyId],
      value: 0n,
    },
    180,
    8000
  );
  const afterAppeal = await creatorClient.readContract({
    address: contractAddress,
    functionName: "get_bounty",
    args: [bountyId],
  });
  console.log("bounty after appeal judgment:", jsonSafe(afterAppeal));
  if (afterAppeal?.status !== "Approved") {
    throw new Error(
      `Expected Approved after appeal, got ${afterAppeal?.status}. Reasoning: ${afterAppeal?.verdict_reasoning}`
    );
  }
} else if (status !== "Approved") {
  throw new Error(
    `Expected Approved verdict, got ${status}. Reasoning: ${afterJudge?.verdict_reasoning}`
  );
}

const paid = await writeAndWait(contributorClient, "release_payment", {
  address: contractAddress,
  functionName: "release_payment",
  args: [bountyId],
  value: 0n,
});
console.log("payout:", jsonSafe(paid.decoded));

const finalBounty = await creatorClient.readContract({
  address: contractAddress,
  functionName: "get_bounty",
  args: [bountyId],
});
const escrowed = await creatorClient.readContract({
  address: contractAddress,
  functionName: "get_total_escrowed",
  args: [],
});
const reputation = await creatorClient.readContract({
  address: contractAddress,
  functionName: "get_reputation",
  args: [contributor.address],
});

console.log("\n=== LIFECYCLE RESULT ===");
console.log("final bounty:", jsonSafe(finalBounty));
console.log("total escrowed:", jsonSafe(escrowed));
console.log("contributor reputation:", jsonSafe(reputation));

if (finalBounty?.status !== "Paid") {
  throw new Error(`Expected Paid, got ${finalBounty?.status}`);
}
if (finalBounty?.escrow_locked) {
  throw new Error("Paid bounty still has escrow_locked=true");
}
if (Number(reputation?.approved_count || 0) < 1) {
  throw new Error(`Expected contributor approved_count >= 1, got ${jsonSafe(reputation)}`);
}

console.log("\nLIFECYCLE OK: create → submit → judge → payout");
