import { spentUsd, type Errand } from "@errand/core";
import { chainLabel, dateOf, endpointLabel, sellerFor } from "@/lib/format";
import { Money, Pill, cx } from "./ui";

/** A receipt that reads like a bank statement: one line per payment, blocked attempts below. */
export function Receipt({ e, compact = false, label }: { e: Errand; compact?: boolean; label?: string }) {
  const spent = spentUsd(e.payments);
  const blocked = e.decisions.filter((d) => d.decision === "block");
  const ev = e.evaluation;
  const decisionById = new Map(e.decisions.map((d) => [d.id, d]));

  return (
    <article className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-card" aria-label="Errand receipt">
      <header className="flex items-start justify-between gap-4 border-b border-dashed border-line-strong px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">{label ?? "Receipt"}</p>
          <p className={cx("mt-1 leading-snug font-medium", compact ? "line-clamp-2 text-[15px]" : "text-[17px]")}>{e.task}</p>
          {!compact ? (
            <p className="num mt-1 text-xs text-faint">
              {e.id} · {dateOf(e.createdAt)}
            </p>
          ) : null}
        </div>
        {e.mode === "demo" ? <Pill>Simulated</Pill> : <Pill tone="approve">Paid with Kite</Pill>}
      </header>

      <ul className="px-5 py-3">
        {e.payments.map((p) => {
          const d = decisionById.get(p.decisionId);
          return (
            <li key={p.id} className="flex items-baseline gap-2 py-1.5 text-sm">
              <span className="shrink-0 font-medium">{sellerFor(p.url)}</span>
              <span className={cx("min-w-0 truncate text-muted", compact && "hidden sm:inline")}>{d?.candidate.note ?? endpointLabel(p.endpointId, p.url)}</span>
              <span className="leader" aria-hidden />
              {p.explorerUrl ? (
                <a
                  href={p.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs text-muted underline underline-offset-2"
                  title={`Transaction ${p.txHash ?? ""}${chainLabel(p.chain) ? `, settled on ${chainLabel(p.chain)}` : ""}`}
                >
                  proof{chainLabel(p.chain) ? ` · ${chainLabel(p.chain)}` : ""}
                </a>
              ) : null}
              <Money usd={p.amountUsd} className="shrink-0" />
            </li>
          );
        })}
        {e.payments.length === 0 ? <li className="py-2 text-sm text-muted">No payments yet.</li> : null}
      </ul>

      {blocked.length ? (
        <ul className="border-t border-line px-5 py-3">
          {blocked.map((d) => (
            <li key={d.id} className="flex items-baseline gap-2 py-1.5 text-sm">
              <span className="shrink-0 font-medium text-block">Blocked</span>
              <span className="min-w-0 flex-1 text-muted">{d.reason}</span>
              <Money usd={d.candidate.priceUsd} className="shrink-0 text-faint line-through" />
            </li>
          ))}
        </ul>
      ) : null}

      <footer className="border-t border-dashed border-line-strong bg-sunken/40 px-5 py-4">
        <div className="flex items-baseline justify-between">
          <span className="font-medium">Total spent</span>
          <span>
            <Money usd={spent} className="text-lg font-semibold" />
            <span className="text-sm text-muted">
              {" "}
              of <Money usd={e.budgetUsd} />
            </span>
          </span>
        </div>
        {!compact ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>Graded by Reppo:</span>
            {!ev ? (
              <span>{e.privacy === "private" ? "not sent (private errand)" : e.status === "done" ? "not graded" : "after the errand finishes"}</span>
            ) : ev.status === "SETTLED" ? (
              <>
                {ev.score !== null ? <span className="num text-ink">{ev.score}/100</span> : null}
                {ev.route ? (
                  <Pill tone={ev.route === "ship" ? "approve" : ev.route === "block" ? "block" : "ask"}>{ev.route}</Pill>
                ) : ev.decision ? (
                  <Pill tone={ev.decision === "accept" ? "approve" : ev.decision === "reject" ? "block" : "ask"}>{ev.decision}</Pill>
                ) : null}
                {ev.sandbox ? <Pill>sandbox</Pill> : null}
              </>
            ) : ev.status === "PENDING" || ev.status === "QUEUED" ? (
              <span>with Reppo's evaluators, usually under 2 minutes</span>
            ) : (
              <span>{ev.status.toLowerCase()}</span>
            )}
            <span className="ml-auto num text-xs">guard {e.guardVersion}</span>
          </div>
        ) : null}
        {!compact && e.mode === "live" ? (
          <p className="mt-2 text-xs text-faint">
            Paid from your Kite Passport wallet. Kite routes each payment to the chain the seller settles on; tap “proof” for the record.
          </p>
        ) : null}
      </footer>
    </article>
  );
}
