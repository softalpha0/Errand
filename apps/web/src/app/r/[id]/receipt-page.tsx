"use client";

import { useEffect, useState } from "react";
import type { Errand } from "@errand/core";
import { AnswerCard } from "@/components/errand-parts";
import { Receipt } from "@/components/receipt";
import { Button, Card, CardHeader, ErrorNote, LinkButton, Pill, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";

export function ReceiptPage({ id }: { id: string }) {
  const [e, setE] = useState<Errand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = () =>
      api
        .get(id)
        .then((x) => !stop && setE(x))
        .catch((err) => !stop && setError(err instanceof Error ? err.message : "Couldn't load this receipt."));
    void load();
    // Keep checking while Reppo's verdict is pending.
    const t = setInterval(load, 15_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }
  if (!e) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-12 sm:px-6" aria-busy="true">
        <Skeleton className="h-72" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const ev = e.evaluation;
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-12 sm:px-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Receipt</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(window.location.href).catch(() => undefined);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "Link copied" : "Copy link"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            Print
          </Button>
          <LinkButton href={`/e/${e.id}`} variant="ghost" size="sm">
            Full log
          </LinkButton>
        </div>
      </div>

      <Receipt e={e} />
      <AnswerCard e={e} />

      <Card>
        <CardHeader
          title="Independent grade"
          sub="Reppo's evaluator panel judges the whole trace against five questions about how the money was spent."
          aside={ev?.sandbox ? <Pill>sandbox</Pill> : undefined}
        />
        <div className="px-5 py-4 text-sm">
          {!ev ? (
            <p className="text-muted">{e.privacy === "private" ? "Private errand: it was not sent to Reppo for grading." : e.status === "done" ? "This run was not graded." : "The trace is sent to Reppo when the errand finishes."}</p>
          ) : ev.status === "SETTLED" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-baseline gap-3">
                {ev.score !== null ? <span className="num text-3xl font-semibold">{ev.score}</span> : null}
                <span className="text-muted">/ 100</span>
                {ev.route ? <Pill tone={ev.route === "ship" ? "approve" : ev.route === "block" ? "block" : "ask"}>{ev.route}</Pill> : null}
                {ev.decision ? <Pill tone={ev.decision === "accept" ? "approve" : ev.decision === "reject" ? "block" : "ask"}>{ev.decision}</Pill> : null}
                {ev.confidenceLabel ? <span className="text-muted">{ev.confidenceLabel} confidence</span> : null}
                {ev.confidence !== null && ev.confidence !== undefined ? <span className="text-muted">confidence {Math.round(ev.confidence * (ev.confidence <= 1 ? 100 : 1))}%</span> : null}
              </div>
              {ev.reason ? <p className="leading-relaxed text-muted">{ev.reason}</p> : null}
              {ev.verdicts.length ? (
                <ol className="divide-y divide-line border-y border-line">
                  {ev.verdicts.map((v, i) => (
                    <li key={i} className="py-3">
                      <p className="font-medium">{v.criterion}</p>
                      {v.verdict ? <p className="mt-0.5 text-muted">{v.verdict}</p> : null}
                      {v.critique ? <p className="mt-0.5 text-muted">{v.critique}</p> : null}
                      {v.score !== undefined ? <p className="num mt-0.5 text-muted">{v.score}/100</p> : null}
                    </li>
                  ))}
                </ol>
              ) : null}
              {ev.assessments?.length ? (
                <div>
                  <p className="font-medium">Who graded it</p>
                  <ul className="mt-2 space-y-2">
                    {ev.assessments.map((a, i) => (
                      <li key={`${a.agentName}-${i}`} className="rounded-xl border border-line px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{a.agentName}</span>
                          {a.modelName ? <span className="num text-xs text-faint">{a.modelName}</span> : null}
                          {a.score !== null ? <span className="num ml-auto">{a.score}/100</span> : null}
                          {a.decision ? <Pill tone={a.decision === "accept" ? "approve" : a.decision === "reject" ? "block" : "ask"}>{a.decision}</Pill> : null}
                        </div>
                        {a.critique ? <p className="mt-1 text-muted">{a.critique}</p> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="num text-xs text-faint">Reppo eval {ev.evalId}</p>
            </div>
          ) : ev.status === "PENDING" || ev.status === "QUEUED" ? (
            <p className="flex items-center gap-2 text-muted">
              <span className="pulse-dot size-2 rounded-full bg-ask" aria-hidden />
              {ev.status === "QUEUED" ? "Waiting to be sent to Reppo." : "With Reppo's evaluator panel. Usually 30 to 90 seconds."}
            </p>
          ) : (
            <p className="text-muted">Reppo could not grade this run ({ev.status.toLowerCase()}).</p>
          )}
        </div>
      </Card>
    </div>
  );
}
