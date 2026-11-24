/**
 * Errand Guard server entry. Env (see .env.example):
 *   X402_API_KEY   Celo facilitator key from https://x402.celo.org (required to settle payments). Secret.
 *   PAY_TO         Address that receives payments (default: Errand's agent wallet, registered on Loops as PayTo).
 *   PRICE_ATOMIC   Price per check in USD₮ smallest units (default 10000 = $0.01).
 *   PORT           Default 8790.
 */
import { serve } from "@hono/node-server";
import { createPublicClient, getAddress, http } from "viem";
import { SelfAgentVerifier } from "@selfxyz/agent-sdk";
import { attributionCode } from "@errand/celo";
import { assertTokenDecimals } from "@errand/celo/tokens";
import { createGuardApp } from "./app.js";
import { CELO_MAINNET, x402PaymentMiddleware } from "./x402.js";

const ERRAND_AGENT_WALLET = "0xc64d2153Bd39053913667A5c2eec8250d8AbC005";

const payTo = getAddress(process.env.PAY_TO ?? ERRAND_AGENT_WALLET);
const priceAtomic = process.env.PRICE_ATOMIC ?? "10000";
if (!/^\d+$/.test(priceAtomic) || BigInt(priceAtomic) === 0n || BigInt(priceAtomic) > 1_000_000n) {
  throw new Error("PRICE_ATOMIC must be a whole number of USD₮ smallest units between 1 and 1000000 ($1).");
}
const apiKey = process.env.X402_API_KEY?.trim() || undefined;
const port = Number(process.env.PORT ?? 8790);
const code = attributionCode();

// USD₮ must be the 6-decimal token, never the 18-decimal adapter (SPONSORS.md §1).
await assertTokenDecimals(createPublicClient({ transport: http(process.env.CELO_RPC_URL ?? "https://forno.celo.org") }));

// Mainnet Self Agent ID registry; 1 agent per human (SDK default); replay protection on.
const verifier = SelfAgentVerifier.create().network("mainnet").sybilLimit(1).build();

const app = createGuardApp({
  payTo,
  priceAtomic,
  priceLabel: `$${(Number(priceAtomic) / 1e6).toFixed(Number(priceAtomic) % 10000 === 0 ? 2 : 6)} USD₮ per check`,
  network: CELO_MAINNET,
  attributionCode: code,
  verifySelf: (p) => verifier.verify(p),
  payment: x402PaymentMiddleware({ payTo, priceAtomic, attributionCode: code, apiKey }),
  facilitatorConfigured: Boolean(apiKey),
});

if (!apiKey) console.warn("X402_API_KEY is not set: the 402 challenge works, but payments can't be settled.");
serve({ fetch: app.fetch, port }, (info) => console.log(`Errand Guard on :${info.port} · PayTo ${payTo} · ${priceAtomic} USD₮ units per check`));
