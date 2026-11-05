import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { CreateErrandSchema, CreateStandingSchema, ENDPOINTS, SELLERS, ShippingSchema, checkExternal, combine, errandMetrics, statsByVersion, type Errand } from "@errand/core";
import { z } from "zod";
import * as serv from "./serv";
import { subscribe } from "./bus";
import { env, reppoConfigured, servConfigured } from "./env";
import { kpassVersion } from "./kite";
import { reppoPaused } from "./reppo";
import * as passports from "./passports";
import { answerQuestion, approveDemo, cancelErrand, createErrand } from "./runner";
import { createStanding, getStanding, listStanding, runStanding, setState } from "./standing";
import { store } from "./store";

export const VERSION = "0.1.0";

/** What the browser may see. Raw kpass output stays on the server. */
function publicErrand(e: Errand): Errand {
  return { ...e, payments: e.payments.map(({ raw: _raw, ...p }) => p) };
}

// Simple per-IP limit on starting errands: 10 per 10 minutes.
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const t = Date.now();
  const list = (hits.get(ip) ?? []).filter((x) => t - x < 10 * 60_000);
  list.push(t);
  hits.set(ip, list);
  return list.length > 10;
}

export function createApp() {
  const app = new Hono();
  const origins = env.webOrigin.split(",").map((s) => s.trim());
  app.use("*", cors({ origin: (o) => (origins.includes(o) || origins.includes("*") ? o : origins[0]!), allowHeaders: ["Content-Type", "x-access-code", "x-passport-token"], allowMethods: ["GET", "POST", "OPTIONS"] }));

  app.get("/health", async (c) =>
    c.json({
      ok: true,
      version: VERSION,
      mode: env.mode,
      store: store.kind,
      serv: servConfigured() ? (env.serv.guardGraphId ? "graph" : "shadow-agent") : "not configured",
      guardVersion: env.serv.guardVersion,
      kpass: env.mode === "live" ? await kpassVersion() : null,
      reppo: reppoConfigured() ? (reppoPaused() ? "paused: out of credits" : env.reppo.sandbox ? "sandbox" : "live") : "not configured",
    }),
  );

  app.get("/config", (c) =>
    c.json({
      mode: env.mode,
      maxBudgetUsd: env.maxBudgetUsd,
      accessCodeRequired: env.mode === "live" && env.accessCode.length > 0,
      guardVersion: env.serv.guardVersion,
      sellers: Object.values(SELLERS),
      endpoints: ENDPOINTS,
      telegram: env.telegram.token.length > 0,
    }),
  );

  // ---------- each person's own Kite Passport ----------

  const token = (c: Context) => c.req.header("x-passport-token") ?? null;

  /** Live errands on the operator's Passport need the access code; on your own Passport they don't. */
  async function payer(c: Context): Promise<{ passportId: string | null; error: string | null }> {
    let passportId: string | null = null;
    try {
      passportId = await passports.resolve(token(c));
    } catch (err) {
      return { passportId: null, error: (err as Error).message };
    }
    if (!passportId && env.mode === "live" && env.accessCode && c.req.header("x-access-code") !== env.accessCode) {
      return { passportId: null, error: "Live errands on Errand's own wallet need the access code. Connect your own Kite Passport instead, or try the demo." };
    }
    return { passportId, error: null };
  }

  app.post("/passport/login", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { email?: string };
    const email = z.string().email().safeParse(body.email);
    if (!email.success) return c.json({ error: "Enter the email you use for Kite Passport." }, 400);
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (limited(`login:${ip}`)) return c.json({ error: "Too many login attempts. Try again in a few minutes." }, 429);
    try {
      return c.json(await passports.startLogin(email.data), 201);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 502);
    }
  });

  app.post("/passport/verify", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { passportId?: string; code?: string };
    if (!body.passportId || !body.code) return c.json({ error: "Send the code from Kite's email." }, 400);
    try {
      return c.json(await passports.verifyLogin(body.passportId, body.code));
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.get("/passport/me", async (c) => {
    const me = await passports.me(token(c));
    return me ? c.json(me) : c.json({ error: "Not connected." }, 404);
  });

  app.post("/passport/shipping", async (c) => {
    const parsed = ShippingSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, 400);
    try {
      return c.json(await passports.updateShipping(token(c), parsed.data));
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.post("/passport/logout", async (c) => c.json({ ok: await passports.disconnect(token(c)) }));

  // ---------- standing errands (metered, on the Kite allowance) ----------

  app.post("/standing", async (c) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (limited(ip)) return c.json({ error: "Too many errands from this address. Try again in a few minutes." }, 429);
    const who = await payer(c);
    if (who.error) return c.json({ error: who.error }, 401);
    const parsed = CreateStandingSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.issues.map((i) => i.message).join(" ") }, 400);
    if (parsed.data.maxPerPaymentUsd > parsed.data.capPerRunUsd) return c.json({ error: "The per-payment limit can't be more than the cap per run." }, 400);
    const r = await createStanding(parsed.data, who.passportId);
    return c.json({ id: r.standing.id, errandId: r.errandId }, 201);
  });

  app.get("/standing", async (c) => {
    let passportId: string | null = null;
    try {
      passportId = await passports.resolve(token(c));
    } catch (err) {
      return c.json({ error: (err as Error).message }, 401);
    }
    return c.json(await listStanding(passportId));
  });

  app.get("/standing/:id", async (c) => {
    const s = await getStanding(c.req.param("id"));
    return s ? c.json(s) : c.json({ error: "No standing errand with that id." }, 404);
  });

  app.post("/standing/:id/run", async (c) => {
    const who = await payer(c);
    if (who.error) return c.json({ error: who.error }, 401);
    const s = await getStanding(c.req.param("id"));
    if (!s || s.passportId !== who.passportId) return c.json({ error: "No standing errand with that id." }, 404);
    if (!s.plan) return c.json({ error: "Approve the first run's plan first." }, 409);
    const errandId = await runStanding(s.id, "manual");
    return errandId ? c.json({ errandId }) : c.json({ error: (await getStanding(s.id))?.runs.at(-1)?.note ?? "This run was skipped." }, 409);
  });

  app.post("/standing/:id/state", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { state?: string };
    if (!body.state || !["active", "paused", "stopped"].includes(body.state)) return c.json({ error: "state must be active, paused or stopped." }, 400);
    let passportId: string | null = null;
    try {
      passportId = await passports.resolve(token(c));
    } catch (err) {
      return c.json({ error: (err as Error).message }, 401);
    }
    const s = await setState(c.req.param("id"), passportId, body.state as "active" | "paused" | "stopped");
    return s ? c.json(s) : c.json({ error: "No standing errand with that id, or its first plan isn't approved yet." }, 404);
  });

  // ---------- public profile for Kite's agent directory (docs/kite-directory.md) ----------

  app.get("/agent-card", (c) =>
    c.json({
      name: "Errand",
      description: "Runs paid errands (research, top-ups, eSIMs, gift cards, Amazon orders, emails, calls) inside a budget, checking every payment with SERV Reasoning before Kite Passport pays it.",
      kind: "seller",
      offerings: [
        { id: "errand-guard", name: "Errand Guard", summary: "Check one payment before an agent makes it: approve, ask or block, with a reason.", priceUsd: 0.01, protocol: "x402", path: "POST /v1/check" },
        { id: "errand-run", name: "Run an errand", summary: "Start an errand from another agent (MCP server, apps/mcp).", priceUsd: null, protocol: "mcp", path: "start_errand" },
      ],
      paymentNetworks: ["eip155:2366 (Kite, USDC.e)"],
      source: "https://github.com/softalpha0/Errand",
    }),
  );

  app.post("/errands", async (c) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (limited(ip)) return c.json({ error: "Too many errands from this address. Try again in a few minutes." }, 429);
    const who = await payer(c);
    if (who.error) return c.json({ error: who.error }, 401);
    const parsed = CreateErrandSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.issues.map((i) => i.message).join(" ") }, 400);
    if (parsed.data.maxPerPaymentUsd > parsed.data.budgetUsd) return c.json({ error: "The per-payment limit can't be more than the budget." }, 400);
    const e = await createErrand(parsed.data, { passportId: who.passportId });
    return c.json({ id: e.id }, 201);
  });

  app.get("/errands", async (c) => {
    const limit = Math.min(Number(c.req.query("limit") ?? 20) || 20, 100);
    const list = await store.list(limit);
    return c.json(
      list.map((e) => ({ id: e.id, task: e.task, status: e.status, mode: e.mode, createdAt: e.createdAt, budgetUsd: e.budgetUsd, metrics: errandMetrics(e), evaluation: e.evaluation && { status: e.evaluation.status, score: e.evaluation.score, decision: e.evaluation.decision } })),
    );
  });

  app.get("/errands/:id", async (c) => {
    const e = await store.get(c.req.param("id"));
    return e ? c.json(publicErrand(e)) : c.json({ error: "No errand with that id." }, 404);
  });

  app.get("/errands/:id/stream", async (c) => {
    const id = c.req.param("id");
    const first = await store.get(id);
    if (!first) return c.json({ error: "No errand with that id." }, 404);
    return streamSSE(c, async (stream) => {
      let open = true;
      const send = (e: Errand) => stream.writeSSE({ event: "errand", data: JSON.stringify(publicErrand(e)) }).catch(() => (open = false));
      await send(first);
      const off = subscribe(id, (e) => void send(e));
      stream.onAbort(() => {
        open = false;
        off();
      });
      while (open) {
        await stream.sleep(15_000);
        await stream.writeSSE({ event: "ping", data: "" }).catch(() => (open = false));
      }
      off();
    });
  });

  app.post("/errands/:id/answer", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { questionId?: string; answer?: string };
    if (!body.questionId || !body.answer?.trim()) return c.json({ error: "Send questionId and answer." }, 400);
    const ok = await answerQuestion(c.req.param("id"), body.questionId, body.answer.trim().slice(0, 500));
    return ok ? c.json({ ok: true }) : c.json({ error: "That question is no longer waiting for an answer." }, 409);
  });

  // In-app approval: demo errands, and plans paid from the Kite allowance (approved once on Kite).
  const approve = async (c: Context) => {
    const e = await store.get(c.req.param("id") ?? "");
    if (!e) return c.json({ error: "No errand with that id." }, 404);
    if (env.mode !== "demo" && e.funding !== "allowance") return c.json({ error: "Live errands are approved in Kite Passport with your passkey." }, 400);
    if (e.passportId) {
      const mine = await passports.resolve(token(c)).catch(() => null);
      if (mine !== e.passportId) return c.json({ error: "Only the Passport owner can approve this plan." }, 403);
    }
    const ok = await approveDemo(e.id);
    return ok ? c.json({ ok: true }) : c.json({ error: "This errand is not waiting for approval." }, 409);
  };
  app.post("/errands/:id/approve", approve);
  app.post("/errands/:id/demo-approve", approve);

  app.post("/errands/:id/cancel", async (c) => {
    const ok = await cancelErrand(c.req.param("id"));
    return ok ? c.json({ ok: true }) : c.json({ error: "This errand has already finished." }, 409);
  });

  app.get("/stats", async (c) => {
    const list = await store.list(500);
    const done = list.filter((e) => e.status === "done").reverse();
    return c.json({
      byVersion: statsByVersion(done),
      series: done.map((e) => ({ id: e.id, at: e.createdAt, guardVersion: e.guardVersion, mode: e.mode, ...errandMetrics(e) })),
    });
  });

  // Upstream of the public guard service on Kite (kite-service/errand-guard).
  // The x402 wrapper charges the caller, then forwards here with the shared token.
  const CheckSchema = z.object({
    task: z.string().min(3).max(4000),
    payment: z.object({
      url: z.string().max(2000),
      method: z.string().max(10).default("GET"),
      priceUsd: z.number().nonnegative(),
      recipient: z.string().max(200).optional(),
      note: z.string().max(2000).optional(),
    }),
    budgetUsd: z.number().nonnegative().optional(),
    spentUsd: z.number().nonnegative().optional(),
    maxPerPaymentUsd: z.number().nonnegative().optional(),
    approvedRecipients: z.array(z.string().max(200)).max(50).optional(),
    earlierText: z.string().max(20000).optional(),
    constraints: z.array(z.string().max(300)).max(20).optional(),
  });

  app.post("/check", async (c) => {
    if (!env.guardServiceToken || c.req.header("x-guard-token") !== env.guardServiceToken) return c.json({ error: "Not found." }, 404);
    const parsed = CheckSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, 400);
    const x = parsed.data;
    const rules = checkExternal(x);
    let servResult: { outcome: "approve" | "ask" | "block"; rule: string; reason: string } | null = null;
    let model: string | null = null;
    if (rules.outcome !== "block" && servConfigured()) {
      try {
        const { reply, meta } = await serv.guard({
          task: x.task,
          step: null,
          payment: x.payment,
          rules,
          spentUsd: x.spentUsd ?? 0,
          budgetUsd: x.budgetUsd ?? x.payment.priceUsd,
          earlierFacts: x.earlierText ? [x.earlierText.slice(0, 4000)] : [],
          earlierDecisions: [],
          constraints: x.constraints ?? [],
        });
        servResult = { outcome: reply.decision, rule: meta.model.startsWith("gr_") ? "serv.graph" : "serv.shadow_agent", reason: reply.reason };
        model = meta.model;
      } catch (err) {
        servResult = { outcome: "ask", rule: "serv.unavailable", reason: `${serv.servErrorMessage(err)} Confirm with the user.` };
      }
    }
    const final = combine(rules, servResult);
    return c.json({ decision: final.outcome, reason: final.reason, rule: final.rule, decidedBy: final === rules ? "rules" : "serv", model, guardVersion: env.serv.guardVersion });
  });

  app.notFound((c) => c.json({ error: "Not found." }, 404));
  app.onError((err, c) => c.json({ error: err.message || "Something went wrong on the agent." }, 500));
  return app;
}
