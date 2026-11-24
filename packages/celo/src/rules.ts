/**
 * Errand's Celo guard rules (PRD §8), checked before anything is signed:
 *  R14 corridor  — FX only between USD₮ and the hackathon corridor tokens, on chain 42220
 *  R15 quote     — see validateFirmQuote in textile.ts (expired, foreign taker, wrong reactor, over plan)
 *  R16 allowlist — every call goes to a contract the user approved, with an allowed function
 *  R17 untagged  — every Celo tx Errand builds ends with Errand's attribution tag
 * Plus errand-level checks on the recipient and size. Pure functions; no I/O.
 */
import { decodeFunctionData, encodeFunctionData, type Address, type Hex } from "viem";
import { hasErrandTag, tagCalldata } from "./attribution.js";
import { TEXTILE_REACTOR } from "./session.js";
import { CNGN, USDT } from "./tokens.js";

export type RuleFinding = { rule: string; reason: string };

/** Hackathon corridors: USD₮ ↔ cNGN, IDRX, wARS, wBRL, wMXN, wCOP (RULES.md). */
export const CORRIDOR_TOKENS: readonly Address[] = [
  CNGN.address,
  "0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22", // IDRX
  "0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D", // wARS
  "0xD76f5Faf6888e24D9F04Bf92a0c8B921FE4390e0", // wBRL
  "0x337E7456B420bD3481e7FA61fA9850343d610d34", // wMXN
  "0x8a1D45e102e886510e891d2Ec656a708991e2D76", // wCOP
];

/** Largest single errand while Errand is in testing: ₦50,000 (about $35 at ₦1,445/USD₮). */
export const MAX_ERRAND_NAIRA_ATOMIC = 50_000n * 10n ** 6n;
/** Smallest: Textile's minimum is about $1 notional, so ask for at least ₦1,500. */
export const MIN_ERRAND_NAIRA_ATOMIC = 1_500n * 10n ** 6n;

const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const ZERO = "0x0000000000000000000000000000000000000000";

export function r14Corridor(chainId: number, sellToken: string, buyToken: string): RuleFinding[] {
  const out: RuleFinding[] = [];
  if (chainId !== 42220) out.push({ rule: "R14", reason: "FX runs on Celo mainnet (42220) only." });
  const pair = [sellToken, buyToken];
  const hasUsdt = pair.some((t) => eq(t, USDT.address));
  const other = pair.find((t) => !eq(t, USDT.address));
  if (!hasUsdt || !other || !CORRIDOR_TOKENS.some((t) => eq(t, other))) out.push({ rule: "R14", reason: "Only USD₮ ↔ cNGN, IDRX, wARS, wBRL, wMXN or wCOP." });
  return out;
}

/** The calls an errand may make: the same three the Altana session allows (session.ts). */
export const ERRAND_ALLOWLIST: readonly { to: Address; selector?: Hex; label: string }[] = [
  { to: USDT.address, selector: "0x095ea7b3", label: "USD₮ approve" },
  { to: TEXTILE_REACTOR, label: "Textile FX swap" },
  { to: CNGN.address, selector: "0xa9059cbb", label: "cNGN transfer" },
];

export function r16Allowlist(calls: readonly { to: string; data: Hex }[]): RuleFinding[] {
  const out: RuleFinding[] = [];
  for (const c of calls) {
    const ok = ERRAND_ALLOWLIST.some((a) => eq(a.to, c.to) && (!a.selector || c.data.toLowerCase().startsWith(a.selector)));
    if (!ok) out.push({ rule: "R16", reason: `A call to ${c.to} is outside the contracts and functions you approved.` });
  }
  return out;
}

export function r17Tagged(calls: readonly { to: string; data: Hex }[]): RuleFinding[] {
  return calls.filter((c) => !hasErrandTag(c.data)).map((c) => ({ rule: "R17", reason: `A transaction to ${c.to} is missing Errand's attribution tag.` }));
}

export function checkErrandRequest(p: { nairaAtomic: bigint; recipient: string; payer?: string }): RuleFinding[] {
  const out: RuleFinding[] = [];
  if (p.nairaAtomic < MIN_ERRAND_NAIRA_ATOMIC) out.push({ rule: "E1", reason: "Send at least ₦1,500 (Textile's minimum is about $1)." });
  if (p.nairaAtomic > MAX_ERRAND_NAIRA_ATOMIC) out.push({ rule: "E1", reason: "While Errand is in testing, one errand sends at most ₦50,000." });
  if (!ADDRESS.test(p.recipient)) out.push({ rule: "E2", reason: "The recipient must be a Celo address (0x followed by 40 characters)." });
  else {
    if (eq(p.recipient, ZERO)) out.push({ rule: "E2", reason: "The recipient is the zero address; the money would be lost." });
    if ([USDT.address, CNGN.address, TEXTILE_REACTOR].some((a) => eq(a, p.recipient))) out.push({ rule: "E2", reason: "The recipient is a contract Errand uses, not a person." });
    if (p.payer && eq(p.payer, p.recipient)) out.push({ rule: "E2", reason: "The recipient is your own wallet." });
  }
  return out;
}

const transferAbi = [
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

/** cNGN transfer to the recipient, tagged. */
export function buildPayout(recipient: Address, nairaAtomic: bigint): { to: Address; data: Hex } {
  return { to: CNGN.address, data: tagCalldata(encodeFunctionData({ abi: transferAbi, functionName: "transfer", args: [recipient, nairaAtomic] })) };
}

/** Reads back a payout's recipient and amount (for receipts and tests). */
export function decodePayout(data: Hex): { to: Address; amount: bigint } {
  const { args } = decodeFunctionData({ abi: transferAbi, data });
  return { to: args[0], amount: args[1] };
}
