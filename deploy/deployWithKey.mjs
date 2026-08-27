import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { createClient, createAccount } from "genlayer-js";
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

function upsertEnv(filePath, updates) {
  let content = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  if (content && !content.endsWith("\n")) content += "\n";
  for (const [key, value] of Object.entries(updates)) {
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(content)) {
      content = content.replace(re, `${key}=${value}`);
    } else {
      content += `${key}=${value}\n`;
    }
  }
  writeFileSync(filePath, content);
}

function jsonSafe(value) {
  return JSON.stringify(
    value,
    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    2
  );
}

const rootEnvPath = path.resolve(process.cwd(), ".env");
const frontendEnvPath = path.resolve(process.cwd(), "frontend/.env");
const env = loadEnv(rootEnvPath);

const rawKey =
  env.PRIVATE_KEY ||
  env.private_key ||
  env.ACCOUNT_PRIVATE_KEY_1;
if (!rawKey) {
  throw new Error("No private key found in .env (PRIVATE_KEY / private_key)");
}
const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`);

const contractPath = path.resolve(process.cwd(), "contracts/roy_arena.py");
const account = createAccount(privateKey);
const client = createClient({
  chain: studionet,
  account,
});

console.log("Network: studionet (https://studio.genlayer.com/api)");
console.log("Deployer:", account.address);
console.log("Contract:", contractPath);

const balance = await client.getBalance({ address: account.address });
console.log("Balance:", balance.toString(), "wei");

await client.initializeConsensusSmartContract();

const contractCode = new Uint8Array(readFileSync(contractPath));
console.log("Contract bytes:", contractCode.length);

console.log("Sending deploy transaction...");
const deployTransaction = await client.deployContract({
  code: contractCode,
  args: [],
});
console.log("Deploy tx:", deployTransaction);

const receipt = await client.waitForTransactionReceipt({
  hash: deployTransaction,
  status: TransactionStatus.ACCEPTED,
  retries: 200,
});

console.log("Receipt status:", receipt.status, receipt.statusName);
console.log("Receipt:", jsonSafe(receipt));

const execution = receipt.consensus_data?.leader_receipt?.[0];
const executionError =
  execution?.result?.status === "contract_error" ||
  execution?.execution_result === "ERROR";

if (
  (receipt.status !== 5 &&
    receipt.status !== 6 &&
    receipt.statusName !== "ACCEPTED" &&
    receipt.statusName !== "FINALIZED") ||
  executionError
) {
  throw new Error(
    `Deployment failed (${execution?.result?.payload || execution?.execution_result || receipt.statusName}). Receipt: ${jsonSafe(receipt)}`
  );
}

const deployedContractAddress =
  receipt.data?.contract_address ||
  receipt.txDataDecoded?.contractAddress ||
  receipt.contractAddress;

if (!deployedContractAddress) {
  throw new Error(`Could not extract contract address from receipt: ${jsonSafe(receipt)}`);
}

console.log("Contract deployed at:", deployedContractAddress);

upsertEnv(rootEnvPath, {
  private_key: privateKey,
  PRIVATE_KEY: privateKey,
  CONTRACT_ADDRESS: deployedContractAddress,
  NEXT_PUBLIC_CONTRACT_ADDRESS: deployedContractAddress,
  NEXT_PUBLIC_GENLAYER_RPC_URL: "https://studio.genlayer.com/api",
  NEXT_PUBLIC_GENLAYER_CHAIN_ID: "61999",
  NEXT_PUBLIC_GENLAYER_CHAIN_NAME: "GenLayer Studio",
  NEXT_PUBLIC_GENLAYER_SYMBOL: "GEN",
});

upsertEnv(frontendEnvPath, {
  NEXT_PUBLIC_GENLAYER_RPC_URL: "https://studio.genlayer.com/api",
  NEXT_PUBLIC_GENLAYER_CHAIN_ID: "61999",
  NEXT_PUBLIC_GENLAYER_CHAIN_NAME: "GenLayer Studio",
  NEXT_PUBLIC_GENLAYER_SYMBOL: "GEN",
  NEXT_PUBLIC_CONTRACT_ADDRESS: deployedContractAddress,
});

console.log("Wrote contract address and private key to .env and frontend/.env");
