/**
 * pnpm benchmark
 *
 * Runs the 27 payment cases in packages/core/src/benchmark.ts through three setups
 * (no guard / Errand's fixed rules / rules + SERV) and writes:
 *   evidence/benchmark.json       full results, every decision and reason
 *   evidence/benchmark.md         the table for the write-up
 *   apps/web/src/data/benchmark.json   what the Results page shows
 *
 * Nothing is paid: these are guard decisions only. The SERV column needs
 * SERV_API_KEY (and uses your guard graph if SERV_GUARD_GRAPH_ID is set). It makes
 * one SERV call per case the rules didn't already block, about 11 calls.
 * Without a key the SERV column is left out, and the files say so.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BENCHMARK_SCENARIOS, combine, evaluateNoGuard, evaluateRules, expectedChargeUsd, guardConstraints, spentUsd, summarize, type BenchResult, type BenchScenario } from "@errand/core";
import { env, servConfigured } from "../src/env";
import * as serv from "../src/serv";

const root = path.resolve(import.meta.dirname, "../../..");

async function evaluateServ(s: BenchScenario, rules: BenchResult): Promise<BenchResult & { model: string | null }> {
  if (rules.outcome === "block") return { ...rules, model: null };
  const step = s.ctx.plan.steps.find((x) => x.id === s.candidate.stepId) ?? null;
  try {
    const { reply, meta } = await serv.guard({
      task: s.task,
      step,
      payment: { url: s.candidate.url, method: s.candidate.method, body: s.candidate.body, priceUsd: s.candidate.priceUsd, recipient: s.candidate.recipient, plannedProductUsd: expectedChargeUsd(s.candidate), note: s.candidate.note },
      rules: { outcome: rules.outcome, rule: rules.rule, reason: rules.reason },
      spentUsd: spentUsd(s.ctx.payments),
      budgetUsd: s.ctx.limits.totalMaxUsd,
      earlierFacts: s.earlierFacts,
      earlierDecisions: [],
      constraints: guardConstraints(s.ctx.plan.constraints, step?.type),
    });
    const servResult = { outcome: reply.decision, rule: meta.model.startsWith("gr_") ? "serv.graph" : "serv.shadow_agent", reason: reply.reason };
    const final = combine(rules, servResult);
    return { outcome: final.outcome, rule: final.rule, reason: final.reason, model: meta.model };
  } catch (err) {
    // Errand never pays without a check: an unreachable SERV means "ask".
    return { outcome: "ask", rule: "serv.unavailable", reason: serv.servErrorMessage(err), model: null };
  }
}

const label = (r: BenchResult | null) => (r === null ? "not run" : r.outcome === "approve" ? "Paid" : r.outcome === "ask" ? "Asked you" : "Blocked");

async function main() {
  const useServ = servConfigured();
  console.log(`Running ${BENCHMARK_SCENARIOS.length} cases. SERV: ${useServ ? (env.serv.guardGraphId ? `graph ${env.serv.guardGraphId}` : "Shadow Agent") : "not configured (column skipped)"}`);

  const cases: { id: string; kind: string; category: string; title: string; how: string; servOnly: boolean; priceUsd: number; none: BenchResult; rules: BenchResult; serv: (BenchResult & { model: string | null }) | null }[] = [];
  for (const s of BENCHMARK_SCENARIOS) {
    const none = evaluateNoGuard(s);
    const rules = evaluateRules(s);
    const withServ = useServ ? await evaluateServ(s, rules) : null;
    cases.push({ id: s.id, kind: s.kind, category: s.category, title: s.title, how: s.how, servOnly: s.servOnly, priceUsd: s.candidate.priceUsd, none, rules, serv: withServ });
    console.log(`${s.id.padEnd(4)} ${s.title.padEnd(46).slice(0, 46)}  none: ${label(none).padEnd(9)} rules: ${label(rules).padEnd(9)} serv: ${label(withServ)}`);
  }

  const pick = (k: "none" | "rules" | "serv") => cases.map((c) => ({ s: BENCHMARK_SCENARIOS.find((x) => x.id === c.id)!, r: c[k]! }));
  const summary = {
    none: summarize("none", pick("none")),
    rules: summarize("rules", pick("rules")),
    serv: useServ ? summarize("serv", pick("serv")) : null,
  };
  const out = {
    ranAt: new Date().toISOString(),
    guardVersion: useServ ? env.serv.guardVersion : null,
    servModel: useServ ? (env.serv.guardGraphId || `${env.serv.model} + serv_shadow_agent`) : null,
    note: "Guard decisions only; nothing is paid. 'Asked you' counts as stopped: money only moves if the person says yes.",
    summary,
    cases,
  };

  mkdirSync(path.join(root, "evidence"), { recursive: true });
  mkdirSync(path.join(root, "apps/web/src/data"), { recursive: true });
  writeFileSync(path.join(root, "evidence/benchmark.json"), JSON.stringify(out, null, 2));
  writeFileSync(path.join(root, "apps/web/src/data/benchmark.json"), JSON.stringify(out, null, 2));

  const pct = (a: number, b: number) => `${Math.round((a / b) * 100)}%`;
  const line = (name: string, x: typeof summary.none | null) =>
    x ? `| ${name} | ${x.attacksPaid} of ${x.attacks} (${pct(x.attacksPaid, x.attacks)}) | ${x.attacksAsked} | ${x.attacksBlocked} | ${x.controlsPaid} of ${x.controls} |` : `| ${name} | not run (no SERV key) | | | |`;
  const md = [
    "# Attack benchmark",
    "",
    `Run ${out.ranAt}${out.servModel ? ` · SERV: ${out.servModel} (${out.guardVersion})` : ""}. Re-run with \`pnpm benchmark\`.`,
    "",
    "The same 27 payment cases (20 attacks, 7 legitimate payments) through three setups. Nothing is paid; these are the guard's decisions. \"Asked you\" counts as stopped.",
    "",
    "| Setup | Attacks paid | Asked you | Blocked | Legitimate payments paid |",
    "|---|---|---|---|---|",
    line("No guard (Kite session caps only)", summary.none),
    line("Errand's fixed rules (R1–R13)", summary.rules),
    line("Rules + SERV guard", summary.serv),
    "",
    "## Every case",
    "",
    "| Case | Attack | No guard | Rules | Rules + SERV | Stopped by |",
    "|---|---|---|---|---|---|",
    ...cases.map((c) => `| ${c.id} | ${c.title}${c.servOnly ? " *(judgement only)*" : ""} | ${label(c.none)} | ${label(c.rules)} | ${label(c.serv)} | ${(c.serv ?? c.rules).outcome === "approve" ? "—" : (c.serv ?? c.rules).rule} |`),
    "",
    "Cases marked *judgement only* pass every fixed rule by design (the right price, the right recipient, but the wrong product or a steered choice). They show what the SERV layer adds.",
    "",
  ].join("\n");
  writeFileSync(path.join(root, "evidence/benchmark.md"), md);
  console.log("\nWrote evidence/benchmark.md, evidence/benchmark.json, apps/web/src/data/benchmark.json");
  console.log(md.split("\n").slice(6, 11).join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
