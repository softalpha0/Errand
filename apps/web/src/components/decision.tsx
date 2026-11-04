"use client";

import type { GuardDecision, PaymentRecord } from "@errand/core";
import { endpointLabel, sellerFor, shortHash, timeOf } from "@/lib/format";
import { Money, Pill, cx } from "./ui";

const TONE = { approve: "approve", block: "block", ask: "ask" } as const;
const WORD = { approve: "Approved", block: "Blocked", ask: "Asked you" } as const;

function ruleLabel(rule: string): string {
  if (rule.startsWith("serv.graph")) return "SERV guard graph";
  if (rule.startsWith("serv.shadow")) return "SERV Shadow Agent";
  if (rule.startsWith("serv.unavailable")) return "SERV unavailable";
  if (rule.startsWith("demo.")) return "Scripted demo check";
  if (rule === "user.answer") return "Your answer";
  if (rule.startsWith("R12")) return "Your rule: ask above an amount";
  if (rule === "rules.pass") return "Rules";
  return `Rule ${rule.split(".")[0]}`;
}

/**
 * One payment decision. Collapsed it reads like a statement line; expanded it
 * shows the reasoning trace (pattern from Beautiful UI's "Thinking" traces).
 */
export function DecisionRow({ d, payment }: { d: GuardDecision; payment?: PaymentRecord }) {
  const c = d.candidate;
  return (
    <li className="rise">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-3.5 hover:bg-sunken/60 [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden
            className={cx(
              "mt-1.5 size-2.5 shrink-0 rounded-full",
              d.decision === "approve" ? "bg-accent" : d.decision === "block" ? "bg-block" : "bg-ask",
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{sellerFor(c.url)}</span>
              <span className="truncate text-sm text-muted">{c.origin === "seller_content" ? "Suggested by a seller's response" : endpointLabel(c.endpointId, c.url)}</span>
            </span>
            <span className={cx("mt-0.5 block text-sm leading-snug", d.decision === "approve" ? "text-muted" : d.decision === "block" ? "text-block" : "text-ask")}>
              {d.reason}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <Money usd={c.priceUsd} className={cx("text-[15px]", d.decision === "block" && "text-faint line-through")} />
            <Pill tone={TONE[d.decision]}>{WORD[d.decision]}</Pill>
          </span>
        </summary>
        <div className="mx-5 mb-4 ml-10 rounded-xl border border-line bg-sunken/50 p-4 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            <dt className="text-muted">Decided by</dt>
            <dd>{ruleLabel(d.rule)}</dd>
            <dt className="text-muted">Time</dt>
            <dd className="num">{timeOf(d.at)}</dd>
            <dt className="text-muted">Request</dt>
            <dd className="num break-all">
              {c.method} {c.url.split("?")[0]}
            </dd>
            {c.recipient ? (
              <>
                <dt className="text-muted">Recipient</dt>
                <dd className="num">{c.recipient}</dd>
              </>
            ) : null}
            {c.note ? (
              <>
                <dt className="text-muted">Note</dt>
                <dd>{c.note}</dd>
              </>
            ) : null}
            {d.servModel ? (
              <>
                <dt className="text-muted">SERV</dt>
                <dd className="num break-all">
                  {d.servModel}
                  {d.servRequestId ? ` · ${d.servRequestId}` : ""}
                </dd>
              </>
            ) : null}
            {payment ? (
              <>
                <dt className="text-muted">Payment</dt>
                <dd>
                  {payment.simulated ? (
                    "Simulated (demo mode)"
                  ) : payment.explorerUrl ? (
                    <a className="num underline underline-offset-2" href={payment.explorerUrl} target="_blank" rel="noreferrer">
                      {shortHash(payment.txHash ?? "")}
                    </a>
                  ) : (
                    "Paid through Kite Passport (see your Kite activity)"
                  )}
                </dd>
              </>
            ) : null}
          </dl>
        </div>
      </details>
    </li>
  );
}
