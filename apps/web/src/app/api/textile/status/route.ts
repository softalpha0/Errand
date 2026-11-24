import { NextResponse } from "next/server";
import { bad, fromError, parseRfq, textile } from "@/lib/textile-server";

/** RFQ status (POST so the claim token never sits in a URL or log line). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const rfq = parseRfq(body);
  if (!rfq) return bad("rfqId and claimToken are required.");
  try {
    return NextResponse.json({ data: await textile.get(rfq.rfqId, rfq.claimToken) });
  } catch (e) {
    return fromError(e);
  }
}
