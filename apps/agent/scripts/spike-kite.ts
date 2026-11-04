/**
 * Day-one Kite spike: proves Kite Passport can pay Errand's sellers.
 *
 *   pnpm spike:kite
 *
 * 1. Creates a $0.05 session (max $0.01 per payment) and prints the approval link.
 * 2. Waits for you to approve with your passkey.
 * 3. Pays $0.001 for Bitrefill's checkout/info and $0.002 for a Nigeria MTN top-up search.
 * 4. Saves everything kpass printed to evidence/raw/ so field names can be checked.
 *
 * Total cost: $0.003 plus any routing fee Kite shows.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as kite from "../src/kite";

const out = path.resolve(import.meta.dirname, "../../../evidence/raw");
mkdirSync(out, { recursive: true });
const save = (name: string, data: unknown) => writeFileSync(path.join(out, `${name}.json`), JSON.stringify(data, null, 2));

async function main() {
  console.log("kpass:", await kite.kpassVersion());
  const balance = await kite.walletBalance();
  save("wallet-balance", balance);
  console.log("Wallet balance saved.");

  const req = await kite.createSession({ taskSummary: "Errand spike: two tiny Bitrefill calls", maxPerTxUsd: 0.01, maxTotalUsd: 0.05 });
  save("session-create", req.raw);
  console.log("\nApprove this session with your passkey:\n", req.approvalUrl ?? "(no link found: see evidence/raw/session-create.json)");
  if (!req.requestId) throw new Error("No request_id in kpass output. Check evidence/raw/session-create.json.");

  let sessionId = req.sessionId;
  for (let i = 0; i < 150; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const st = await kite.sessionStatus(req.requestId);
    if (i === 0) save("session-status-first", st.raw);
    if (st.state === "approved") {
      save("session-status-approved", st.raw);
      sessionId = st.sessionId ?? sessionId;
      break;
    }
    if (st.state === "rejected") throw new Error("Session declined.");
    process.stdout.write(".");
  }
  if (!sessionId) throw new Error("Session not approved within 10 minutes.");
  await kite.useSession(sessionId);
  console.log("\nApproved. Session", sessionId);

  const a = await kite.execute({ url: "https://api.bitrefill.com/x402/checkout/info", method: "GET", idempotencyKey: `spike-a-${Date.now()}` });
  save("execute-checkout-info", a.raw);
  console.log("\nA. checkout/info tx:", a.txHash, a.explorerUrl);

  const b = await kite.execute({ url: "https://api.bitrefill.com/x402/topups/search?q=mtn&country=NG", method: "GET", idempotencyKey: `spike-b-${Date.now()}` });
  save("execute-topups-search-ng", b.raw);
  console.log("B. NG top-up products:", JSON.stringify(b.body).slice(0, 600));
  console.log(`\nAll raw output is in ${out}. Copy anything useful into docs/kite-integration.md (it is gitignored).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  if (err && typeof err === "object" && "raw" in err) console.error(JSON.stringify((err as { raw: unknown }).raw, null, 2));
  process.exit(1);
});
