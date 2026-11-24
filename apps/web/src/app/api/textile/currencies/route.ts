import { NextResponse } from "next/server";
import { LOCAL_CURRENCIES, pair, textile } from "@/lib/textile-server";

type Availability = { code: string; available: boolean; reason?: string; perUsdt?: number; depthUsd?: number };

let cache: { at: number; data: Availability[] } | null = null;
const TTL_MS = 60_000;

/** Which local currencies Textile can price right now ($5 preview each), cached for a minute. */
export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) return NextResponse.json({ data: cache.data, checkedAt: new Date(cache.at).toISOString() });
  const data = await Promise.all(
    LOCAL_CURRENCIES.map(async (c): Promise<Availability> => {
      try {
        const r = await textile.preview({ ...pair(c), sellAmount: "5000000" });
        if (r.status !== "preview" || !r.buyAmount) return { code: c.code, available: false, reason: r.reason ?? "no price" };
        const depthUsd = r.availableSellAmount ? Number(BigInt(r.availableSellAmount)) / 1e6 : undefined;
        const perUsdt = Number(BigInt(r.buyAmount)) / 10 ** c.token.decimals / 5;
        if (depthUsd !== undefined && depthUsd < 35) return { code: c.code, available: false, reason: "too little liquidity right now", perUsdt, depthUsd };
        return { code: c.code, available: true, perUsdt, ...(depthUsd !== undefined ? { depthUsd } : {}) };
      } catch (e) {
        return { code: c.code, available: false, reason: e instanceof Error ? e.message.slice(0, 80) : "unavailable" };
      }
    }),
  );
  cache = { at: Date.now(), data };
  return NextResponse.json({ data, checkedAt: new Date(cache.at).toISOString() });
}
