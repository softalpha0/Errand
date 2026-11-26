import { NextResponse } from "next/server";
import { createPublicClient, http, isHash, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { decodePaymentResponseHeader, wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { assertTagged, carriesErrandTag } from "@errand/celo/attribution";
import { USDT } from "@errand/celo/tokens";

/**
 * Errand's paid tool call (`tool.buy`): after an errand, Errand pays $0.01 USD₮ on buy
 * (Celo Core Co.'s agent marketplace) for one batch on Chainstack's Celo RPC, and reads every
 * transaction of the receipt back from that independent node: did it succeed, does it carry the tag.
 *
 * Route and price from https://unpkg.com/@celo/buy-registry/providers/chainstack/celo-rpc/PAY.md
 * (POST https://gateway.usebuy.ai/chainstack/celo, one payment per JSON-RPC batch, 0.01 in
 * USDC/USD₮/USA₮; the 402 is authoritative). We pay in USD₮ only, capped at $0.01 per payment.
 *
 * Payer: Errand's tools wallet (TOOLS_PAYER_KEY, server env only). Abuse guards before any payment:
 * at most 4 hashes, each must exist on Celo, have succeeded and carry Errand's tag (free check on
 * forno), results cached per receipt, and at most MAX_PAID_PER_DAY paid checks a day.
 */

const BUY_RPC = "https://gateway.usebuy.ai/chainstack/celo";
const FORNO = "https://forno.celo.org";
const MAX_PAID_PER_DAY = 40;
const PROVIDER = "Chainstack Celo RPC, bought on buy (usebuy.ai)";

type Result = { hash: Hex; success: boolean; tagged: boolean };
type Checked = { status: "checked"; ok: boolean; checked: number; results: Result[]; paymentTx?: Hex; provider: string; at: string };

const cache = new Map<string, Checked>();
let day = "";
let paidToday = 0;

const forno = createPublicClient({ transport: http(FORNO) });

function payer() {
  const raw = process.env.TOOLS_PAYER_KEY?.trim();
  if (!raw) return null;
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  return privateKeyToAccount(key);
}

function skipped(reason: string, status = 200) {
  return NextResponse.json({ status: "skipped", reason }, { status });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { txs?: unknown } | null;
  const txs = Array.isArray(body?.txs) ? (body!.txs as unknown[]) : [];
  if (txs.length === 0 || txs.length > 4 || !txs.every((t): t is Hex => typeof t === "string" && isHash(t))) {
    return skipped("Send 1 to 4 transaction hashes.", 400);
  }
  const hashes = [...new Set(txs.map((t) => t.toLowerCase() as Hex))];
  const cacheKey = [...hashes].sort().join(",");
  const hit = cache.get(cacheKey);
  if (hit) return NextResponse.json(hit);

  const account = payer();
  if (!account) return skipped("Errand's tools wallet isn't set up on this site yet.");

  // Free pre-check: only Errand's own successful, tagged transactions get a paid check.
  for (const hash of hashes) {
    const rc = await forno.getTransactionReceipt({ hash }).catch(() => null);
    if (!rc) return skipped(`Transaction ${hash.slice(0, 10)}… isn't on Celo yet.`);
    // assertTagged reads direct transactions and Altana relayed intents (attribution-tags 0.6.0).
    const tagged = await assertTagged(forno as never, hash).then(() => true).catch(() => false);
    if (rc.status !== "success" || !tagged) return skipped("Only Errand's own successful transactions are checked.");
  }

  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    paidToday = 0;
  }
  if (paidToday >= MAX_PAID_PER_DAY) return skipped("Errand's daily budget for independent checks is used up. Try tomorrow.");
  paidToday++;

  const client = new x402Client();
  client.setSpendControls({ maxAmountPerPayment: "$0.01" });
  client.register("eip155:42220", new ExactEvmScheme(account, { rpcUrl: FORNO }));
  // Pay in USD₮ only (the 402 also offers USDC and USA₮).
  client.registerPolicy((_v, reqs) => reqs.filter((r) => String((r as { asset?: string }).asset).toLowerCase() === USDT.address.toLowerCase()));
  const payFetch = wrapFetchWithPayment(fetch, client);

  const batch = hashes.flatMap((hash, i) => [
    { jsonrpc: "2.0", id: i * 2 + 1, method: "eth_getTransactionReceipt", params: [hash] },
    { jsonrpc: "2.0", id: i * 2 + 2, method: "eth_getTransactionByHash", params: [hash] },
  ]);

  let res: Response;
  try {
    res = await payFetch(BUY_RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(batch), signal: AbortSignal.timeout(60_000) });
  } catch (e) {
    paidToday--;
    return skipped(`The paid check didn't go through (${e instanceof Error ? e.message.slice(0, 120) : "error"}).`);
  }
  const settleHeader = res.headers.get("PAYMENT-RESPONSE") ?? res.headers.get("X-PAYMENT-RESPONSE");
  const settlement = settleHeader ? decodePaymentResponseHeader(settleHeader) : null;
  const paymentTx = settlement?.transaction && isHash(settlement.transaction) ? (settlement.transaction as Hex) : undefined;
  if (!res.ok) return skipped(`The independent node answered ${res.status}.${paymentTx ? ` Payment ${paymentTx}.` : ""}`);

  const rows = (await res.json().catch(() => [])) as { id: number; result?: { status?: string; input?: Hex } | null }[];
  const byId = new Map(rows.map((r) => [r.id, r.result]));
  const results: Result[] = hashes.map((hash, i) => {
    const rc = byId.get(i * 2 + 1) as { status?: string } | null | undefined;
    const tx = byId.get(i * 2 + 2) as { input?: Hex } | null | undefined;
    return { hash, success: rc?.status === "0x1", tagged: Boolean(tx?.input && carriesErrandTag(tx.input)) };
  });
  const checked: Checked = {
    status: "checked",
    ok: results.every((r) => r.success && r.tagged),
    checked: results.length,
    results,
    ...(paymentTx ? { paymentTx } : {}),
    provider: PROVIDER,
    at: new Date().toISOString(),
  };
  cache.set(cacheKey, checked);
  return NextResponse.json(checked);
}
