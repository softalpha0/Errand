"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ModeNote } from "@/components/errand-parts";
import { Button, ErrorNote, Field, cx, inputClass } from "@/components/ui";
import { api, type AgentConfig } from "@/lib/api";
import { EXAMPLES } from "@/lib/examples";
import { COUNTRIES, detectCountry, taskPlaceholder } from "@/lib/countries";
import { usePassport } from "@/lib/passport";

export function Composer({ initial }: { initial: number | null }) {
  const router = useRouter();
  const start = initial !== null ? EXAMPLES[initial] : undefined;
  const [task, setTask] = useState<string>(start?.task ?? "");
  const [budget, setBudget] = useState<string>(String(start?.budgetUsd ?? 1));
  const [perPayment, setPerPayment] = useState<string>(String(start?.maxPerPaymentUsd ?? 0.5));
  const [code, setCode] = useState("");
  const [validFor, setValidFor] = useState<"1h" | "24h" | "7d">("1h");
  const [askAbove, setAskAbove] = useState<string>("");
  const [network, setNetwork] = useState<"mainnet" | "test">("mainnet");
  const [country, setCountry] = useState("NG");
  // Until we know where the visitor is, the example stays neutral (an eSIM for a trip), not Nigerian.
  const [detected, setDetected] = useState<string | null>(null);
  useEffect(() => {
    const d = detectCountry();
    setDetected(d ?? "");
    setCountry(d ?? "NG");
  }, []);
  const { passport } = usePassport();
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .config()
      .then(setConfig)
      .catch(() => setError("We couldn't reach the Errand agent. It may be starting up; try again in a minute."));
  }, []);

  // On a demo site every errand is a test; on a live site you choose.
  const testRun = config?.mode !== "live" || network === "test";
  const budgetN = Number(budget);
  const perN = Number(perPayment);
  const invalid =
    task.trim().length < 8
      ? "Describe the errand in a sentence or two."
      : !(budgetN > 0)
        ? "Set a budget above $0."
        : !(perN > 0)
          ? "Set a per-payment limit above $0."
          : perN < 0.01
            ? "Set the per-payment limit to at least $0.01. The cheapest paid call (a cited web answer) costs $0.01; a Reddit search costs $0.02."
            : perN > budgetN
            ? "The per-payment limit can't be more than the budget."
            : config && !testRun && !passport && budgetN > config.maxBudgetUsd
              ? `Errands paid from Errand's own wallet are capped at $${config.maxBudgetUsd}. Connect your own Kite Passport for any budget, or switch to Test.`
              : budgetN > 1000
                ? "Budgets go up to $1,000 per errand."
                : null;

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const askN = askAbove.trim() ? Number(askAbove) : null;
      const { id } = await api.create(
        { task: task.trim(), budgetUsd: budgetN, maxPerPaymentUsd: perN, validFor, askAboveUsd: askN && askN > 0 ? askN : null, country, network: testRun ? "test" : "mainnet" },
        testRun ? undefined : code || undefined,
      );
      router.push(`/e/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      {config?.mode === "live" ? (
        <fieldset>
          <legend className="text-sm font-medium">Network</legend>
          <div role="radiogroup" aria-label="Network" className="mt-2 grid grid-cols-2 gap-1 rounded-xl border border-line bg-sunken p-1">
            {(
              [
                ["mainnet", "Mainnet", "Real USDC through Kite Passport"],
                ["test", "Test", "Simulated payments, nothing charged"],
              ] as const
            ).map(([value, label, sub]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={network === value}
                onClick={() => setNetwork(value)}
                className={cx(
                  "rounded-lg px-3 py-2 text-left transition-colors",
                  network === value ? "bg-card shadow-[0_1px_0_var(--color-line)]" : "text-muted hover:text-ink",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className={cx("size-2 rounded-full", value === "mainnet" ? "bg-accent" : "bg-ask")} aria-hidden />
                  {label}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{sub}</span>
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {config && testRun ? <ModeNote mode="demo" /> : null}

      <div className="flex flex-col gap-1 rounded-xl border border-line bg-card px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted">
          Paying from:{" "}
          <span className="font-medium text-ink">{testRun ? "nothing: payments are simulated" : passport ? `your Kite Passport (${passport.email})` : "Errand's own Kite Passport"}</span>
        </p>
        {testRun ? null : (
          <Link href="/connect" className="text-muted underline underline-offset-2 hover:text-ink">
            {passport ? "Manage" : "Use your own Passport"}
          </Link>
        )}
      </div>

      <Field label="What should Errand do?" htmlFor="task" hint="Name who it's for, how much, and any condition. Errand only buys what you write here.">
        <textarea
          id="task"
          value={task}
          onChange={(ev) => setTask(ev.target.value)}
          rows={5}
          maxLength={2000}
          placeholder={taskPlaceholder(detected ? country : null)}
          className={cx(inputClass, "h-auto resize-y py-3 leading-relaxed")}
        />
      </Field>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Examples">
        {EXAMPLES.map((ex, i) => (
          <button
            key={ex.title}
            type="button"
            onClick={() => {
              setTask(ex.task);
              setBudget(String(ex.budgetUsd));
              setPerPayment(String(ex.maxPerPaymentUsd));
            }}
            className="h-9 rounded-full border border-line bg-card px-3.5 text-sm text-muted hover:border-ink/30 hover:text-ink"
            aria-label={`Use example: ${ex.title}`}
            data-index={i}
          >
            {ex.title}
          </button>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Budget for this errand (USD)" htmlFor="budget" hint="The most it may spend in total. Kite enforces this.">
          <input id="budget" inputMode="decimal" className={cx(inputClass, "num")} value={budget} onChange={(ev) => setBudget(ev.target.value)} />
        </Field>
        <Field label="Most per payment (USD)" htmlFor="per" hint="No single payment can be larger. Research calls cost $0.01–0.04.">
          <input id="per" inputMode="decimal" className={cx(inputClass, "num")} value={perPayment} onChange={(ev) => setPerPayment(ev.target.value)} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Valid for" htmlFor="valid" hint="How long the Kite Passport session can be used. After that, it can't spend anything.">
          <select id="valid" className={inputClass} value={validFor} onChange={(ev) => setValidFor(ev.target.value as "1h" | "24h" | "7d")}>
            <option value="1h">1 hour</option>
            <option value="24h">1 day</option>
            <option value="7d">7 days</option>
          </select>
        </Field>
        <Field label="Always ask me above (USD, optional)" htmlFor="askabove" hint="Errand pauses for your OK before any single payment larger than this.">
          <input id="askabove" inputMode="decimal" className={cx(inputClass, "num")} value={askAbove} onChange={(ev) => setAskAbove(ev.target.value)} placeholder="e.g. 5" />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your country" htmlFor="country" hint="Phone numbers written without a + code are read as this country's, and the plan assumes it unless you say otherwise.">
          <select id="country" className={inputClass} value={country} onChange={(ev) => { setCountry(ev.target.value); setDetected(ev.target.value); }}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {config?.accessCodeRequired && !passport && !testRun ? (
        <Field label="Access code" htmlFor="code" hint="Mainnet errands on Errand's own wallet spend real money, so the owner hands out a code. Without one, connect your own Kite Passport or switch to Test.">
          <input id="code" className={inputClass} value={code} onChange={(ev) => setCode(ev.target.value)} autoComplete="off" />
        </Field>
      ) : null}

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">{testRun ? "A test errand: real plan and checks, simulated payments." : "Nothing is paid until you approve the plan."}</p>
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Planning…" : "Plan this errand"}
        </Button>
      </div>
    </form>
  );
}
