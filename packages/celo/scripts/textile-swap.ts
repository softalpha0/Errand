/**
 * Spike S3 (EOA variant): one real Textile FX conversion USD₮ → cNGN on Celo mainnet, tagged with
 * Errand's attribution code. The taker is Benjamin's TEST wallet (.self/test-payer.key, git-ignored),
 * not a user. The Altana-wallet variant waits on Altana's answer about tags (AGENTS.md → Decisions, Q2).
 *
 * Safe by default: without --send it gets a real firm quote (signing Textile's proof of control),
 * checks it (rule R15), prints it, and RELEASES it. Nothing is approved or swapped.
 *
 * Run from the repo root (PowerShell or bash):
 *   pnpm --filter @errand/celo textile-swap                 # dry run, $1
 *   pnpm --filter @errand/celo textile-swap -- --send       # real swap, $1
 *   pnpm --filter @errand/celo textile-swap -- --usd 2 --send
 *
 * Needs in the test wallet: the USD₮ to convert (Textile's minimum is about $1) and a little CELO for gas
 * (two transactions: approve + swap).
 * Order (rfq.html "Executing it"): approve takerPays to the reactor (reset to 0 first if an old allowance
 * exists) → WAIT for the receipt → recheck expiresAt → broadcast transactions.swap → /submit → poll.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, formatEther, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { assertTagged, attributionCode, errandAttribution, hasErrandTag } from "../src/attribution.ts";
import { CNGN, USDT, assertTokenDecimals, erc20Abi, formatUnitsExact } from "../src/tokens.ts";
import { TEXTILE_REACTOR, toAtomic6 } from "../src/session.ts";
import { TextileClient, TextileError, encodeApprove, isTerminal, validateFirmQuote, type FirmQuote } from "../src/textile.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const KEY_FILE = resolve(ROOT, process.env.TEST_PAYER_KEY_FILE ?? ".self/test-payer.key");
const RPC = process.env.CELO_RPC_URL ?? "https://forno.celo.org";
const AGENT_WALLET = "0xc64d2153Bd39053913667A5c2eec8250d8AbC005";
const send = process.argv.includes("--send");
const usdArg = process.argv[process.argv.indexOf("--usd") + 1];
const usd = process.argv.includes("--usd") && usdArg ? usdArg : "1";

const allowanceAbi = [
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

function stop(message: string): never {
  console.error(`\nSTOP: ${message}`);
  process.exit(1);
}

if (!existsSync(KEY_FILE)) stop(`No test wallet key at ${KEY_FILE}. Run "pnpm --filter @errand/guard-celo pay-check" once to create it.`);
const raw = readFileSync(KEY_FILE, "utf8").trim();
const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
if (!/^0x[0-9a-fA-F]{64}$/.test(key)) stop(`${KEY_FILE} doesn't hold a private key.`);
const account = privateKeyToAccount(key);
if (account.address.toLowerCase() === AGENT_WALLET.toLowerCase()) stop("Use the test wallet, not the agent wallet.");

const sellAmount = toAtomic6(usd);
if (sellAmount > 5_000_000n) stop("This spike converts at most $5.");

const publicClient = createPublicClient({ transport: http(RPC) });
const walletClient = createWalletClient({ account, chain: celo, transport: http(RPC) }).extend(errandAttribution());
const textile = new TextileClient();

console.log(`Textile FX USD₮ → cNGN on Celo mainnet (${send ? "SEND" : "dry run"}), tag ${attributionCode()}`);
console.log(`Taker (test wallet): ${account.address}`);
await assertTokenDecimals(publicClient);

const [usdt, cngnBefore, celoBal] = await Promise.all([
  publicClient.readContract({ address: USDT.address, abi: erc20Abi, functionName: "balanceOf", args: [account.address] }),
  publicClient.readContract({ address: CNGN.address, abi: erc20Abi, functionName: "balanceOf", args: [account.address] }),
  publicClient.getBalance({ address: account.address }),
]);
console.log(`Balances: USD₮ ${formatUnitsExact(usdt, 6)} · cNGN ${formatUnitsExact(cngnBefore, 6)} · CELO ${formatEther(celoBal)}`);
if (usdt < sellAmount) stop(`The test wallet needs at least ${usd} USD₮ (has ${formatUnitsExact(usdt, 6)}). Send some to ${account.address} on Celo.`);

let quote: FirmQuote;
try {
  const res = await textile.request(
    { chainId: 42220, sellToken: USDT.address, buyToken: CNGN.address, sellAmount: sellAmount.toString(), taker: account.address, builderCodes: [attributionCode()] },
    (td) => account.signTypedData(td),
  );
  if (res.status !== "quoted") stop(`Textile had no quote: ${res.reason}${res.retryAfterMs ? ` (retry after ${res.retryAfterMs} ms)` : ""}.`);
  quote = res;
} catch (e) {
  if (e instanceof TextileError) stop(`Textile ${e.httpStatus} ${e.code ?? ""} ${e.reason ?? ""}: ${e.message} (request ${e.requestId ?? "?"})`);
  throw e;
}

const q = quote.quote;
const naira = Number(formatUnitsExact(BigInt(q.buyAmount), 6));
console.log(`\nFirm quote ${quote.rfqId}: pay ${formatUnitsExact(BigInt(q.takerPays), 6)} USD₮ → receive ₦${naira.toLocaleString("en-NG", { maximumFractionDigits: 2 })} cNGN`);
console.log(`  rate ≈ ₦${(naira / Number(formatUnitsExact(BigInt(q.takerPays), 6))).toFixed(2)} per USD₮ · fee ${formatUnitsExact(BigInt(q.feeAmount), 6)} USD₮ · expires ${q.expiresAt}`);

const problems = validateFirmQuote(quote, { taker: account.address, sellToken: USDT.address, maxTakerPays: sellAmount, chainId: 42220, nowMs: Date.now() });
if (problems.length) {
  await textile.cancel(quote.rfqId, quote.claimToken).catch(() => undefined);
  stop(`Rule R15 refused the quote: ${problems.join(" ")}`);
}
console.log("  R15 checks passed (taker, reactor, tokens, amount, expiry, approval spender).");

if (!send) {
  const released = await textile.cancel(quote.rfqId, quote.claimToken).catch((e) => ({ status: `cancel failed: ${e}` }));
  console.log(`\nDry run: quote released (${released.status}). Nothing was approved or swapped. Re-run with --send to convert for real.`);
  process.exit(0);
}

if (celoBal === 0n) {
  await textile.cancel(quote.rfqId, quote.claimToken).catch(() => undefined);
  stop(`The test wallet has no CELO for gas. Send about 0.2 CELO to ${account.address}, then run again.`);
}

const takerPays = BigInt(q.takerPays);
const record: Record<string, unknown> = {
  what: "Textile FX conversion USD₮ → cNGN, Celo mainnet (spike S3, EOA taker)",
  label: "test (Benjamin's own test wallet; not a user)",
  taker: account.address,
  rfqId: quote.rfqId,
  quoted: { takerPays: q.takerPays, buyAmount: q.buyAmount, feeAmount: q.feeAmount, expiresAt: q.expiresAt },
  attributionCode: attributionCode(),
};

const allowance = await publicClient.readContract({ address: USDT.address, abi: allowanceAbi, functionName: "allowance", args: [account.address, TEXTILE_REACTOR] });
if (allowance < takerPays) {
  if (allowance > 0n) {
    console.log("Resetting the old USD₮ allowance to 0 (USDT-style tokens refuse nonzero → nonzero)…");
    const reset = await walletClient.sendTransaction({ to: USDT.address, data: encodeApprove(TEXTILE_REACTOR, 0n) });
    await publicClient.waitForTransactionReceipt({ hash: reset });
    record.resetTx = reset;
  }
  console.log("Approving takerPays to Textile's reactor…");
  const approval = await walletClient.sendTransaction({ to: quote.transactions.approval.to, data: quote.transactions.approval.data, value: 0n });
  const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approval });
  if (approvalReceipt.status !== "success") stop(`Approval reverted: https://celoscan.io/tx/${approval}`);
  record.approvalTx = approval;
  console.log(`  approved: https://celoscan.io/tx/${approval}`);
} else {
  console.log("Existing allowance covers takerPays; no approval needed.");
}

if (Date.parse(q.expiresAt) <= Date.now()) stop("The quote expired while approving. Run again for a fresh quote (the approval stays and will be reused).");

console.log("Sending the swap (tagged)…");
const swap = await walletClient.sendTransaction({ to: quote.transactions.swap.to, data: quote.transactions.swap.data, value: 0n });
record.swapTx = swap;
console.log(`  swap: https://celoscan.io/tx/${swap}`);
const swapReceipt = await publicClient.waitForTransactionReceipt({ hash: swap, timeout: 120_000 });
record.swapStatus = swapReceipt.status;
if (swapReceipt.status !== "success") console.error("  The swap reverted on chain.");

await textile.submit(quote.rfqId, quote.claimToken, swap).catch((e) => console.warn(`  /submit failed (settlement is reconciled from chain anyway): ${e}`));

let status = await textile.get(quote.rfqId, quote.claimToken);
for (let i = 0; i < 40 && !isTerminal(status.status); i++) {
  await new Promise((r) => setTimeout(r, 3000));
  status = await textile.get(quote.rfqId, quote.claimToken);
}
record.textileStatus = { status: status.status, sellAmount: status.sellAmount, buyAmount: status.buyAmount, txHash: status.txHash, filledAt: status.filledAt, failReason: status.failReason };
console.log(`Textile status: ${status.status}${status.filledAt ? ` at ${status.filledAt}` : ""}`);

const tx = await publicClient.getTransaction({ hash: swap });
record.swapCalldataEndsWithTag = hasErrandTag(tx.input);
try {
  record.verifyTx = await assertTagged(publicClient, swap);
} catch (e) {
  record.verifyTx = { error: String(e) };
}
const cngnAfter = await publicClient.readContract({ address: CNGN.address, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
record.cngnReceived = formatUnitsExact(cngnAfter - cngnBefore, 6);
record.recordedAt = new Date().toISOString();

const out = resolve(ROOT, `evidence/celo/textile-swap-${quote.rfqId}.json`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(record, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2)}\n`);
console.log(`\ncNGN received: ₦${record.cngnReceived} · tag on swap: ${record.swapCalldataEndsWithTag ? "yes" : "NO"} · verifyTx: ${JSON.stringify(record.verifyTx)}`);
console.log(`Evidence: evidence/celo/textile-swap-${quote.rfqId}.json`);
if (status.status !== "filled" || !record.swapCalldataEndsWithTag) process.exitCode = 1;
