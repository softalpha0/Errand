/**
 * Registers Errand's agent on the canonical ERC-8004 Identity Registry on Celo mainnet,
 * from the agent wallet, with Errand's attribution tag on the transaction.
 * docs/celo/BUILD-PLAN.md Phase 2 · docs/celo/SPONSORS.md §3.
 *
 * Safe by default: without --send it only checks everything and simulates (no transaction, no cost).
 *
 * Run from the repo root (PowerShell or bash, Node 22.18+ runs .ts directly; `pnpm install` first):
 *   node packages/celo/scripts/register-8004.ts            # dry run
 *   node packages/celo/scripts/register-8004.ts --send     # real mainnet transaction (~0.05 CELO gas)
 *
 * Reads the agent key from .self/agent.key (written by `self-agent register export --out-key`).
 * Prints only public data. The key never leaves this machine.
 *
 * Sources (read 23 Nov 2026):
 *   - https://docs.celo.org/build-on-celo/build-with-ai/8004 (registry address, register(agentURI),
 *     read agentId from the Registered event, not the return value)
 *   - https://eips.ethereum.org/EIPS/eip-8004 (Registered(uint256 indexed agentId, string agentURI, address indexed owner))
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createPublicClient, createWalletClient, formatEther, http, parseAbi, parseEventLogs, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { assertTagged, attributionCode, errandAttribution, hasErrandTag } from "../src/attribution.ts";

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const RPC_URL = process.env.CELO_RPC_URL ?? "https://forno.celo.org";
/** Errand's agent wallet (Self Agent ID 214). evidence/celo/identity.md. The key file must match it. */
const EXPECTED_AGENT = (process.env.EXPECTED_AGENT_ADDRESS ?? "0xc64d2153Bd39053913667A5c2eec8250d8AbC005").toLowerCase();
const KEY_FILE = process.env.AGENT_KEY_FILE ?? ".self/agent.key";
const AGENT_URI =
  process.env.AGENT_URI ??
  "https://raw.githubusercontent.com/softalpha0/Errand/celo/apps/web/public/.well-known/errand-agent.json";
const EVIDENCE_FILE = "evidence/celo/erc8004-register.json";
const REGISTRATION_TYPE = "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";

const abi = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "function balanceOf(address owner) view returns (uint256)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);

const send = process.argv.includes("--send");
const force = process.argv.includes("--force");

function fail(message: string): never {
  console.error(`\nSTOP: ${message}`);
  process.exit(1);
}

function readKey(): Hex {
  let raw: string;
  try {
    raw = readFileSync(KEY_FILE, "utf8").trim();
  } catch {
    fail(`can't read ${KEY_FILE}. Run this from the repo root after \`self-agent register export --out-key .self/agent.key\`.`);
  }
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) fail(`${KEY_FILE} doesn't look like a private key.`);
  return key;
}

async function checkAgentCard() {
  const res = await fetch(AGENT_URI, { signal: AbortSignal.timeout(20_000) }).catch((e) => fail(`can't fetch ${AGENT_URI}: ${e}`));
  if (!res.ok) fail(`${AGENT_URI} returned HTTP ${res.status}. Push the agent card to the celo branch first.`);
  let card: Record<string, unknown>;
  try {
    card = (await res.json()) as Record<string, unknown>;
  } catch {
    fail(`${AGENT_URI} is not valid JSON.`);
  }
  if (card.type !== REGISTRATION_TYPE) fail(`agent card "type" must be ${REGISTRATION_TYPE}.`);
  if (typeof card.name !== "string" || !Array.isArray(card.services)) fail("agent card needs a name and services.");
  console.log(`Agent card OK: "${card.name}", ${card.services.length} service(s), at ${AGENT_URI}`);
}

async function main() {
  console.log(`ERC-8004 registration on Celo mainnet (${send ? "SEND" : "dry run"}), tag ${attributionCode()}\n`);

  const account = privateKeyToAccount(readKey());
  console.log(`Agent wallet: ${account.address}`);
  if (account.address.toLowerCase() !== EXPECTED_AGENT) {
    fail(`the key in ${KEY_FILE} is for ${account.address}, not Errand's agent wallet ${EXPECTED_AGENT}.`);
  }

  const publicClient = createPublicClient({ chain: celo, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain: celo, transport: http(RPC_URL) }).extend(errandAttribution());

  await checkAgentCard();

  const owned = await publicClient.readContract({ address: IDENTITY_REGISTRY, abi, functionName: "balanceOf", args: [account.address] });
  console.log(`ERC-8004 identities already owned by the agent: ${owned}`);
  if (owned > 0n && !force) fail("the agent wallet already has an ERC-8004 identity. Not registering twice (use --force only if you really mean it).");

  const balance = await publicClient.getBalance({ address: account.address });
  const { request, result } = await publicClient.simulateContract({
    account,
    address: IDENTITY_REGISTRY,
    abi,
    functionName: "register",
    args: [AGENT_URI],
  });
  console.log(`Simulation OK (would be agentId about ${result}).`);
  console.log(`Agent CELO balance: ${formatEther(balance)}`);
  if (balance === 0n) fail(`the agent wallet has no CELO for gas (about 0.05 CELO needed). Send a little CELO to ${account.address}.`);
  const gas = await publicClient.estimateContractGas({ account, address: IDENTITY_REGISTRY, abi, functionName: "register", args: [AGENT_URI] });
  const gasPrice = await publicClient.getGasPrice();
  const cost = (gas * gasPrice * 12n) / 10n;
  console.log(`Gas ${gas}, about ${formatEther(cost)} CELO with headroom.`);
  if (balance < cost) fail(`the agent wallet needs at least ${formatEther(cost)} CELO for gas. Send a little CELO to ${account.address}.`);

  if (!send) {
    console.log("\nDry run finished. Nothing was sent. Re-run with --send to register for real.");
    return;
  }

  const hash = await walletClient.writeContract(request);
  console.log(`\nSent: ${hash}\nhttps://celoscan.io/tx/${hash}\nWaiting for the receipt...`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (receipt.status !== "success") fail(`transaction reverted: https://celoscan.io/tx/${hash}`);

  const tx = await publicClient.getTransaction({ hash });
  const tagged = hasErrandTag(tx.input);
  const events = parseEventLogs({ abi, logs: receipt.logs, eventName: "Registered" });
  const registered = events.find((e) => e.args.owner.toLowerCase() === account.address.toLowerCase());
  if (!registered) fail("no Registered event for the agent in the receipt.");
  const agentId = registered.args.agentId;

  let verify: unknown = null;
  try {
    verify = await assertTagged(publicClient, hash);
  } catch (e) {
    verify = { error: String(e) };
  }

  const evidence = {
    what: "ERC-8004 registration of Errand's agent (canonical Identity Registry, Celo mainnet)",
    chainId: 42220,
    identityRegistry: IDENTITY_REGISTRY,
    agentRegistry: `eip155:42220:${IDENTITY_REGISTRY}`,
    agentId: agentId.toString(),
    owner: account.address,
    agentURI: AGENT_URI,
    txHash: hash,
    celoscan: `https://celoscan.io/tx/${hash}`,
    blockNumber: receipt.blockNumber.toString(),
    gasUsed: receipt.gasUsed.toString(),
    attributionCode: attributionCode(),
    calldataEndsWithTag: tagged,
    verifyTx: verify,
    recordedAt: new Date().toISOString(),
  };
  mkdirSync("evidence/celo", { recursive: true });
  writeFileSync(EVIDENCE_FILE, `${JSON.stringify(evidence, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2)}\n`);

  console.log(`\nRegistered. ERC-8004 agentId ${agentId}`);
  console.log(`Tag on calldata: ${tagged ? "yes" : "NO"} · verifyTx: ${JSON.stringify(verify, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`);
  console.log(`Evidence written to ${EVIDENCE_FILE}`);
  if (!tagged) process.exitCode = 1;
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
