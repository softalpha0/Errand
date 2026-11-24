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
import { LOCAL_TOKEN_ADDRESSES, MAX_ERRAND_USDT, MIN_ERRAND_USDT, currencyByToken } from "./currencies.js";
import { USDT } from "./tokens.js";

export type RuleFinding = { rule: string; reason: string };

/** Hackathon corridors: USD₮ ↔ cNGN, IDRX, wARS, wBRL, wMXN, wCOP (RULES.md). */
export const CORRIDOR_TOKENS: readonly Address[] = LOCAL_TOKEN_ADDRESSES;

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

/** The calls an errand may make: the same three the Altana session allows (session.ts), for one local currency. */
export function errandAllowlist(localToken: Address): { to: Address; selector?: Hex; label: string }[] {
  const sym = currencyByToken(localToken)?.token.symbol ?? "local";
  return [
    { to: USDT.address, selector: "0x095ea7b3", label: "USD₮ approve" },
    { to: TEXTILE_REACTOR, label: "Textile FX swap" },
    { to: localToken, selector: "0xa9059cbb", label: `${sym} transfer` },
  ];
}

export function r16Allowlist(calls: readonly { to: string; data: Hex }[], localToken: Address): RuleFinding[] {
  const allow = errandAllowlist(localToken);
  const out: RuleFinding[] = [];
  for (const c of calls) {
    const ok = allow.some((a) => eq(a.to, c.to) && (!a.selector || c.data.toLowerCase().startsWith(a.selector)));
    if (!ok) out.push({ rule: "R16", reason: `A call to ${c.to} is outside the contracts and functions you approved.` });
  }
  return out;
}

export function r17Tagged(calls: readonly { to: string; data: Hex }[]): RuleFinding[] {
  return calls.filter((c) => !hasErrandTag(c.data)).map((c) => ({ rule: "R17", reason: `A transaction to ${c.to} is missing Errand's attribution tag.` }));
}

/** Checks before pricing: a supported currency, a positive amount, a sensible recipient. */
export function checkErrandRequest(p: { localToken: string; amountAtomic: bigint; recipient: string; payer?: string }): RuleFinding[] {
  const out: RuleFinding[] = [];
  if (!currencyByToken(p.localToken)) out.push({ rule: "E0", reason: "Pick one of the local currencies Errand supports." });
  if (p.amountAtomic <= 0n) out.push({ rule: "E1", reason: "Enter an amount above zero." });
  if (!ADDRESS.test(p.recipient)) out.push({ rule: "E2", reason: "The recipient must be a Celo address (0x followed by 40 characters)." });
  else {
    if (eq(p.recipient, ZERO)) out.push({ rule: "E2", reason: "The recipient is the zero address; the money would be lost." });
    if ([USDT.address, TEXTILE_REACTOR, ...LOCAL_TOKEN_ADDRESSES].some((a) => eq(a, p.recipient))) out.push({ rule: "E2", reason: "The recipient is a contract Errand uses, not a person." });
    if (p.payer && eq(p.payer, p.recipient)) out.push({ rule: "E2", reason: "The recipient is your own wallet." });
  }
  return out;
}

/** Checks once priced: what the sender pays must sit within Errand's testing limits ($1.10–$35). */
export function checkErrandCost(takerPaysUsdtAtomic: bigint): RuleFinding[] {
  if (takerPaysUsdtAtomic < MIN_ERRAND_USDT) return [{ rule: "E1", reason: "That's below Textile's minimum. Send at least about $1.10 worth." }];
  if (takerPaysUsdtAtomic > MAX_ERRAND_USDT) return [{ rule: "E1", reason: "While Errand is in testing, one errand costs at most $35." }];
  return [];
}

const transferAbi = [
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

/** Local-stablecoin transfer to the recipient, tagged. */
export function buildPayout(localToken: Address, recipient: Address, amountAtomic: bigint): { to: Address; data: Hex } {
  return { to: localToken, data: tagCalldata(encodeFunctionData({ abi: transferAbi, functionName: "transfer", args: [recipient, amountAtomic] })) };
}

/** Reads back a payout's recipient and amount (for receipts and tests). */
export function decodePayout(data: Hex): { to: Address; amount: bigint } {
  const { args } = decodeFunctionData({ abi: transferAbi, data });
  return { to: args[0], amount: args[1] };
}
