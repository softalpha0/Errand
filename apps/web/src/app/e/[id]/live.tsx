"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { spentUsd, type Errand } from "@errand/core";
import { DecisionRow } from "@/components/decision";
import { AnswerCard, ApprovalCard, BudgetMeter, ModeNote, PlanCard, QuestionCard } from "@/components/errand-parts";
import { Button, Card, CardHeader, ErrorNote, LinkButton, Money, Pill, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { STATUS_TEXT, timeOf } from "@/lib/format";

const ACTIVE = new Set(["planning", "needs_input", "awaiting_approval", "running"]);

function statusTone(s: Errand["status"]) {
  if (s === "done") return "approve" as const;
  if (s === "failed" || s === "cancelled") return "block" as const;
  if (s === "needs_input") return "ask" as const;
  return "live" as const;
}

export function LiveErrand({ id }: { id: string }) {
  const [e, setE] = useState<Errand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let closed = false;
    const poll = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(() => {
        api
          .get(id)
          .then((x) => !closed && setE(x))
          .catch(() => undefined);
      }, 3000);
    };
    api
      .get(id)
      .then((x) => !closed && setE(x))
      .catch((err) => !closed && setError(err instanceof Error ? err.message : "Couldn't load this errand."));
    let es: EventSource | null = null;
    try {
      es = new EventSource(api.streamUrl(id));
      es.addEventListener("errand", (msg) => {
        try {
          setE(JSON.parse((msg as MessageEvent).data) as Errand);
        } catch {
          /* ignore a malformed frame */
        }
      });
      es.onerror = () => poll();
    } catch {
      poll();
    }
    return () => {
      closed = true;
      es?.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id]);

  async function act(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "That didn't work. Try again.");
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <ErrorNote>{error}</ErrorNote>
        <LinkButton href="/new" variant="secondary" className="mt-6">
          Start a new errand
        </LinkButton>
      </div>
    );
  }

  if (!e) {
    return (
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_20rem]" aria-busy="true" aria-label="Loading errand">
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const openQuestion = e.questions.find((q) => q.answer === null);
  const paymentByDecision = new Map(e.payments.map((p) => [p.decisionId, p]));
  const spent = spentUsd(e.payments);
  const recent = [...e.events].reverse().slice(0, 4);

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0 space-y-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={statusTone(e.status)} dot={ACTIVE.has(e.status) && e.status !== "needs_input"}>
              {STATUS_TEXT[e.status]}
            </Pill>
            <span className="num text-xs text-faint">{e.id}</span>
          </div>
          <h1 className="mt-3 text-[1.6rem] leading-tight font-semibold tracking-tight text-balance">{e.task}</h1>
        </div>

        <ModeNote mode={e.mode} />
        {e.error ? <ErrorNote>{e.error}</ErrorNote> : null}
        {actionError ? <ErrorNote>{actionError}</ErrorNote> : null}

        {openQuestion ? <QuestionCard key={openQuestion.id} q={openQuestion} onAnswer={(a) => act(() => api.answer(e.id, openQuestion.id, a))} /> : null}
        {e.status === "awaiting_approval" ? <ApprovalCard e={e} onDemoApprove={() => act(() => api.approveDemo(e.id))} /> : null}

        {e.status === "planning" && !e.plan ? (
          <Card>
            <div className="flex items-center gap-3 px-5 py-6 text-muted">
              <span className="pulse-dot size-2 rounded-full bg-ink" aria-hidden />
              SERV is planning: choosing sellers, pricing each step, checking it against your limits.
            </div>
          </Card>
        ) : null}

        {e.plan ? <PlanCard plan={e.plan} steps={e.steps} scope={{ validFor: e.validFor ?? "1h", askAboveUsd: e.askAboveUsd ?? null, maxPerPaymentUsd: e.maxPerPaymentUsd }} /> : null}

        {e.decisions.length ? (
          <Card>
            <CardHeader
              title="Every payment, checked"
              sub="Tap a line to see why it was approved or blocked."
              aside={
                <span className="text-sm whitespace-nowrap text-muted">
                  {e.decisions.filter((d) => d.decision === "block").length} blocked
                </span>
              }
            />
            <ul className="divide-y divide-line">
              {e.decisions.map((d) => (
                <DecisionRow key={d.id} d={d} payment={paymentByDecision.get(d.id)} />
              ))}
            </ul>
          </Card>
        ) : null}

        <AnswerCard e={e} />
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card>
          <div className="space-y-4 px-5 py-5">
            <BudgetMeter spent={spent} budget={e.budgetUsd} />
            <p className="text-sm text-muted">
              At most <Money usd={e.maxPerPaymentUsd} className="text-ink" /> per payment.
            </p>
            {e.status === "done" ? (
              <LinkButton href={`/r/${e.id}`} className="w-full">
                Open the receipt
              </LinkButton>
            ) : null}
            {ACTIVE.has(e.status) ? (
              <Button variant="danger" size="sm" className="w-full" onClick={() => act(() => api.cancel(e.id))}>
                Stop this errand
              </Button>
            ) : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="Latest" />
          <ol className="space-y-3 px-5 py-4 text-sm">
            {recent.map((ev, i) => (
              <li key={`${ev.at}-${i}`} className="flex gap-3">
                <span className="num shrink-0 text-xs text-faint">{timeOf(ev.at)}</span>
                <span className="text-muted">{ev.message}</span>
              </li>
            ))}
          </ol>
        </Card>
        <p className="px-1 text-xs leading-relaxed text-faint">
          Errand pays only the sellers in its catalog, through your Kite Passport session. <Link href="/#guarantees" className="underline underline-offset-2">What it promises</Link>
        </p>
      </aside>
    </div>
  );
}
