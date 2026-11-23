/**
 * Browser-side helpers for the user's own Altana wallet on Celo mainnet.
 *
 * What is stored in this browser: the wallet address and the passkey's PUBLIC handle
 * ({ kind, id, publicKey, rpId }). The passkey's private key never leaves the device's
 * secure hardware, and Errand never sees it. Altana never persists keys either.
 *
 * Sources: Altana SDK 1.1.0 (createPasskeyWallet, recoverFromPasskey, signerFromPasskey,
 * KeyStore getKeys / KeyStoreController getRegistrationFeeInWei), docs/celo/SPONSORS.md §1 and §5.
 */
import { createPublicClient, fallback, http, type Address, type Hex } from "viem";
import { celo } from "viem/chains";
import { CNGN, USDT, erc20Abi } from "@errand/celo/tokens";

/** Altana on Celo (SPONSORS.md §5; same values as the SDK's CELO network config). */
export const ALTANA_CELO = {
  keyStore: "0x83b30935f36d6ccf9B1ec3b5E47F2866b97cd27c",
  keyStoreController: "0x47bA5fc2A5b0CcB24BA3fAC9D4B59400eE9fd1D6",
} as const;

/** The SDK sends the registration fee plus 10% (REGISTRATION_FEE_MARGIN_PERCENT); the controller refunds the excess. */
const FEE_MARGIN_PERCENT = 110n;

const keyStoreAbi = [
  { type: "function", name: "getKeys", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "bytes32[]" }] },
] as const;
const controllerAbi = [
  { type: "function", name: "getRegistrationFeeInWei", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export const publicClient = createPublicClient({
  chain: celo,
  transport: fallback([http("https://forno.celo.org"), http("https://celo-rpc.publicnode.com")]),
});

export type StoredWallet = {
  address: Address;
  credential: { kind: "webauthn"; id: string; publicKey: Hex; rpId?: string };
  createdAt: string;
};

const STORAGE_KEY = "errand.celo.wallet.v1";

export function loadWallet(): StoredWallet | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredWallet;
    if (!parsed?.address || parsed.credential?.kind !== "webauthn") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Returns false when this browser can't keep it (private window, blocked storage). */
export function saveWallet(wallet: StoredWallet): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wallet));
    return true;
  } catch {
    return false;
  }
}

export function forgetWallet(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing stored, nothing to remove
  }
}

export function passkeysSupported(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential === "function" && !!navigator.credentials;
}

async function altanaClient() {
  const { createClient, CELO } = await import("@altananetwork/sdk");
  // agentIdentity false: a user's wallet is not an agent. Only Errand's agent is (PRD §5).
  return createClient({ chains: [CELO], agentIdentity: false });
}

/** Prompts for a new passkey and sets up the wallet. No transaction, no cost. */
export async function createWallet(): Promise<StoredWallet> {
  const client = await altanaClient();
  const result = await client.createPasskeyWallet({ name: "Errand" });
  const credential = result.signer.credential;
  if (credential.kind !== "webauthn") throw new Error("Unexpected passkey type.");
  return { address: result.address, credential: { ...credential }, createdAt: new Date().toISOString() };
}

/** Finds a wallet from a passkey on this device. Works only after the wallet's first transaction. */
export async function recoverWallet(): Promise<StoredWallet> {
  const client = await altanaClient();
  const result = await client.recoverFromPasskey();
  const credential = result.signer.credential;
  if (credential.kind !== "webauthn") throw new Error("Unexpected passkey type.");
  return { address: result.address, credential: { ...credential }, createdAt: new Date().toISOString() };
}

export type WalletState = {
  usdt: bigint;
  cngn: bigint;
  celo: bigint;
  /** True once the wallet's admin passkey is registered in Altana's KeyStore (after its first transaction). */
  registered: boolean;
  /**
   * CELO the first session grant must carry: two KeyStore registrations (the user's passkey and
   * Errand's session key), each the fee + the SDK's 10% margin (excess refunded). Confirmed by the
   * relay's own quote on 23 Nov 2026: "needs about 19.04 CELO" when the fee was 8.65 CELO.
   */
  setupCeloNeeded: bigint;
  /** The fee itself, as the controller quotes it now. */
  setupFee: bigint;
};

export async function readWalletState(address: Address): Promise<WalletState> {
  const [usdt, cngn, celoBalance, keys, fee] = await Promise.all([
    publicClient.readContract({ address: USDT.address, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
    publicClient.readContract({ address: CNGN.address, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
    publicClient.getBalance({ address }),
    publicClient.readContract({ address: ALTANA_CELO.keyStore, abi: keyStoreAbi, functionName: "getKeys", args: [address] }),
    publicClient.readContract({ address: ALTANA_CELO.keyStoreController, abi: controllerAbi, functionName: "getRegistrationFeeInWei" }),
  ]);
  return {
    usdt,
    cngn,
    celo: celoBalance,
    registered: keys.length > 0,
    setupFee: fee,
    setupCeloNeeded: (2n * fee * FEE_MARGIN_PERCENT) / 100n,
  };
}

/** A small JSON file the user can keep: public data only, useless without their passkey. */
export function backupFile(wallet: StoredWallet): Blob {
  const body = {
    what: "Errand wallet backup (public data only). It cannot move money without your passkey.",
    network: "Celo mainnet (42220)",
    address: wallet.address,
    passkey: wallet.credential,
    createdAt: wallet.createdAt,
    howToRestore: "Open the Errand wallet page and choose 'Restore from backup file'.",
  };
  return new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
}

export function parseBackup(text: string): StoredWallet {
  const data = JSON.parse(text) as { address?: Address; passkey?: StoredWallet["credential"]; createdAt?: string };
  if (!data.address || !/^0x[0-9a-fA-F]{40}$/.test(data.address)) throw new Error("This file has no wallet address.");
  if (data.passkey?.kind !== "webauthn" || !data.passkey.id || !data.passkey.publicKey) throw new Error("This file has no passkey details.");
  return { address: data.address, credential: data.passkey, createdAt: data.createdAt ?? new Date().toISOString() };
}

/** Plain-language message for errors thrown by WebAuthn, the SDK or the RPC. */
export function explainError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/NotAllowedError|cancel|aborted|timed out/i.test(message)) return "The passkey prompt was closed before it finished. Try again when you're ready.";
  if (/no keys registered in KeyStore/i.test(message))
    return "That passkey belongs to a wallet that hasn't made its first transaction yet, so it can't be found on Celo. Use the backup file from when you created it, or the browser you created it in.";
  if (/No passkey selected/i.test(message)) return "No passkey was picked.";
  if (/userHandle/i.test(message)) return "That passkey wasn't made by an Errand wallet. Pick the one named Errand.";
  if (/fetch|network|Failed to fetch/i.test(message)) return "Couldn't reach Celo or Altana. Check your connection and try again.";
  return message.length > 220 ? `${message.slice(0, 220)}…` : message;
}
