"use client";

import { useState } from "react";
import { VALID_FOR_LABEL, stepInput, type Errand, type Plan, type Question, type StepResult, type ValidFor } from "@errand/core";
import { STEP_LABEL, formatUsd } from "@/lib/format";
import { Button, Card, CardHeader, Money, Pill, cx, inputClass } from "./ui";

export function BudgetMeter({ spent, budget }: { spent: number; budget: number }) {
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted">Spent</span>
        <span>
          <Money usd={spent} className="font-medium" /> <span className="text-muted">of</span> <Money usd={budget} className="text-muted" />
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-sunken"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={budget}
        aria-valuenow={spent}
        aria-label="Budget used"
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const STEP_TONE: Record<StepResult["status"], "neutral" | "approve" | "block" | "ask" | "live"> = {
  pending: "neutral",
  running: "live",
  done: "approve",
  skipped: "neutral",
  blocked: "block",
  failed: "block",
};

const STEP_WORD: Record<StepResult["status"], string> = {
  pending: "Waiting",
  running: "Running",
  done: "Done",
  skipped: "Skipped",
  blocked: "Blocked",
  failed: "Failed",
};

/** The plan as a numbered list of task rows (pattern from Beautiful UI's Task Rows). */
export function PlanCard({
  plan,
  steps,
  totalMax,
  scope,
}: {
  plan: Plan;
  steps: StepResult[];
  totalMax?: number;
  scope?: { validFor: ValidFor; askAboveUsd: number | null; maxPerPaymentUsd: number };
}) {
  const total = totalMax ?? plan.steps.reduce((a, s) => a + s.maxUsd, 0);
  return (
    <Card>
      <CardHeader title="Plan" sub={plan.summary} aside={<span className="text-sm text-muted">up to <Money usd={total} className="text-ink" /></span>} />
      {scope || plan.constraints?.length ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3 text-sm" aria-label="Scope">
          <span className="text-muted">Scope</span>
          {scope ? (
            <>
              <span className="rounded-full border border-line px-2.5 py-0.5">
                max <Money usd={scope.maxPerPaymentUsd} /> per payment
              </span>
              <span className="rounded-full border border-line px-2.5 py-0.5">valid for {VALID_FOR_LABEL[scope.validFor] ?? scope.validFor}</span>
              {scope.askAboveUsd ? (
                <span className="rounded-full border border-ask/40 bg-ask-soft px-2.5 py-0.5 text-ask">
                  asks you above <Money usd={scope.askAboveUsd} />
                </span>
              ) : null}
            </>
          ) : null}
          {(plan.constraints ?? []).map((c) => (
            <span key={c} className="rounded-full bg-sunken px-2.5 py-0.5 text-ink">
              {c}
            </span>
          ))}
        </div>
      ) : null}
      <ol className="divide-y divide-line">
        {plan.steps.map((s, i) => {
          const r = steps.find((x) => x.stepId === s.id);
          const status = r?.status ?? "pending";
          const recipient = stepInput(s, "recipient") ?? stepInput(s, "to") ?? stepInput(s, "phone");
          const opinion = stepInput(s, "secondOpinion") === "yes";
          return (
            <li key={s.id} className="flex gap-4 px-5 py-3.5">
              <span className="num mt-0.5 w-5 shrink-0 text-sm text-faint">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.purpose}</span>
                  <span className="rounded-md border border-line px-1.5 text-xs text-muted">{STEP_LABEL[s.type] ?? s.type}</span>
                </div>
                {s.condition ? <p className="mt-1 text-sm text-ask">Only if: {s.condition.replace(/^only if /i, "")}</p> : null}
                {opinion ? <p className="mt-1 text-sm text-muted">Reppo's independent evaluators review the choice before paying.</p> : null}
                {recipient ? <p className="num mt-1 text-sm text-muted">To {recipient}</p> : null}
                {r?.note && (status === "blocked" || status === "failed" || status === "skipped") ? <p className="mt-1 text-sm text-muted">{r.note}</p> : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Money usd={s.maxUsd} className="text-sm text-muted" />
                <Pill tone={STEP_TONE[status]} dot={status === "running"}>
                  {STEP_WORD[status]}
                </Pill>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/** Human-in-the-loop card (pattern from Beautiful UI's Approval Card). */
export function QuestionCard({ q, onAnswer }: { q: Question; onAnswer: (answer: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async (a: string) => {
    setBusy(true);
    try {
      await onAnswer(a);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="border-ask/40 bg-ask-soft/40">
      <div className="px-5 py-4">
        <p className="text-sm font-medium text-ask">Errand needs you before it continues</p>
        <p className="mt-1.5 text-[17px] leading-snug font-medium">{q.text}</p>
        {q.context ? <p className="mt-1 text-sm text-muted">{q.context}</p> : null}
        {q.options.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {q.options.map((o, i) => (
              <Button key={o} variant={i === 0 ? "primary" : "secondary"} disabled={busy} onClick={() => send(o)}>
                {o}
              </Button>
            ))}
          </div>
        ) : (
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (text.trim()) void send(text.trim());
            }}
          >
            <label htmlFor={`a-${q.id}`} className="sr-only">
              Your answer
            </label>
            <input id={`a-${q.id}`} className={inputClass} value={text} onChange={(ev) => setText(ev.target.value)} placeholder="Type your answer" autoFocus />
            <Button type="submit" disabled={busy || !text.trim()}>
              Send answer
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}

export function ApprovalCard({ e, onDemoApprove }: { e: Errand; onDemoApprove: () => Promise<void> }) {
  const total = e.plan ? Math.min(e.budgetUsd, e.plan.steps.reduce((a, s) => a + s.maxUsd, 0)) : e.budgetUsd;
  const [busy, setBusy] = useState(false);
  if (e.funding === "allowance") {
    return (
      <Card className="border-ink/20">
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[17px] font-medium">Approve this plan to repeat it</p>
            <p className="mt-1 text-sm text-muted">
              Up to <Money usd={total} className="text-ink" /> a run, at most <Money usd={e.maxPerPaymentUsd} className="text-ink" /> per payment, paid from your Kite allowance. You approved the
              allowance on Kite with your passkey; every payment is still checked here first, and you can pause or stop it on the Repeat page.
              {e.mode === "demo" ? " Test errand: no money moves." : ""}
            </p>
          </div>
          <Button
            size="lg"
            className="shrink-0"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onDemoApprove();
              } finally {
                setBusy(false);
              }
            }}
          >
            Approve plan
          </Button>
        </div>
      </Card>
    );
  }
  return (
    <Card className="border-ink/20">
      <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[17px] font-medium">Approve the spending session</p>
          <p className="mt-1 text-sm text-muted">
            Up to <Money usd={total} className="text-ink" /> in total, at most <Money usd={e.maxPerPaymentUsd} className="text-ink" /> per payment, for {e.validFor === "7d" ? "7 days" : e.validFor === "24h" ? "1 day" : "one hour"}.
            {e.passportId ? " From your own Kite Passport." : ""}
            {e.mode === "live" ? " Kite Passport enforces these limits even if Errand's code is wrong." : " In a test errand no passkey is needed and no money moves."}
          </p>
        </div>
        {e.mode === "live" ? (
          e.kite.approvalUrl ? (
            <a
              href={e.kite.approvalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-ink px-6 font-medium text-paper hover:bg-ink/85"
            >
              Approve in Kite Passport
            </a>
          ) : (
            <span className="text-sm text-muted">Waiting for the approval link from Kite…</span>
          )
        ) : (
          <Button
            size="lg"
            className="shrink-0"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onDemoApprove();
              } finally {
                setBusy(false);
              }
            }}
          >
            Approve (demo)
          </Button>
        )}
      </div>
    </Card>
  );
}

export function AnswerCard({ e }: { e: Errand }) {
  if (!e.answer) return null;
  return (
    <Card>
      <CardHeader title="Answer" />
      <div className="px-5 py-4">
        <div className="space-y-3 text-[15px] leading-relaxed whitespace-pre-line">{e.answer.text}</div>
        {e.answer.citations.length ? (
          <ol className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
            {e.answer.citations.map((c, i) => (
              <li key={`${c.url}-${i}`} className="flex gap-2">
                <span className="num text-faint">[{i + 1}]</span>
                <a href={c.url} target="_blank" rel="noreferrer" className="truncate text-muted underline-offset-2 hover:text-ink hover:underline">
                  {c.label}
                </a>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </Card>
  );
}

export function ModeNote({ mode }: { mode: "live" | "demo" }) {
  return mode === "demo" ? (
    <p className={cx("rounded-xl border border-line bg-sunken px-4 py-2.5 text-sm text-muted")}>
      <span className="font-medium text-ink">Test errand.</span> Seller replies and payments are simulated and labelled as such, and nothing is charged. The plan and every payment check are real when SERV is connected.
    </p>
  ) : null;
}

export { formatUsd };
