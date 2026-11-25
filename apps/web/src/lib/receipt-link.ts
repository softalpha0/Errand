/**
 * Shareable receipts with no database: the receipt's public facts travel in the link's #fragment
 * (never sent to the server), and the receipt page re-checks every one of them on Celo when opened.
 * Nothing private goes in: amounts, the recipient's address (already public on Celo), tx hashes and
 * the optional label the sender typed.
 */
import type { Address, Hex } from "viem";
import type { BuyCheck, Receipt } from "./errand";

type Compact = {
  v: 1;
  t: string; // createdAt
  c: string; // currency code
  a: string; // amount, atomic
  r: Address; // recipient
  k: Address; // payer (taker)
  l?: string; // label
  p?: string; // paid USD₮, atomic
  f?: string; // Textile fee, atomic
  q?: string; // rfq id
  x: Receipt["txs"];
  b?: { ok: boolean; tx?: Hex; at: string }; // buy check summary
};

function toB64Url(s: string) {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(escape(atob(b64 + "===".slice((b64.length + 3) % 4))));
}

export function receiptLink(r: Receipt, origin: string): string {
  const b = r.buyCheck?.status === "checked" ? { ok: r.buyCheck.ok, at: r.buyCheck.at, ...(r.buyCheck.paymentTx ? { tx: r.buyCheck.paymentTx } : {}) } : undefined;
  const c: Compact = {
    v: 1,
    t: r.createdAt,
    c: r.currency ?? "NGN",
    a: r.amountAtomic ?? r.nairaAtomic ?? "0",
    r: r.recipient,
    k: r.taker,
    ...(r.label ? { l: r.label } : {}),
    ...(r.paidUsdt ? { p: r.paidUsdt } : {}),
    ...(r.feeUsdt ? { f: r.feeUsdt } : {}),
    ...(r.rfqId ? { q: r.rfqId } : {}),
    x: r.txs,
    ...(b ? { b } : {}),
  };
  return `${origin}/receipt#d=${toB64Url(JSON.stringify(c))}`;
}

export type SharedReceipt = Omit<Receipt, "id" | "tagged" | "status" | "buyCheck"> & { buy?: Compact["b"] };

/** Reads a receipt from a link's fragment. Returns null for anything malformed. */
export function readReceiptLink(hash: string): SharedReceipt | null {
  const m = /(?:^#|&)d=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  try {
    const c = JSON.parse(fromB64Url(m[1]!)) as Compact;
    if (c.v !== 1 || typeof c.a !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(c.r) || typeof c.x !== "object") return null;
    return {
      createdAt: c.t,
      currency: c.c,
      amountAtomic: c.a,
      recipient: c.r,
      taker: c.k,
      label: c.l ?? "",
      ...(c.p ? { paidUsdt: c.p } : {}),
      ...(c.f ? { feeUsdt: c.f } : {}),
      ...(c.q ? { rfqId: c.q } : {}),
      txs: c.x,
      ...(c.b ? { buy: c.b } : {}),
    };
  } catch {
    return null;
  }
}

export type { BuyCheck };
