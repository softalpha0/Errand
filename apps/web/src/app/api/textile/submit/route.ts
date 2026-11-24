import { NextResponse } from "next/server";
import { bad, fromError, parseRfq, textile } from "@/lib/textile-server";

/** Reports the broadcast swap hash to Textile (courtesy; settlement is reconciled on chain). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const rfq = parseRfq(body);
  const txHash = body.txHash;
  if (!rfq) return bad("rfqId and claimToken are required.");
  if (typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) return bad("txHash must be a transaction hash.");
  try {
    return NextResponse.json({ data: await textile.submit(rfq.rfqId, rfq.claimToken, txHash as `0x${string}`) });
  } catch (e) {
    return fromError(e);
  }
}
