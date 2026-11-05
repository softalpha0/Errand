"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { StandingErrand } from "@errand/core";
import { ModeNote } from "@/components/errand-parts";
import { Button, Card, CardHeader, ErrorNote, Field, Money, Pill, Skeleton, cx, inputClass } from "@/components/ui";
import { api, type AgentConfig } from "@/lib/api";
import { dateOf, STATUS_TEXT } from "@/lib/format";
import { COUNTRIES, guessCountry } from "@/lib/countries";
import { usePassport } from "@/lib/passport";

const EXAMPLE = "Send NGN 1,000 MTN data to my mum on 0803 123 4567.";

function stateTone(s: StandingErrand["state"]) {
  return s === "active" ? ("approve" as const) : s === "pending_approval" ? ("ask" as const) : ("neutral" as const);
}

const STATE_TEXT: Record<StandingErrand["state"], string> = {
  pending_approval: "Approve the first plan",
  active: "On",
  paused: "Paused",
  stopped: "Stopped",
};

function StandingCard({ s, onChange, accessCode }: { s: StandingErrand; onChange: () => void; accessCode: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };
  const first = s.runs[0]?.errandId;
  return (
    <Card>
      <CardHeader
        title={<span className="line-clamp-2">{s.task}</span>}
        sub={
          <>
            Every {s.every}, at most <Money usd={s.capPerRunUsd} className="text-ink" /> a run{s.privacy === "private" ? " · private" : ""}
          </>
        }
        aside={<Pill tone={stateTone(s.state)}>{STATE_TEXT[s.state]}</Pill>}
      />
      <div className="flex flex-col gap-4 px-5 py-4">
        {s.state === "pending_approval" && first ? (
          <p className="text-sm text-muted">
            The first run is waiting for you to approve its plan.{" "}
            <Link href={`/e/${first}`} className="font-medium text-ink underline underline-offset-2">
              Review the plan
            </Link>
          </p>
        ) : null}
        {s.nextRunAt && s.state === "active" ? <p className="text-sm text-muted">Next run: {dateOf(s.nextRunAt)}</p> : null}
        {s.runs.length ? (
          <ol className="divide-y divide-line border-y border-line text-sm">
            {[...s.runs].reverse().slice(0, 6).map((r, i) => (
              <li key={`${r.errandId}-${i}`} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-muted">
                  {dateOf(r.at)} · {r.status === "skipped" ? r.note : (STATUS_TEXT[r.status] ?? r.status)}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <Money usd={r.spentUsd} />
                  {r.errandId ? (
                    <Link href={`/e/${r.errandId}`} className="text-muted underline underline-offset-2 hover:text-ink">
                      View
                    </Link>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {s.plan && s.state !== "stopped" ? (
            <Button size="sm" disabled={busy} onClick={() => act(async () => router.push(`/e/${(await api.standingRun(s.id, accessCode || undefined)).errandId}`))}>
              Run now
            </Button>
          ) : null}
          {s.state === "active" ? (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => api.standingState(s.id, "paused"))}>
              Pause
            </Button>
          ) : null}
          {s.state === "paused" ? (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => api.standingState(s.id, "active"))}>
              Resume
            </Button>
          ) : null}
          {s.plan && s.state !== "stopped" ? (
            <Button size="sm" variant="danger" disabled={busy} onClick={() => act(() => api.standingState(s.id, "stopped"))}>
              Stop for good
            </Button>
          ) : null}
        </div>
        {err ? <ErrorNote>{err}</ErrorNote> : null}
      </div>
    </Card>
  );
}

export function RepeatView() {
  const router = useRouter();
  const { passport, loading } = usePassport();
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [list, setList] = useState<StandingErrand[] | null>(null);
  const [task, setTask] = useState("");
  const [every, setEvery] = useState<"day" | "week">("day");
  const [cap, setCap] = useState("1");
  const [per, setPer] = useState("1");
  const [privateRun, setPrivateRun] = useState(true);
  const [country, setCountry] = useState("NG");
  useEffect(() => setCountry(guessCountry()), []);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .standingList()
      .then(setList)
      .catch(() => setList([]));
  }, []);

  useEffect(() => {
    api.config().then(setConfig).catch(() => setError("We couldn't reach the Errand agent. Try again in a minute."));
  }, []);
  useEffect(() => {
    if (!loading) load();
  }, [loading, passport?.id, load]);

  const capN = Number(cap);
  const perN = Number(per);
  const invalid =
    task.trim().length < 8
      ? "Describe the errand in a sentence or two."
      : !(capN >= 0.01)
        ? "Set a cap per run of at least $0.01."
        : !(perN >= 0.01)
          ? "Set the per-payment limit to at least $0.01."
          : perN > capN
            ? "The per-payment limit can't be more than the cap per run."
            : null;

  return (
    <div className="flex flex-col gap-8">
      {config ? <ModeNote mode={config.mode} /> : null}
      {!loading && !passport ? (
        <p className="rounded-xl border border-line bg-sunken px-4 py-2.5 text-sm text-muted">
          {config?.mode === "live" ? "This pays from Errand's own allowance. " : ""}
          <Link href="/connect" className="font-medium text-ink underline underline-offset-2">
            Connect your Kite Passport
          </Link>{" "}
          to pay from your own allowance instead.
        </p>
      ) : null}

      <form
        className="flex flex-col gap-5"
        noValidate
        onSubmit={async (ev) => {
          ev.preventDefault();
          if (invalid) return setError(invalid);
          setBusy(true);
          setError(null);
          try {
            const r = await api.standingCreate({ task: task.trim(), every, capPerRunUsd: capN, maxPerPaymentUsd: perN, privacy: privateRun ? "private" : "public", country }, code || undefined);
            router.push(`/e/${r.errandId}`);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong.");
            setBusy(false);
          }
        }}
      >
        <Field label="What should Errand repeat?" htmlFor="st-task" hint="Name who it's for and how much. Amazon orders can't repeat: Kite's allowance never pays shopping checkouts.">
          <textarea id="st-task" rows={3} className={cx(inputClass, "h-auto resize-y py-3 leading-relaxed")} value={task} onChange={(ev) => setTask(ev.target.value)} placeholder={EXAMPLE} />
        </Field>
        <button type="button" onClick={() => setTask(EXAMPLE)} className="h-9 self-start rounded-full border border-line bg-card px-3.5 text-sm text-muted hover:border-ink/30 hover:text-ink">
          Use example: data for Mum
        </button>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="How often" htmlFor="st-every">
            <select id="st-every" className={inputClass} value={every} onChange={(ev) => setEvery(ev.target.value as "day" | "week")}>
              <option value="day">Every day</option>
              <option value="week">Every week</option>
            </select>
          </Field>
          <Field label="At most per run (USD)" htmlFor="st-cap">
            <input id="st-cap" inputMode="decimal" className={cx(inputClass, "num")} value={cap} onChange={(ev) => setCap(ev.target.value)} />
          </Field>
          <Field label="Most per payment (USD)" htmlFor="st-per">
            <input id="st-per" inputMode="decimal" className={cx(inputClass, "num")} value={per} onChange={(ev) => setPer(ev.target.value)} />
          </Field>
        </div>
        <Field label="Your country" htmlFor="st-country" hint="Phone numbers written without a + code are read as this country's, and the plan assumes it unless you say otherwise.">
          <select id="st-country" className={inputClass} value={country} onChange={(ev) => setCountry(ev.target.value)}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-ink)]" checked={privateRun} onChange={(ev) => setPrivateRun(ev.target.checked)} />
          <span>
            <span className="font-medium">Keep it private.</span> <span className="text-muted">Runs are not sent to Reppo&rsquo;s public evaluation network. Recommended for family errands.</span>
          </span>
        </label>
        {config?.accessCodeRequired && !passport ? (
          <Field label="Access code" htmlFor="st-code" hint="Needed only when paying from Errand's own wallet.">
            <input id="st-code" className={inputClass} value={code} onChange={(ev) => setCode(ev.target.value)} autoComplete="off" />
          </Field>
        ) : null}
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">The first run plans it and waits for your OK.</p>
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Planning…" : "Plan the first run"}
          </Button>
        </div>
      </form>

      <section aria-labelledby="mine" className="flex flex-col gap-4">
        <h2 id="mine" className="text-lg font-semibold tracking-tight">
          {passport ? "Your repeating errands" : "Repeating errands on this site"}
        </h2>
        {list === null ? (
          <Skeleton className="h-28" />
        ) : list.length === 0 ? (
          <p className="text-sm text-muted">None yet.</p>
        ) : (
          list.map((s) => <StandingCard key={s.id} s={s} onChange={load} accessCode={code} />)
        )}
      </section>
    </div>
  );
}
