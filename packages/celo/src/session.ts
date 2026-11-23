import type { Address, Hex } from "viem";
import { CNGN, USDT } from "./tokens.js";

/**
 * Errand's agent: the session key every user grants (PRD §5, AGENTS.md → Decisions).
 * The public key was recovered from the signature on the agent's ERC-8004 registration tx
 * (0x8b6048637d36104e7c89d85efee0e1be8e9696fa7f00e485b79b9ee76f162b7c) and maps to the address below.
 * The private key never leaves the agent's server.
 */
export const ERRAND_AGENT = {
  address: "0xc64d2153Bd39053913667A5c2eec8250d8AbC005" as Address,
  publicKey:
    "0x0460283be48eb081badc077d501a399f4e4b09a1256b6c2200322c32d2faef5a315fdfaff1fbb9d719375e799f564735bb273ad5d97e4004522962d01c75296ac7" as Hex,
} as const;

/** Textile FX LimitOrderReactor on Celo: the swap transaction's `to` and the approval's spender (SPONSORS.md §6). */
export const TEXTILE_REACTOR: Address = "0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3";

/** Shapes accepted by Altana's grantSession `permissions` (SDK 1.1.0 SessionPermissions). */
export type CallPermission = { signature: string; to: Address } | { signature: string } | { to: Address };
export type SpendPermission = { limit: bigint; period: "minute" | "hour" | "day" | "week" | "month" | "year"; token?: Address };
export type SessionPermissions = { calls: readonly CallPermission[]; spend: readonly SpendPermission[] };

export type SessionCaps = {
  /** USD₮ per day, in atomic units (6 decimals). Also pays Altana relay fees, so leave headroom. */
  usdtPerDay: bigint;
  /** cNGN per day, in atomic units (6 decimals). */
  cngnPerDay: bigint;
};

export const MAX_USDT_PER_DAY = 100n * 10n ** 6n;
export const EXPIRY_CHOICES_DAYS = [1, 7, 30] as const;

/**
 * The only calls Errand may make from a user's wallet, enforced on-chain by the Altana account:
 *  1. USD₮ approve: lets Textile's reactor pull the USD₮ being converted.
 *  2. Textile LimitOrderReactor: the swap itself.
 *  3. cNGN transfer: pays the named recipient.
 * `calls` is always set: an omitted allowlist means unrestricted (SPONSORS.md §5).
 */
export function buildSessionPermissions(caps: SessionCaps): SessionPermissions {
  if (caps.usdtPerDay <= 0n || caps.cngnPerDay <= 0n) throw new Error("Daily caps must be above zero.");
  if (caps.usdtPerDay > MAX_USDT_PER_DAY) throw new Error("The USD₮ cap is above Errand's $100/day limit.");
  return {
    calls: [
      { signature: "approve(address,uint256)", to: USDT.address },
      { to: TEXTILE_REACTOR },
      { signature: "transfer(address,uint256)", to: CNGN.address },
    ],
    spend: [
      { limit: caps.usdtPerDay, period: "day", token: USDT.address },
      { limit: caps.cngnPerDay, period: "day", token: CNGN.address },
    ],
  };
}

/** Plain-words version of the allowlist for the screen and receipts. */
export function describeAllowlist(): { label: string; detail: string; to: Address }[] {
  return [
    { label: "USD₮: approve for the Textile FX swap", detail: "approve(address,uint256) on the USD₮ token", to: USDT.address },
    { label: "Textile FX swap contract", detail: "LimitOrderReactor, converts USD₮ to cNGN", to: TEXTILE_REACTOR },
    { label: "cNGN: send only", detail: "transfer(address,uint256) on the cNGN token", to: CNGN.address },
  ];
}

/** Whole-unit amount (e.g. "5" or "12.5") to atomic units for a 6-decimal token, without floating point. */
export function toAtomic6(input: string): bigint {
  const trimmed = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) throw new Error(`"${input}" is not an amount.`);
  const [whole, fraction = ""] = trimmed.split(".");
  return BigInt(whole!) * 10n ** 6n + BigInt(fraction.padEnd(6, "0"));
}

export function expiryFromNow(days: number, nowMs = Date.now()): number {
  if (!EXPIRY_CHOICES_DAYS.includes(days as (typeof EXPIRY_CHOICES_DAYS)[number])) throw new Error("Pick 1, 7 or 30 days.");
  return Math.floor(nowMs / 1000) + days * 24 * 60 * 60;
}
