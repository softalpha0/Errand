/**
 * Granting and revoking Errand's session on the user's own Altana wallet, from the browser.
 *
 * The user's passkey (admin) signs. The session key is Errand's agent key: the browser only
 * has its PUBLIC key, which is all Altana's grantSession reads (SDK 1.1.0: publicKey, address).
 * The private key stays on Errand's agent server, which signs `execute` later.
 */
import type { Hex } from "viem";
import { USDT } from "@errand/celo/tokens";
import { ERRAND_AGENT, buildSessionPermissions, type SessionCaps } from "@errand/celo/session";
import type { StoredWallet } from "@/lib/wallet";

export type StoredSession = {
  walletAddress: string;
  /** serializeSession() output: public key, permissions (limits as decimal strings), expiry. No secrets. */
  session: { walletAddress: string; publicKey: Hex; permissions: unknown; expiry: number };
  grantTx?: Hex;
  keyHash?: Hex;
  grantedAt: string;
  revokeTx?: Hex;
  revokedAt?: string;
};

const KEY = "errand.celo.session.v1";

export function loadSession(walletAddress: string): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    return s.walletAddress.toLowerCase() === walletAddress.toLowerCase() ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(s: StoredSession): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // shown as "not remembered" by the caller's state; the session itself is on chain
  }
}

/** A signer object for Errand's agent with the public key only. Signing here is impossible by design. */
function agentPublicSigner() {
  return {
    type: "privateKey" as const,
    address: ERRAND_AGENT.address,
    publicKey: ERRAND_AGENT.publicKey,
    async signDigest(): Promise<Hex> {
      throw new Error("Errand's agent key is not in this browser.");
    },
  };
}

async function setup(wallet: StoredWallet) {
  const sdk = await import("@altananetwork/sdk");
  const client = sdk.createClient({ chains: [sdk.CELO], agentIdentity: false });
  const admin = sdk.signerFromPasskey(wallet.credential);
  return { sdk, client, admin, w: { address: wallet.address } };
}

export type GrantInput = { caps: SessionCaps; expiry: number };

export type QuoteView = {
  lines: string[];
  /** The relay's own words when a step can't be paid (e.g. "Not enough CELO … needs about 19.04 CELO"). */
  problems: string[];
  balances: { symbol: string; decimals: number; balance: bigint; needed: bigint; sufficient: boolean; reason?: string }[];
  complete: boolean;
};

/** What granting would cost, from Altana's relay. Nothing is signed or sent. */
export async function quoteGrant(wallet: StoredWallet, input: GrantInput): Promise<QuoteView> {
  const { sdk, client, admin, w } = await setup(wallet);
  const quote = await client.quoteGrantSession({
    wallet: w,
    signer: admin,
    permissions: buildSessionPermissions(input.caps),
    expiry: input.expiry,
    sessionSigner: agentPublicSigner(),
    feeToken: USDT.address,
  });
  return {
    lines: quote.lines.map((l) => sdk.formatQuoteLine(l, sdk.CELO)),
    problems: quote.lines
      .map((l) => sdk.formatQuoteLine(l, sdk.CELO))
      .map((text) => /could not be quoted:\s*(.*?)(?:, value .*)?$/.exec(text)?.[1])
      .filter((t): t is string => Boolean(t)),
    balances: quote.balances
      .filter((b) => b.needed > 0n || b.reason)
      .map((b) => ({ symbol: b.symbol, decimals: b.decimals, balance: b.balance, needed: b.needed, sufficient: b.sufficient, ...(b.reason ? { reason: b.reason } : {}) })),
    complete: quote.complete,
  };
}

/** One passkey prompt. Authorizes Errand's agent key on the wallet with the caps, allowlist and expiry. */
export async function grant(wallet: StoredWallet, input: GrantInput): Promise<StoredSession> {
  const { sdk, client, admin, w } = await setup(wallet);
  const result = await client.grantSession({
    wallet: w,
    signer: admin,
    permissions: buildSessionPermissions(input.caps),
    expiry: input.expiry,
    sessionSigner: agentPublicSigner(),
    feeToken: USDT.address,
  });
  if (result.status !== "granted") {
    const failed = result.legs.find((l) => l.status === "FAILED");
    throw new Error(`The session was not granted${failed ? `: ${JSON.stringify(failed).slice(0, 200)}` : "."}`);
  }
  const stored: StoredSession = {
    walletAddress: wallet.address,
    session: sdk.serializeSession(result) as StoredSession["session"],
    ...(result.transactionHash ? { grantTx: result.transactionHash } : {}),
    keyHash: result.keyHash,
    grantedAt: new Date().toISOString(),
  };
  saveSession(stored);
  return stored;
}

/** One passkey prompt. Revokes Errand's key on the wallet; a revoked key can never be used again. */
export async function revoke(wallet: StoredWallet, current: StoredSession): Promise<StoredSession> {
  const { client, admin, w } = await setup(wallet);
  const result = await client.revokeSession({ wallet: w, signer: admin, session: current.session.publicKey, feeToken: USDT.address });
  const next: StoredSession = {
    ...current,
    ...(result.transactionHash ? { revokeTx: result.transactionHash } : {}),
    revokedAt: new Date().toISOString(),
  };
  saveSession(next);
  return next;
}
