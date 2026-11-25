/**
 * Errand's TOOLS wallet: pays for Errand's own tool calls on buy (the $0.01 independent receipt
 * check, /api/receipt/verify). Separate from the agent wallet (identity, PayTo) and from the test
 * wallet, so it can live on the server with only a few cents in it.
 *
 * Run from the repo root:
 *   pnpm --filter @errand/celo tools-wallet               # creates .self/tools-payer.key once, shows address + balance
 *   pnpm --filter @errand/celo tools-wallet -- --show-key # prints the key once, to paste into Vercel as TOOLS_PAYER_KEY
 * The key file is git-ignored (.self/). Fund the address with ~$0.50 USD₮ on Celo (50 checks). No CELO needed:
 * buy's facilitator pays the network fee.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { USDT, erc20Abi, formatUnitsExact } from "../src/tokens.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const KEY_FILE = resolve(ROOT, ".self/tools-payer.key");

if (!existsSync(KEY_FILE)) {
  mkdirSync(dirname(KEY_FILE), { recursive: true });
  writeFileSync(KEY_FILE, `${generatePrivateKey()}\n`, { mode: 0o600 });
  console.log("Created Errand's tools wallet. Key saved in .self/tools-payer.key (git-ignored).");
}

const key = readFileSync(KEY_FILE, "utf8").trim() as Hex;
const account = privateKeyToAccount(key);
const client = createPublicClient({ transport: http(process.env.CELO_RPC_URL ?? "https://forno.celo.org") });
const balance = await client.readContract({ address: USDT.address, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });

console.log(`Tools wallet address: ${account.address}`);
console.log(`USD₮ balance: ${formatUnitsExact(balance, USDT.decimals)} (each independent check costs 0.01)`);
if (process.argv.includes("--show-key")) {
  console.log("\nPaste this into Vercel → errand-thgw → Settings → Environment Variables as TOOLS_PAYER_KEY (Production), then redeploy.");
  console.log("Don't share it anywhere else.\n");
  console.log(key);
}
