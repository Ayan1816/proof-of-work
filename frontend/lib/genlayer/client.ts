"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { createWalletClient, custom, type WalletClient } from "viem";
import { sanitizeRpcUrl } from "./rpc";

export { sanitizeRpcUrl, DEFAULT_GENLAYER_RPC_URL } from "./rpc";

// GenLayer Network Configuration (from environment variables with fallbacks)
export const GENLAYER_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID || "61999");
// EIP-155 QUANTITY is lowercase hex. Uppercase 0xF20F makes some wallets
// (notably Rabby) fail switch/add or estimate against the wrong chain.
export const GENLAYER_CHAIN_ID_HEX = `0x${GENLAYER_CHAIN_ID.toString(16).toLowerCase()}`;

export const PUBLIC_GENLAYER_RPC_URL = sanitizeRpcUrl(
  process.env.NEXT_PUBLIC_GENLAYER_RPC_URL
);

export function getWalletRpcUrl(): string {
  // Wallet extensions cannot use the dApp's in-page fetch proxy unless we
  // register it as the chain RPC. Same-origin /api/rpc avoids Cloudflare
  // HTML on studio.genlayer.com, which makes Rabby think the GEN balance is 0.
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/api/rpc`;
  }
  return PUBLIC_GENLAYER_RPC_URL;
}

export function getGenLayerNetworkParams() {
  return {
    chainId: GENLAYER_CHAIN_ID_HEX,
    chainName: process.env.NEXT_PUBLIC_GENLAYER_CHAIN_NAME || "GenLayer Studio",
    nativeCurrency: {
      name: process.env.NEXT_PUBLIC_GENLAYER_SYMBOL || "GEN",
      symbol: process.env.NEXT_PUBLIC_GENLAYER_SYMBOL || "GEN",
      decimals: 18,
    },
    rpcUrls: [getWalletRpcUrl()],
    blockExplorerUrls: ["https://explorer-studio.genlayer.com"],
  };
}

export const GENLAYER_NETWORK = {
  chainId: GENLAYER_CHAIN_ID_HEX,
  chainName: process.env.NEXT_PUBLIC_GENLAYER_CHAIN_NAME || "GenLayer Studio",
  nativeCurrency: {
    name: process.env.NEXT_PUBLIC_GENLAYER_SYMBOL || "GEN",
    symbol: process.env.NEXT_PUBLIC_GENLAYER_SYMBOL || "GEN",
    decimals: 18,
  },
  rpcUrls: [PUBLIC_GENLAYER_RPC_URL],
  blockExplorerUrls: ["https://explorer-studio.genlayer.com"],
};

// Ethereum provider type from window
interface EthereumProvider {
  isMetaMask?: boolean;
  isPhantom?: boolean;
  isRabby?: boolean;
  providers?: EthereumProvider[];
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  removeListener: (event: string, handler: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

/**
 * Get the GenLayer RPC URL from environment variables
 */
export function getStudioUrl(): string {
  // Browser calls must go through the same-origin proxy. Direct browser
  // POSTs to studio.genlayer.com/api can receive Cloudflare HTML instead of JSON.
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/rpc`;
  }
  return PUBLIC_GENLAYER_RPC_URL;
}

/**
 * Get the contract address from environment variables
 */
function isValidContractAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

export function getContractAddress(): string {
  const address = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "").trim();
  if (!address) {
    // Return empty string during build, error will be shown in UI during runtime
    return "";
  }
  if (!isValidContractAddress(address)) {
    console.error(
      "Invalid NEXT_PUBLIC_CONTRACT_ADDRESS. Expected 0x plus 40 hex characters, got:",
      address,
      `(${address.startsWith("0x") ? address.length - 2 : address.length} hex chars)`
    );
    return "";
  }
  return address;
}

/**
 * Check if MetaMask is installed
 */
export function isMetaMaskInstalled(): boolean {
  if (typeof window === "undefined") return false;
  // Rabby, MetaMask, and other injected wallets all expose window.ethereum.
  return !!window.ethereum;
}

/**
 * Get the injected EIP-1193 provider the user is actually using.
 *
 * Do not scan providers[] for isMetaMask: Rabby also sets isMetaMask, and
 * picking a hidden MetaMask instance while the user is in Rabby sends the
 * payable create_bounty tx to the wrong wallet/chain (Rabby then shows
 * "Gas balance is not enough").
 */
export function getEthereumProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  const injected = window.ethereum;
  if (!injected) return null;
  if (typeof injected.request === "function") return injected;
  const candidates = Array.isArray(injected.providers)
    ? injected.providers
    : [injected];
  return candidates.find((provider) => typeof provider.request === "function") || null;
}

/**
 * Request accounts from MetaMask
 * @returns Array of addresses
 */
export async function requestAccounts(): Promise<string[]> {
  const provider = getEthereumProvider();

  if (!provider) {
    throw new Error("MetaMask is not installed");
  }

  try {
    const accounts = await provider.request({
      method: "eth_requestAccounts",
    });
    return accounts;
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error("User rejected the connection request");
    }
    throw new Error(`Failed to connect to MetaMask: ${error.message}`);
  }
}

/**
 * Get current MetaMask accounts without requesting permission
 * @returns Array of addresses
 */
export async function getAccounts(): Promise<string[]> {
  const provider = getEthereumProvider();

  if (!provider) {
    return [];
  }

  try {
    const accounts = await provider.request({
      method: "eth_accounts",
    });
    return accounts;
  } catch (error) {
    console.error("Error getting accounts:", error);
    return [];
  }
}

/**
 * Get the current chain ID from MetaMask
 */
export async function getCurrentChainId(): Promise<string | null> {
  const provider = getEthereumProvider();

  if (!provider) {
    return null;
  }

  try {
    const chainId = await provider.request({
      method: "eth_chainId",
    });
    return chainId;
  } catch (error) {
    console.error("Error getting chain ID:", error);
    return null;
  }
}

/**
 * Add GenLayer network to MetaMask
 */
export async function addGenLayerNetwork(): Promise<void> {
  const provider = getEthereumProvider();

  if (!provider) {
    throw new Error("MetaMask is not installed");
  }

  try {
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [getGenLayerNetworkParams()],
    });
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error("User rejected adding the network");
    }
    try {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            ...getGenLayerNetworkParams(),
            rpcUrls: [PUBLIC_GENLAYER_RPC_URL],
          },
        ],
      });
    } catch (retryErr: any) {
      if (retryErr.code === 4001) {
        throw new Error("User rejected adding the network");
      }
      throw new Error(
        `Failed to add GenLayer network: ${retryErr.message || error.message}`
      );
    }
  }
}

/**
 * Switch to GenLayer network
 */
export async function switchToGenLayerNetwork(): Promise<void> {
  const provider = getEthereumProvider();

  if (!provider) {
    throw new Error("MetaMask is not installed");
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: GENLAYER_CHAIN_ID_HEX }],
    });
  } catch (error: any) {
    const message = String(error?.message || "");
    const unrecognized =
      error.code === 4902 ||
      error.code === -32603 ||
      /unrecognized chain|chain id.*not.*added|not been added/i.test(message);
    if (unrecognized) {
      await addGenLayerNetwork();
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: GENLAYER_CHAIN_ID_HEX }],
      });
    } else if (error.code === 4001) {
      throw new Error("User rejected switching the network");
    } else {
      throw new Error(`Failed to switch network: ${error.message}`);
    }
  }
}

/**
 * Make sure the injected wallet is on GenLayer Studio before a payable write.
 * Studio's genlayer-js client skips this check (isStudio), so Rabby can
 * estimate gas on Ethereum and report "Gas balance is not enough".
 */
export async function ensureGenLayerNetwork(): Promise<void> {
  if (!(await isOnGenLayerNetwork())) {
    await switchToGenLayerNetwork();
  }
  if (!(await isOnGenLayerNetwork())) {
    throw new Error(
      "Switch your wallet to GenLayer Studio (chain ID 61999) before sending this transaction."
    );
  }
}

/**
 * Check if we're on the GenLayer network
 */
export async function isOnGenLayerNetwork(): Promise<boolean> {
  const chainId = await getCurrentChainId();

  if (!chainId) {
    return false;
  }

  // Convert both to decimal for comparison
  const currentChainIdDecimal = parseInt(chainId, 16);
  return currentChainIdDecimal === GENLAYER_CHAIN_ID;
}

/**
 * Connect to MetaMask and ensure we're on GenLayer network
 * @returns The connected address
 */
export async function connectMetaMask(): Promise<string> {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask is not installed");
  }

  // Request accounts
  const accounts = await requestAccounts();

  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts found");
  }

  // Check and switch to GenLayer network
  const onCorrectNetwork = await isOnGenLayerNetwork();

  if (!onCorrectNetwork) {
    await switchToGenLayerNetwork();
  }

  return accounts[0];
}

/**
 * Request user to switch MetaMask account
 * Shows MetaMask account picker even if already connected
 * Uses wallet_requestPermissions to force account selection dialog
 * @returns The newly selected account address
 */
export async function switchAccount(): Promise<string> {
  const provider = getEthereumProvider();

  if (!provider) {
    throw new Error("MetaMask is not installed");
  }

  try {
    // Request permissions - this shows account picker
    await provider.request({
      method: "wallet_requestPermissions",
      params: [{ eth_accounts: {} }],
    });

    // Get the newly selected account
    const accounts = await provider.request({
      method: "eth_accounts",
    });

    if (!accounts || accounts.length === 0) {
      throw new Error("No account selected");
    }

    return accounts[0];
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error("User rejected account switch");
    } else if (error.code === -32002) {
      throw new Error("Account switch request already pending");
    }
    throw new Error(`Failed to switch account: ${error.message}`);
  }
}

/**
 * Create a viem wallet client from MetaMask provider
 */
export function createMetaMaskWalletClient(): WalletClient | null {
  const provider = getEthereumProvider();

  if (!provider) {
    return null;
  }

  try {
    return createWalletClient({
      chain: studionet as any,
      transport: custom(provider),
    });
  } catch (error) {
    console.error("Error creating wallet client:", error);
    return null;
  }
}

/**
 * Create a GenLayer client with MetaMask account
 *
 * Note: The genlayer-js SDK doesn't directly support custom transports like viem.
 * When an address is provided, the SDK will use the window.ethereum provider
 * automatically for transaction signing via MetaMask.
 */
export function createGenLayerClient(address?: string) {
  const config: any = {
    chain: studionet,
    endpoint: getStudioUrl(),
  };

  if (address) {
    config.account = address as `0x${string}`;
    const provider = getEthereumProvider();
    if (provider) config.provider = provider;
  }

  try {
    return createClient(config);
  } catch (error) {
    console.error("Error creating GenLayer client:", error);
    // Return client without account on error
    return createClient({
      chain: studionet,
      endpoint: getStudioUrl(),
    });
  }
}

/**
 * Get a client instance with MetaMask account
 */
export async function getClient() {
  const accounts = await getAccounts();
  const address = accounts[0];
  return createGenLayerClient(address);
}
