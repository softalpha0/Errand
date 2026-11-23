/**
 * Spike S0 (docs/celo/BUILD-PLAN.md, Phase 1): does Textile FX quote USD₮ → cNGN on Celo mainnet
 * at Errand's sizes ($1, $5, $20)?
 *
 * Uses POST /v2/rfq/preview: a free, indicative price. It reserves nothing, needs no wallet,
 * no taker, no API key, and sends no transaction. Safe to run any time.
 *
 * Run (PowerShell or bash, Node 22.18+ runs .ts directly):
 *   node packages/celo/scripts/spike-s0-textile-preview.ts
 *
 * Sources (read 23 Nov 2026):
 *   - Endpoint, body, response fields: https://fx-docs.textilecredit.com/api/v2/rfq.html ("Preview a price")
 *   - Errors and limits: https://fx-docs.textilecredit.com/api/v2/errors.html
 *   - Token addresses and decimals: docs/celo/SPONSORS.md §1 (Textile address book)
 */

const TEXTILE_API = "https://api.textilecredit.com/v2";
const CELO_MAINNET = 42220;

// docs/celo/SPONSORS.md §1. Both tokens have 6 decimals (never the 18-decimal USD₮ adapter).
const USDT = { symbol: "USD₮", address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6 } as const;
const CNGN = { symbol: "cNGN", address: "0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f", decimals: 6 } as const;

const SIZES_USD = [1, 5, 20];
const TIMEOUT_MS = 30_000;

type PreviewData = {
  status: "preview" | "no_quote" | string;
  reason?: string;
  sellAmount?: string;
  buyAmount?: string;
  feeAmount?: string;
  takerPays?: string;
  rateRay?: string;
  availableSellAmount?: string;
  availableBuyAmount?: string;
  retryAfterMs?: number;
  reservedUntil?: string;
  routing?: unknown;
};

type Result = {
  sizeUsd: number;
  httpStatus: number;
  data?: PreviewData;
  error?: unknown;
  requestId?: string | null;
};

function toAtomic(amount: number, decimals: number): string {
  return (BigInt(Math.round(amount * 100)) * 10n ** BigInt(decimals - 2)).toString();
}

function fromAtomic(atomic: string | undefined, decimals: number): number | undefined {
  if (atomic === undefined) return undefined;
  return Number(BigInt(atomic)) / 10 ** decimals;
}

async function preview(sizeUsd: number): Promise<Result> {
  const body = {
    chainId: CELO_MAINNET,
    sellToken: USDT.address,
    buyToken: CNGN.address,
    sellAmount: toAtomic(sizeUsd, USDT.decimals),
  };
  const res = await fetch(`${TEXTILE_API}/rfq/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  let json: { data?: PreviewData; error?: unknown } = {};
  try {
    json = JSON.parse(text);
  } catch {
    return { sizeUsd, httpStatus: res.status, error: text.slice(0, 300) };
  }
  return {
    sizeUsd,
    httpStatus: res.status,
    data: json.data,
    error: json.error,
    requestId: res.headers.get("x-request-id"),
  };
}

function naira(n: number | undefined): string {
  return n === undefined ? "-" : `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

async function main() {
  console.log(`S0 Textile preview ${USDT.symbol} → ${CNGN.symbol} on Celo ${CELO_MAINNET} (${new Date().toISOString()})\n`);
  const results: Result[] = [];
  for (const size of SIZES_USD) {
    try {
      results.push(await preview(size));
    } catch (err) {
      results.push({ sizeUsd: size, httpStatus: 0, error: String(err) });
    }
  }

  console.log("| Sell | HTTP | Status | Get (cNGN) | ₦ per USD₮ | Fee (USD₮) | Taker pays (USD₮) | Depth (USD₮) |");
  console.log("|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    const d = r.data;
    const sell = fromAtomic(d?.sellAmount, USDT.decimals);
    const buy = fromAtomic(d?.buyAmount, CNGN.decimals);
    const rate = sell && buy ? (buy / sell).toFixed(2) : "-";
    const status = d ? (d.reason ? `${d.status} (${d.reason})` : d.status) : "error";
    console.log(
      `| $${r.sizeUsd} | ${r.httpStatus} | ${status} | ${naira(buy)} | ${rate} | ${fromAtomic(d?.feeAmount, USDT.decimals) ?? "-"} | ${fromAtomic(d?.takerPays, USDT.decimals) ?? "-"} | ${fromAtomic(d?.availableSellAmount, USDT.decimals) ?? "-"} |`,
    );
  }

  console.log("\nRaw responses:");
  console.log(JSON.stringify(results, null, 2));

  const passed = results.every((r) => r.data?.status === "preview" && r.data.buyAmount !== undefined);
  console.log(`\nS0 ${passed ? "PASS: a price came back for every size" : "FAIL: at least one size got no price (see above)"}`);
  process.exitCode = passed ? 0 : 1;
}

main();
