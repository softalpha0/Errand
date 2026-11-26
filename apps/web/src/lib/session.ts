/**
 * Granting, using and revoking Errand's session on the user's own Altana wallet, all in the browser.
 *
 * The user's passkey (admin) grants the session to a **session key created on this device**
 * (AGENTS.md → Decisions, 27 Nov). Errand's errand logic runs here and signs `execute` with that key,
 * so no Errand server ever holds a key that can move user money. The key can only do what the
 * session allows on chain: the daily caps, the three allowed calls, until the expiry. Revoking it
 * (one passkey prompt) ends it for good.
 *
 * Every `execute` carries the ERC-8021 tag `altana,celo_511bb691f2f0` (Altana SDK 1.2.0 `appCode`).
 * Grant and revoke transactions are still untagged in SDK 1.2.0.
 */
import { generatePrivateKey } from "viem/accounts";
import type { Address, Hex } from "viem";
import { attributionCode } from "@errand/celo/attribution";
import { USDT } from "@errand/celo/tokens";
import { buildSessionPermissions, type SessionCaps } from "@errand/celo/session";
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
  /**
   * The session key's private key, created on this device at grant time. It never leaves this
   * browser. Its power is bounded on chain by the session (caps, allowlist, expiry) and ends on revoke.
   */
  deviceKey?: Hex;
};

/** True if a stored session can still be used: not revoked, not expired, and its key is on this device. */
export function sessionUsable(s: StoredSession | null, nowMs = Date.now()): s is StoredSession & { deviceKey: Hex } {
  return Boolean(s && s.deviceKey && !s.revokedAt && s.session.expiry * 1000 > nowMs);
}

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

/** The Altana client every Errand call uses: Celo, no automatic agent registry entry, Errand's tag on every execute. */
async function altana() {
  const sdk = await import("@altananetwork/sdk");
  const client = sdk.createClient({ chains: [sdk.CELO], agentIdentity: false, appCode: attributionCode() });
  return { sdk, client };
}

async function setup(wallet: StoredWallet) {
  const { sdk, client } = await altana();
  const admin = sdk.signerFromPasskey(wallet.credential);
  return { sdk, client, admin, w: { address: wallet.address } };
}

/** The session key for a grant: reuse an unused key from an earlier attempt on this device, or create one. */
function deviceKeyFor(walletAddress: string): Hex {
  const prior = loadSession(walletAddress);
  if (prior?.deviceKey && !prior.grantTx) return prior.deviceKey;
  return generatePrivateKey();
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
    sessionSigner: sdk.signerFromPrivateKey(generatePrivateKey()), // a throwaway key: a quote signs nothing
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

/** One passkey prompt. Authorizes a new session key from this device on the wallet, with the caps, allowlist and expiry. */
export async function grant(wallet: StoredWallet, input: GrantInput): Promise<StoredSession> {
  const { sdk, client, admin, w } = await setup(wallet);
  const deviceKey = deviceKeyFor(wallet.address);
  // Remember the key before granting, so a grant that lands but whose answer is lost isn't orphaned.
  saveSession({ walletAddress: wallet.address, session: { walletAddress: wallet.address, publicKey: "0x", permissions: {}, expiry: 0 }, grantedAt: new Date().toISOString(), deviceKey });
  const result = await client.grantSession({
    wallet: w,
    signer: admin,
    permissions: buildSessionPermissions(input.caps),
    expiry: input.expiry,
    sessionSigner: sdk.signerFromPrivateKey(deviceKey),
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
    deviceKey,
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

export type ExecuteOutcome = { status: "CONFIRMED" | "FAILED" | "PENDING"; transactionHash?: Hex; feeToken?: Address; detail?: string };

/**
 * Sends calls from the user's Altana wallet under the session, signed by this device's session key.
 * No prompt: the session's on-chain rules decide. The network fee is paid in USD₮ from the session's
 * USD₮ allowance. Altana returns FAILED instead of throwing, so the status is always checked by the caller.
 */
export async function executeWithSession(stored: StoredSession & { deviceKey: Hex }, calls: { to: Address; data: Hex }[]): Promise<ExecuteOutcome> {
  const { sdk, client } = await altana();
  const session = sdk.deserializeSession(stored.session as never, sdk.signerFromPrivateKey(stored.deviceKey));
  const result = await client.execute({ session, calls: calls.map((c) => ({ ...c, value: 0n })), feeToken: USDT.address });
  return {
    status: result.status,
    ...(result.transactionHash ? { transactionHash: result.transactionHash } : {}),
    ...(result.feeToken ? { feeToken: result.feeToken } : {}),
  };
}
