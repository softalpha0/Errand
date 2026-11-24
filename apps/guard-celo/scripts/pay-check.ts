/**
 * Pays Errand Guard for one real check on Celo mainnet, as another agent would.
 * Used for the first paid checks and the demo (verified vs unverified caller).
 *
 * Payer: a TEST wallet whose key lives in .self/test-payer.key (git-ignored). Created on first run.
 *   It only needs a little USD₮ (each check is $0.01; no CELO needed: the x402 facilitator pays gas).
 *   It is Benjamin's own test wallet: label "test", never counted as a user.
 * --verified: also sign the request with Errand's Self Agent ID key (.self/agent.key, agentId 214),
 *   so Errand Guard serves it on the verified tier. The payment still comes from the test wallet
 *   (never agent wallet → agent wallet).
 *
 * Run from the repo root:
 *   pnpm --filter @errand/guard-celo pay-check              # unverified caller
 *   pnpm --filter @errand/guard-celo pay-check -- --verified
 * Optional env: GUARD_URL (default https://errand-guard-celo.onrender.com), CELO_RPC_URL.
 *
 * Buyer setup per https://x402.celo.org/skill.md: x402Client + setSpendControls, ExactEvmScheme(account, { rpcUrl }),
 * wrapFetchWithPayment. Spend cap here: $0.02 per payment in USD₮.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { SelfAgent } from "@selfxyz/agent-sdk";
import { decodePaymentResponseHeader, wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { CNGN, USDT, erc20Abi, formatUnitsExact } from "@errand/celo/tokens";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const PAYER_KEY_FILE = resolve(ROOT, ".self/test-payer.key");
const AGENT_KEY_FILE = resolve(ROOT, ".self/agent.key");
const EVIDENCE_FILE = resolve(ROOT, "evidence/celo/guard-checks.jsonl");
const GUARD_URL = (process.env.GUARD_URL ?? "https://errand-guard-celo.onrender.com").replace(/\/$/, "");
const RPC = process.env.CELO_RPC_URL ?? "https://forno.celo.org";
const AGENT_WALLET = "0xc64d2153Bd39053913667A5c2eec8250d8AbC005";
const verified = process.argv.includes("--verified");

function stop(message: string): never {
  console.error(`\nSTOP: ${message}`);
  process.exit(1);
}

function readKey(file: string): Hex {
  const raw = readFileSync(file, "utf8").trim();
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) stop(`${file} doesn't hold a private key.`);
  return key;
}

if (!existsSync(PAYER_KEY_FILE)) {
  mkdirSync(dirname(PAYER_KEY_FILE), { recursive: true });
  const key = generatePrivateKey();
  writeFileSync(PAYER_KEY_FILE, `${key}\n`, { mode: 0o600 });
  console.log(`Created a TEST payer wallet: ${privateKeyToAccount(key).address}`);
  console.log(`Key saved in .self/test-payer.key (git-ignored). Back it up if you put more than a few cents in it.`);
  console.log(`Send it a little USD₮ on Celo (0.10 from the hackathon USD₮ faucet is enough for 10 checks), then run this again.`);
  process.exit(0);
}

const payer = privateKeyToAccount(readKey(PAYER_KEY_FILE));
if (payer.address.toLowerCase() === AGENT_WALLET.toLowerCase()) stop("The payer must not be Errand's agent wallet (that would pay itself).");

const publicClient = createPublicClient({ transport: http(RPC) });
const balance = await publicClient.readContract({ address: USDT.address, abi: erc20Abi, functionName: "balanceOf", args: [payer.address] });
console.log(`Payer (test wallet): ${payer.address} · USD₮ ${formatUnitsExact(balance, USDT.decimals)}`);
if (balance < 10_000n) stop(`The test wallet needs at least 0.01 USD₮. Send some to ${payer.address} on Celo.`);

let baseFetch: typeof fetch = fetch;
if (verified) {
  if (!existsSync(AGENT_KEY_FILE)) stop("--verified needs .self/agent.key (Errand's Self Agent ID key).");
  const agent = new SelfAgent({ privateKey: readKey(AGENT_KEY_FILE), network: "mainnet" });
  baseFetch = ((input: string | URL | Request, init?: RequestInit) => agent.fetch(input instanceof Request ? input.url : String(input), init)) as typeof fetch;
  console.log(`Signing the request as Errand's Self Agent ID (agent wallet ${AGENT_WALLET}).`);
}

const client = new x402Client();
client.setSpendControls({ maxAmountPerPayment: "$0.02" });
client.register("eip155:42220", new ExactEvmScheme(payer, { rpcUrl: RPC }));
const payFetch = wrapFetchWithPayment(baseFetch, client);

// A realistic check: the agent is about to pay ₦1,000 in cNGN to a recipient its user approved.
const recipient = "0x1111111111111111111111111111111111111111";
const body = JSON.stringify({
  chainId: 42220,
  token: CNGN.address,
  to: recipient,
  amount: "1000000000",
  limits: { maxAmount: "5000000000", allowedRecipients: [recipient] },
  suggestedBy: "user",
  purpose: "Errand Guard test check",
});

console.log(`\nPOST ${GUARD_URL}/check (${verified ? "verified" : "unverified"} caller)… the first call can take ~1 min if the service is asleep.`);
const res = await payFetch(`${GUARD_URL}/check`, { method: "POST", headers: { "content-type": "application/json" }, body });
const text = await res.text();
console.log(`HTTP ${res.status} · tier ${res.headers.get("x-errand-guard-tier")} · remaining today ${res.headers.get("x-errand-guard-remaining")}`);
console.log(text);

const settleHeader = res.headers.get("PAYMENT-RESPONSE") ?? res.headers.get("X-PAYMENT-RESPONSE");
const settlement = settleHeader ? decodePaymentResponseHeader(settleHeader) : null;
if (settlement) {
  console.log(`\nPayment settled: ${settlement.success} · tx ${settlement.transaction} · https://celoscan.io/tx/${settlement.transaction}`);
}

let parsed: Record<string, unknown> = {};
try {
  parsed = JSON.parse(text) as Record<string, unknown>;
} catch {
  // keep raw text only
}
mkdirSync(dirname(EVIDENCE_FILE), { recursive: true });
appendFileSync(
  EVIDENCE_FILE,
  `${JSON.stringify({
    at: new Date().toISOString(),
    label: "test (Benjamin's own test wallet; not a user)",
    guard: GUARD_URL,
    caller: verified ? "verified (Self Agent ID 214)" : "unverified",
    payer: payer.address,
    httpStatus: res.status,
    tier: res.headers.get("x-errand-guard-tier"),
    decision: parsed.decision ?? null,
    settlement: settlement ? { success: settlement.success, transaction: settlement.transaction, network: settlement.network } : null,
  })}\n`,
);
console.log(`\nRecorded in evidence/celo/guard-checks.jsonl`);
if (!res.ok) process.exitCode = 1;
