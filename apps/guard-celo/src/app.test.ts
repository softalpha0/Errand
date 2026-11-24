import { describe, expect, it, vi } from "vitest";
import type { MiddlewareHandler } from "hono";
import { CNGN } from "@errand/celo/tokens";
import { createGuardApp, type SelfVerify } from "./app.js";
import { DailyLimiter } from "./limits.js";

const PAY_TO = "0xc64d2153Bd39053913667A5c2eec8250d8AbC005";
const body = JSON.stringify({ chainId: 42220, token: CNGN.address, to: "0x1111111111111111111111111111111111111111", amount: "1000000" });

function setup(verify?: SelfVerify) {
  const paid = vi.fn();
  const payment: MiddlewareHandler = async (_c, next) => {
    paid();
    await next();
  };
  const verifySelf: SelfVerify =
    verify ??
    (async () => ({ valid: true, agentAddress: "0xabc0000000000000000000000000000000000abc", agentId: 214n, nullifier: 99n }));
  const app = createGuardApp({
    payTo: PAY_TO,
    priceAtomic: "10000",
    priceLabel: "$0.01 USD₮ per check",
    network: "eip155:42220",
    attributionCode: "celo_511bb691f2f0",
    verifySelf,
    payment,
    limiter: new DailyLimiter(),
    facilitatorConfigured: true,
  });
  const post = (headers: Record<string, string> = {}, b = body) =>
    app.request("/check", { method: "POST", body: b, headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.1", ...headers } });
  return { app, paid, post };
}

const signed = { "x-self-agent-signature": "0xsig", "x-self-agent-timestamp": String(Date.now()), "x-self-agent-address": "0xabc" };

describe("Errand Guard app", () => {
  it("describes itself for free", async () => {
    const { app } = setup();
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const j = (await res.json()) as { payTo: string; attributionCode: string };
    expect(j.payTo).toBe(PAY_TO);
    expect(j.attributionCode).toBe("celo_511bb691f2f0");
  });

  it("refuses an invalid body with 400 before payment", async () => {
    const { post, paid } = setup();
    const res = await post({}, JSON.stringify({ chainId: 42220 }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { charged: boolean }).charged).toBe(false);
    expect(paid).not.toHaveBeenCalled();
  });

  it("serves an unverified agent 3 times a day, then 429 without charging", async () => {
    const { post, paid } = setup();
    for (let i = 0; i < 3; i++) {
      const res = await post();
      expect(res.status).toBe(200);
      expect(res.headers.get("x-errand-guard-tier")).toBe("unverified");
    }
    const fourth = await post();
    expect(fourth.status).toBe(429);
    const j = (await fourth.json()) as { charged: boolean; howToGetMore?: string };
    expect(j.charged).toBe(false);
    expect(j.howToGetMore).toMatch(/Self Agent ID/);
    expect(paid).toHaveBeenCalledTimes(3);
  });

  it("serves a Self-verified agent on the higher limit and passes the raw body to the verifier", async () => {
    const verify = vi.fn<SelfVerify>(async () => ({ valid: true, agentAddress: "0xabc", agentId: 214n, nullifier: 7n }));
    const { post } = setup(verify);
    for (let i = 0; i < 5; i++) expect((await post(signed)).status).toBe(200);
    const res = await post(signed);
    const j = (await res.json()) as { tier: string; selfAgentId: string; remainingToday: number; decision: string };
    expect(j.tier).toBe("verified");
    expect(j.selfAgentId).toBe("214");
    expect(j.remainingToday).toBe(94);
    expect(verify.mock.calls[0]![0].body).toBe(body);
    expect(verify.mock.calls[0]![0].method).toBe("POST");
  });

  it("treats a failed Self check as unverified and says why", async () => {
    const { post } = setup(async () => ({ valid: false, agentAddress: "", agentId: 0n, nullifier: 0n, error: "Agent not registered" }));
    const res = await post(signed);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { tier: string; selfAgentIdProblem: string };
    expect(j.tier).toBe("unverified");
    expect(j.selfAgentIdProblem).toBe("Agent not registered");
  });

  it("returns the check decision (G8 seller-suggested → block)", async () => {
    const { post } = setup();
    const res = await post(signed, JSON.stringify({ ...JSON.parse(body), suggestedBy: "seller" }));
    const j = (await res.json()) as { decision: string; findings: { rule: string }[] };
    expect(j.decision).toBe("block");
    expect(j.findings[0]!.rule).toBe("G8");
  });

  it("asks on a duplicate from the same caller", async () => {
    const { post } = setup();
    await post(signed);
    const j = (await (await post(signed)).json()) as { decision: string };
    expect(j.decision).toBe("ask");
  });
});
