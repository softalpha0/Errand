/**
 * Errand Guard on Celo: other agents pay a small USD₮ fee over x402 to have a payment checked
 * before they make it. Self Agent ID decides who gets served and how often.
 *
 * Order on POST /check (everything that refuses runs BEFORE payment, so a refused agent is never charged):
 *   1. read the exact raw body; validate it                     → 400, no charge
 *   2. verify x-self-agent-* headers with SelfAgentVerifier      → tier verified | unverified
 *   3. daily limit for that tier (per human / per IP)            → 429, no charge
 *   4. x402 payment ($0.01 USD₮ by default, PayTo = Errand's agent wallet) → 402 until paid
 *   5. run the check (rules G1–G8) and answer approve | ask | block
 */
import { Hono, type MiddlewareHandler } from "hono";
import { checkPayment, parsePayment, type PaymentToCheck } from "./check.js";
import { DAILY_LIMITS, DailyLimiter, type Tier } from "./limits.js";

/** The subset of SelfAgentVerifier.verify() the gate needs (SDK 0.3.1). Injected so tests can fake it. */
export type SelfVerify = (params: {
  signature: string;
  timestamp: string;
  method: string;
  url: string;
  body?: string;
  keytype?: string;
  agentKey?: string;
}) => Promise<{ valid: boolean; agentAddress: string; agentId: bigint; nullifier: bigint; error?: string }>;

export type GuardConfig = {
  payTo: string;
  priceAtomic: string;
  priceLabel: string;
  network: string;
  attributionCode: string;
  verifySelf: SelfVerify;
  /** x402 payment middleware for POST /check (real one from @x402/hono, or a pass-through in tests). */
  payment: MiddlewareHandler;
  limiter?: DailyLimiter;
  facilitatorConfigured: boolean;
};

type GuardVars = {
  guard: { tier: Tier; callerId: string; agentId?: string; selfError?: string; payment: PaymentToCheck };
};

function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}

function secondsUntilUtcMidnight(now = Date.now()): number {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return Math.ceil((next - now) / 1000);
}

export function createGuardApp(cfg: GuardConfig) {
  const limiter = cfg.limiter ?? new DailyLimiter();
  const app = new Hono<{ Variables: GuardVars }>();

  app.get("/", (c) =>
    c.json({
      name: "Errand Guard",
      what: "Check a payment on Celo before your agent makes it. Answers approve, ask or block, with reasons.",
      endpoint: { method: "POST", path: "/check", contentType: "application/json" },
      price: { amount: cfg.priceAtomic, asset: "USD₮ (0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e, 6 decimals)", label: cfg.priceLabel, protocol: "x402", network: cfg.network },
      payTo: cfg.payTo,
      tiers: {
        verified: `${DAILY_LIMITS.verified} checks a day per human. Sign requests with a Self Agent ID (x-self-agent-* headers, @selfxyz/agent-sdk).`,
        unverified: `${DAILY_LIMITS.unverified} checks a day per IP address.`,
      },
      refusedBeforePayment: ["400 invalid body", "429 daily limit reached"],
      body: {
        chainId: 42220,
        token: "0x… ERC-20 address",
        to: "0x… recipient",
        amount: "smallest unit, decimal string",
        limits: { maxAmount: "optional", allowedRecipients: ["optional"] },
        suggestedBy: "user | agent | seller (optional)",
        purpose: "optional, ≤280 chars",
      },
      operator: { name: "Errand", erc8004AgentId: 10107, selfAgentId: 214, agentWallet: cfg.payTo },
      attributionCode: cfg.attributionCode,
      source: "https://github.com/softalpha0/Errand/tree/celo/apps/guard-celo",
    }),
  );

  app.get("/health", (c) => c.json({ ok: true, network: cfg.network, payTo: cfg.payTo, facilitator: cfg.facilitatorConfigured ? "configured" : "missing X402_API_KEY" }));

  const selfGate: MiddlewareHandler<{ Variables: GuardVars }> = async (c, next) => {
    const raw = await c.req.text();
    let json: unknown;
    try {
      json = raw ? JSON.parse(raw) : undefined;
    } catch {
      return c.json({ error: "Body must be JSON.", charged: false }, 400);
    }
    const parsed = parsePayment(json);
    if (!parsed.ok) return c.json({ error: "Invalid payment description.", problems: parsed.problems, charged: false }, 400);

    let tier: Tier = "unverified";
    let callerId = `ip:${clientIp(c.req.raw.headers)}`;
    let agentId: string | undefined;
    let selfError: string | undefined;
    const signature = c.req.header("x-self-agent-signature");
    const timestamp = c.req.header("x-self-agent-timestamp");
    if (signature && timestamp) {
      try {
        const keytype = c.req.header("x-self-agent-keytype");
        const agentKey = c.req.header("x-self-agent-key");
        const result = await cfg.verifySelf({
          signature,
          timestamp,
          method: c.req.method,
          url: c.req.url,
          body: raw,
          ...(keytype ? { keytype } : {}),
          ...(agentKey ? { agentKey } : {}),
        });
        if (result.valid) {
          tier = "verified";
          callerId = result.nullifier > 0n ? `human:${result.nullifier}` : `agent:${result.agentAddress.toLowerCase()}`;
          agentId = result.agentId.toString();
        } else {
          selfError = result.error ?? "Self Agent ID check failed.";
        }
      } catch (e) {
        selfError = `Self Agent ID check could not run: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    const quota = limiter.peek(tier, callerId);
    c.header("x-errand-guard-tier", tier);
    c.header("x-errand-guard-remaining", String(quota.remaining));
    if (quota.remaining === 0) {
      c.header("Retry-After", String(secondsUntilUtcMidnight()));
      return c.json(
        {
          error: `Daily limit reached for ${tier} agents (${quota.limit} checks a day).`,
          tier,
          charged: false,
          ...(tier === "unverified"
            ? { howToGetMore: `Sign your requests with a Self Agent ID to get ${DAILY_LIMITS.verified} checks a day: https://docs.self.xyz/docs/agent-id/overview/` }
            : {}),
          ...(selfError ? { selfAgentId: selfError } : {}),
        },
        429,
      );
    }
    c.set("guard", { tier, callerId, ...(agentId ? { agentId } : {}), ...(selfError ? { selfError } : {}), payment: parsed.payment });
    await next();
  };

  app.post("/check", selfGate, cfg.payment, (c) => {
    const g = c.get("guard");
    const result = checkPayment(g.payment, limiter.recentFingerprints(g.callerId));
    limiter.record(g.tier, g.callerId);
    limiter.remember(g.callerId, result.fingerprint);
    const quota = limiter.peek(g.tier, g.callerId);
    c.header("x-errand-guard-remaining", String(quota.remaining));
    return c.json({
      decision: result.decision,
      findings: result.findings,
      tier: g.tier,
      ...(g.agentId ? { selfAgentId: g.agentId } : {}),
      ...(g.selfError ? { selfAgentIdProblem: g.selfError } : {}),
      remainingToday: quota.remaining,
      checkedBy: "Errand Guard (ERC-8004 agentId 10107)",
    });
  });

  return app;
}
