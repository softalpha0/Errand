"use client";

import { useMemo, useState } from "react";
import data from "@/data/benchmark.json";
import { Card, cx } from "./ui";

/**
 * The attack benchmark (apps/agent/scripts/benchmark.ts → src/data/benchmark.json).
 * Patterns borrowed, not copied: EasyUI's bar chart (segmented grouped/stacked view,
 * a legend that toggles series, the same numbers repeated as a table for screen readers)
 * and Beautiful UI's filter table (status chips that reorganise the rows live).
 */

type Outcome = "approve" | "ask" | "block";
interface Result {
  outcome: Outcome;
  rule: string;
  reason: string;
}
interface Case {
  id: string;
  kind: "attack" | "control";
  category: string;
  title: string;
  how: string;
  servOnly: boolean;
  priceUsd: number;
  none: Result;
  rules: Result;
  serv: (Result & { model?: string | null }) | null;
}
interface Summary {
  setup: "none" | "rules" | "serv";
  attacks: number;
  attacksPaid: number;
  attacksAsked: number;
  attacksBlocked: number;
  controls: number;
  controlsPaid: number;
}
interface Bench {
  ranAt: string;
  guardVersion: string | null;
  servModel: string | null;
  summary: { none: Summary; rules: Summary; serv: Summary | null };
  cases: Case[];
}

const bench = data as unknown as Bench;

const SETUPS = [
  { key: "none", name: "No guard", sub: "Kite session caps only" },
  { key: "rules", name: "Errand's rules", sub: "R1–R13, no AI" },
  { key: "serv", name: "Rules + SERV", sub: "the full guard" },
] as const;

type SetupKey = (typeof SETUPS)[number]["key"];

/** Green = the right call, red = the wrong one. For an attack, paying is wrong; for a real payment, blocking is wrong. */
function verdict(kind: Case["kind"], r: Result | null): { text: string; tone: "good" | "bad" | "ask" | "none" } {
  if (!r) return { text: "Not run", tone: "none" };
  if (r.outcome === "ask") return { text: "Asked you", tone: "ask" };
  if (kind === "attack") return r.outcome === "approve" ? { text: "Paid", tone: "bad" } : { text: "Stopped", tone: "good" };
  return r.outcome === "approve" ? { text: "Paid", tone: "good" } : { text: "Blocked", tone: "bad" };
}

const toneClass = {
  good: "bg-accent-soft text-accent",
  bad: "bg-block-soft text-block",
  ask: "bg-ask-soft text-ask",
  none: "bg-sunken text-faint",
};

function Verdict({ kind, r, small }: { kind: Case["kind"]; r: Result | null; small?: boolean }) {
  const v = verdict(kind, r);
  return (
    <span className={cx("inline-flex items-center rounded-full font-medium whitespace-nowrap", small ? "h-6 px-2 text-xs" : "h-6 px-2.5 text-xs", toneClass[v.tone])} title={r ? `${r.rule}: ${r.reason}` : undefined}>
      {v.text}
    </span>
  );
}

function StatTile({ name, sub, s, highlight }: { name: string; sub: string; s: Summary | null; highlight?: boolean }) {
  return (
    <div className={cx("min-w-0 rounded-[var(--radius-card)] border bg-card p-5", highlight ? "border-ink/25" : "border-line")}>
      <p className="text-sm font-medium">{name}</p>
      <p className="text-[13px] text-muted">{sub}</p>
      {s ? (
        <>
          <p className="mt-4 flex items-baseline gap-1.5">
            <span className={cx("num text-4xl font-semibold tracking-tight", s.attacksPaid > 0 ? "text-block" : "text-accent")}>{s.attacksPaid}</span>
            <span className="num text-muted">/ {s.attacks}</span>
          </p>
          <p className="text-sm text-muted">attacks paid</p>
          <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
            <span className="bg-block" style={{ width: `${(s.attacksPaid / s.attacks) * 100}%` }} />
            <span className="bg-ask" style={{ width: `${(s.attacksAsked / s.attacks) * 100}%` }} />
            <span className="bg-accent" style={{ width: `${(s.attacksBlocked / s.attacks) * 100}%` }} />
          </div>
          <p className="mt-3 text-[13px] text-muted">
            Real payments still paid: <span className="num text-ink">{s.controlsPaid}/{s.controls}</span>
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Not run yet. It needs a SERV key: <span className="num text-ink">pnpm benchmark</span>
        </p>
      )}
    </div>
  );
}

const SERIES = [
  { key: "paid", label: "Paid", cls: "bg-block" },
  { key: "asked", label: "Asked you", cls: "bg-ask" },
  { key: "stopped", label: "Stopped", cls: "bg-accent" },
] as const;

function OutcomeBars() {
  const [view, setView] = useState<"attack" | "control">("attack");
  const [hidden, setHidden] = useState<string[]>([]);
  const rows = SETUPS.map((st) => {
    const results = bench.cases.filter((c) => c.kind === view).map((c) => c[st.key] as Result | null);
    const ran = results.every((r) => r !== null);
    const count = (o: Outcome) => results.filter((r) => r?.outcome === o).length;
    return { ...st, ran, total: results.length, paid: count("approve"), asked: count("ask"), stopped: count("block") };
  });
  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">What happened to each payment</h3>
          <p className="text-sm text-muted">{view === "attack" ? `${bench.summary.none.attacks} attacks: the fewer paid, the better.` : `${bench.summary.none.controls} real payments: all of them should be paid.`}</p>
        </div>
        <div className="inline-flex rounded-full border border-line bg-sunken p-1 text-sm" role="tablist" aria-label="Which payments">
          {(["attack", "control"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cx("h-8 rounded-full px-3.5", view === v ? "bg-card font-medium text-ink shadow-[0_1px_0_var(--line)]" : "text-muted hover:text-ink")}
            >
              {v === "attack" ? "Attacks" : "Real payments"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-5 px-5 py-5">
        {rows.map((r) => (
          <div key={r.key} className="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center sm:gap-4">
            <p className="text-sm">
              <span className="font-medium">{r.name}</span>
              <span className="block text-[13px] text-muted">{r.sub}</span>
            </p>
            {r.ran ? (
              <div className="flex h-8 overflow-hidden rounded-lg bg-sunken" role="img" aria-label={`${r.name}: ${r.paid} paid, ${r.asked} asked, ${r.stopped} stopped of ${r.total}`}>
                {SERIES.filter((s) => !hidden.includes(s.key)).map((s) => {
                  const n = r[s.key];
                  if (!n) return null;
                  return (
                    <span key={s.key} className={cx("bench-bar num flex items-center justify-center text-xs font-medium text-paper", s.cls)} style={{ width: `${(n / r.total) * 100}%` }} title={`${s.label}: ${n}`}>
                      {n}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="flex h-8 items-center rounded-lg border border-dashed border-line px-3 text-[13px] text-muted">Needs a SERV key (pnpm benchmark)</p>
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-2" aria-label="Show or hide">
          {SERIES.map((s) => {
            const off = hidden.includes(s.key);
            return (
              <button
                key={s.key}
                onClick={() => setHidden(off ? hidden.filter((h) => h !== s.key) : [...hidden, s.key])}
                aria-pressed={!off}
                className={cx("inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px]", off ? "border-line text-faint" : "border-line-strong text-ink")}
              >
                <span className={cx("size-2.5 rounded-sm", s.cls, off && "opacity-30")} aria-hidden />
                {s.label}
              </button>
            );
          })}
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted hover:text-ink">Chart data</summary>
          <table className="mt-3 w-full text-left text-[13px]">
            <thead className="text-muted">
              <tr>
                <th className="py-1 font-medium">Setup</th>
                <th className="py-1 font-medium">Paid</th>
                <th className="py-1 font-medium">Asked</th>
                <th className="py-1 font-medium">Stopped</th>
              </tr>
            </thead>
            <tbody className="num">
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-line">
                  <td className="py-1.5 font-sans">{r.name}</td>
                  <td>{r.ran ? r.paid : "—"}</td>
                  <td>{r.ran ? r.asked : "—"}</td>
                  <td>{r.ran ? r.stopped : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
    </Card>
  );
}

const FILTERS = [
  { key: "all", label: `All ${bench.cases.length}` },
  { key: "paid", label: "Paid without a guard" },
  { key: "judgement", label: "Need judgement" },
  { key: "real", label: "Real payments" },
] as const;

function CaseTable() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(
    () =>
      bench.cases.filter((c) =>
        filter === "all" ? true : filter === "paid" ? c.kind === "attack" && c.none.outcome === "approve" : filter === "judgement" ? c.servOnly : c.kind === "control",
      ),
    [filter],
  );
  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4">
        <h3 className="text-[15px] font-semibold tracking-tight">Every case</h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter cases">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={cx("h-8 rounded-full border px-3 text-[13px]", filter === f.key ? "border-ink bg-ink text-paper" : "border-line bg-card text-muted hover:text-ink")}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="hidden grid-cols-[3rem_1fr_6rem_6rem_6rem] gap-3 border-b border-line px-5 py-2 text-xs font-medium text-muted md:grid">
        <span>Case</span>
        <span>What happens</span>
        <span>No guard</span>
        <span>Rules</span>
        <span>+ SERV</span>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((c) => {
          const final = c.serv ?? c.rules;
          return (
            <li key={c.id}>
              <button onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id} className="grid w-full gap-2 px-5 py-3.5 text-left hover:bg-sunken/60 md:grid-cols-[3rem_1fr_6rem_6rem_6rem] md:items-center md:gap-3">
                <span className="num text-[13px] text-faint">{c.id}</span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium">{c.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
                    <span className="rounded border border-line px-1.5 text-xs">{c.category}</span>
                    {c.servOnly ? <span className="rounded border border-ink/20 px-1.5 text-xs text-ink">needs judgement</span> : null}
                  </span>
                </span>
                <span className="flex flex-wrap gap-1.5 md:contents">
                  <span className="md:hidden text-xs text-faint">No guard</span>
                  <Verdict kind={c.kind} r={c.none} small />
                  <span className="md:hidden text-xs text-faint">Rules</span>
                  <Verdict kind={c.kind} r={c.rules} small />
                  <span className="md:hidden text-xs text-faint">+ SERV</span>
                  <Verdict kind={c.kind} r={c.serv} small />
                </span>
              </button>
              {open === c.id ? (
                <div className="space-y-1.5 px-5 pb-4 text-sm text-muted md:pl-[5.75rem]">
                  <p>{c.how}</p>
                  <p>
                    <span className="font-medium text-ink">Decision:</span> {final.reason} <span className="num text-faint">({final.rule})</span>
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function BenchmarkSection() {
  const { summary } = bench;
  return (
    <section id="bench" aria-labelledby="bench-title" className="flex scroll-mt-24 flex-col gap-5">
      <div>
        <p className="text-[13px] font-medium tracking-wide text-muted uppercase">Attack benchmark</p>
        <h2 id="bench-title" className="mt-1 text-2xl font-semibold tracking-tight text-balance">
          Without a guard, {summary.none.attacksPaid} of {summary.none.attacks} attacks get paid.
          {summary.serv ? ` With Errand, ${summary.serv.attacksPaid}.` : ` With Errand's rules alone, ${summary.rules.attacksPaid}.`}
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          The same {bench.cases.length} payments ({summary.none.attacks} attacks, {summary.none.controls} real ones) through three setups: injected purchases, swapped recipients, overcharges, waste, and the wrong product at the right price. Nothing is paid; these
          are the guard&rsquo;s decisions. &ldquo;Asked you&rdquo; counts as stopped, because money only moves if you say yes.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile name="No guard" sub="Kite session caps only" s={summary.none} />
        <StatTile name="Errand's rules" sub="R1–R13, no AI" s={summary.rules} />
        <StatTile name="Rules + SERV" sub={bench.servModel ? `guard ${bench.guardVersion ?? ""}`.trim() : "the full guard"} s={summary.serv} highlight />
      </div>
      <OutcomeBars />
      <CaseTable />
      <p className="text-[13px] text-faint">
        Run {new Date(bench.ranAt).toLocaleDateString([], { dateStyle: "medium" })}. Source: packages/core/src/benchmark.ts and apps/agent/scripts/benchmark.ts; re-run with pnpm benchmark. Green is the right
        call and red the wrong one: paying an attack is wrong, and so is blocking a real payment.
      </p>
    </section>
  );
}
