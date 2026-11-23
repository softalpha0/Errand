"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnitsExact } from "@errand/celo/tokens";
import { ERRAND_AGENT, EXPIRY_CHOICES_DAYS, describeAllowlist, expiryFromNow, toAtomic6 } from "@errand/celo/session";
import { Button, Card, CardHeader, ErrorNote, Field, LinkButton, Pill, Skeleton, inputClass } from "@/components/ui";
import { addressUrl, short, txUrl } from "@/lib/celo";
import { grant, loadSession, quoteGrant, revoke, type QuoteView, type StoredSession } from "@/lib/session";
import { explainError, loadWallet, type StoredWallet } from "@/lib/wallet";

type Phase = "loading" | "no-wallet" | "form" | "active" | "ended";

function fmt(value: bigint, decimals: number, maxFraction = 4) {
  const [whole, fraction = ""] = formatUnitsExact(value, decimals).split(".");
  const f = fraction.slice(0, maxFraction).replace(/0+$/, "");
  return `${BigInt(whole!).toLocaleString("en-US")}${f ? `.${f}` : ""}`;
}

function limitOf(session: StoredSession, index: number): bigint | null {
  const spend = (session.session.permissions as { spend?: { limit: string }[] }).spend;
  const raw = spend?.[index]?.limit;
  return raw ? BigInt(raw) : null;
}

function dateOf(epochSeconds: number) {
  return new Date(epochSeconds * 1000).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export function SessionScreen() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [wallet, setWallet] = useState<StoredWallet | null>(null);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [usd, setUsd] = useState("5");
  const [naira, setNaira] = useState("7000");
  const [days, setDays] = useState<number>(7);
  const [quote, setQuote] = useState<QuoteView | null>(null);
  const [busy, setBusy] = useState<"" | "quote" | "grant" | "revoke">("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const w = loadWallet();
    if (!w) {
      setPhase("no-wallet");
      return;
    }
    setWallet(w);
    const s = loadSession(w.address);
    setSession(s);
    if (!s) setPhase("form");
    else if (s.revokedAt || s.session.expiry * 1000 <= Date.now()) setPhase("ended");
    else setPhase("active");
  }, []);

  const caps = useMemo(() => {
    try {
      return { usdtPerDay: toAtomic6(usd), cngnPerDay: toAtomic6(naira) };
    } catch {
      return null;
    }
  }, [usd, naira]);

  useEffect(() => setQuote(null), [usd, naira, days]);

  async function onQuote() {
    if (!wallet || !caps) return;
    setError(null);
    setBusy("quote");
    try {
      setQuote(await quoteGrant(wallet, { caps, expiry: expiryFromNow(days) }));
    } catch (e) {
      setError(explainError(e));
    } finally {
      setBusy("");
    }
  }

  async function onGrant() {
    if (!wallet || !caps) return;
    setError(null);
    setBusy("grant");
    try {
      setSession(await grant(wallet, { caps, expiry: expiryFromNow(days) }));
      setPhase("active");
    } catch (e) {
      setError(explainError(e));
    } finally {
      setBusy("");
    }
  }

  async function onRevoke() {
    if (!wallet || !session) return;
    if (!window.confirm("Revoke Errand's session? It stops at once and can't be turned back on. You can grant a new one later.")) return;
    setError(null);
    setBusy("revoke");
    try {
      setSession(await revoke(wallet, session));
      setPhase("ended");
    } catch (e) {
      setError(explainError(e));
    } finally {
      setBusy("");
    }
  }

  const allowlist = (
    <ul className="divide-y divide-line">
      {describeAllowlist().map((a) => (
        <li key={a.to} className="flex flex-col gap-0.5 px-5 py-3">
          <span className="text-[15px]">{a.label}</span>
          <span className="text-[13px] text-muted">
            {a.detail} ·{" "}
            <a href={addressUrl(a.to)} className="num underline decoration-line-strong underline-offset-2 hover:decoration-ink" rel="noreferrer">
              {short(a.to)}
            </a>
          </span>
        </li>
      ))}
    </ul>
  );

  if (phase === "loading") {
    return (
      <Card className="p-5" aria-busy="true">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-4 h-24 w-full" />
      </Card>
    );
  }

  if (phase === "no-wallet") {
    return (
      <Card className="p-5">
        <h2 className="text-[15px] font-semibold">Create your wallet first</h2>
        <p className="mt-2 text-sm text-muted">A session lives on your own wallet. It takes a minute and is free.</p>
        <LinkButton href="/wallet" className="mt-4">
          Go to your wallet
        </LinkButton>
      </Card>
    );
  }

  if ((phase === "active" || phase === "ended") && session) {
    const usdtCap = limitOf(session, 0);
    const cngnCap = limitOf(session, 1);
    const revoked = Boolean(session.revokedAt);
    return (
      <div className="flex flex-col gap-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Card>
          <CardHeader
            title="Errand's session on your wallet"
            sub={`Agent ${short(ERRAND_AGENT.address)}`}
            aside={phase === "active" ? <Pill tone="approve">Active</Pill> : revoked ? <Pill tone="block">Revoked</Pill> : <Pill>Expired</Pill>}
          />
          <dl className="divide-y divide-line">
            <Line label="Daily cap, Naira" value={cngnCap !== null ? `₦${fmt(cngnCap, 6, 2)}` : "–"} />
            <Line label="Daily cap, dollars" value={usdtCap !== null ? `$${fmt(usdtCap, 6, 2)}` : "–"} note="Also pays Altana's small network fees." />
            <Line label={revoked ? "Revoked" : "Ends"} value={revoked && session.revokedAt ? new Date(session.revokedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : dateOf(session.session.expiry)} />
            {session.grantTx ? <Line label="Granted in" value={short(session.grantTx)} href={txUrl(session.grantTx)} /> : null}
            {session.revokeTx ? <Line label="Revoked in" value={short(session.revokeTx)} href={txUrl(session.revokeTx)} /> : null}
          </dl>
        </Card>
        <Card>
          <CardHeader title="Errand may only call" sub="Anything else is refused by your wallet on Celo." />
          {allowlist}
        </Card>
        {phase === "active" ? (
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold">Stop Errand at any time</h2>
            <p className="mt-1 text-sm text-muted">One passkey tap. After that, any attempt by Errand is refused.</p>
            <Button variant="danger" className="mt-4" onClick={onRevoke} disabled={busy !== ""}>
              {busy === "revoke" ? "Waiting for your passkey…" : "Revoke session"}
            </Button>
          </Card>
        ) : (
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold">Need Errand again?</h2>
            <p className="mt-1 text-sm text-muted">Grant a new session with fresh limits.</p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => {
                setSession(null);
                setPhase("form");
              }}
            >
              Set up a new session
            </Button>
          </Card>
        )}
      </div>
    );
  }

  // phase === "form"
  const shortOn = quote ? quote.problems.length > 0 || quote.balances.some((b) => !b.sufficient) : false;
  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Card>
        <CardHeader title="Your limits" sub="Celo enforces them on your wallet." />
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
          <Field label="Most Errand may pay out per day, in Naira" htmlFor="naira" hint="cNGN sent to the people you name.">
            <input id="naira" inputMode="decimal" className={inputClass} value={naira} onChange={(e) => setNaira(e.target.value)} />
          </Field>
          <Field label="Most USD₮ it may convert per day" htmlFor="usd" hint="Up to $100. Also covers Altana's small network fees.">
            <input id="usd" inputMode="decimal" className={inputClass} value={usd} onChange={(e) => setUsd(e.target.value)} />
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium">Session ends after</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXPIRY_CHOICES_DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  aria-pressed={days === d}
                  className={`h-9 rounded-full border px-4 text-sm ${days === d ? "border-ink bg-ink text-paper" : "border-line-strong bg-card text-ink hover:border-ink/40"}`}
                >
                  {d === 1 ? "1 day" : `${d} days`}
                </button>
              ))}
            </div>
          </fieldset>
          {!caps ? <p className="text-sm text-block sm:col-span-2">Enter amounts like 5 or 7000 (no currency signs).</p> : null}
        </div>
      </Card>

      <Card>
        <CardHeader title="Errand may only call" sub="Anything else is refused by your wallet on Celo." />
        {allowlist}
      </Card>

      <Card>
        <CardHeader title="Cost to grant" sub="Paid from your wallet. Read live from Altana. The first grant registers your passkey and Errand's session key in Altana's public KeyStore." />
        <div className="px-5 py-5">
          {!quote ? (
            <Button variant="secondary" onClick={onQuote} disabled={!caps || busy !== ""}>
              {busy === "quote" ? "Checking…" : "Check the cost"}
            </Button>
          ) : (
            <div className="flex flex-col gap-3">
              {quote.problems.map((p) => (
                <p key={p} role="status" className="rounded-xl border border-ask/25 bg-ask-soft px-4 py-3 text-sm text-ask">
                  {p}
                </p>
              ))}
              {quote.problems.length ? null : quote.balances.length ? (
                <ul className="flex flex-col gap-2">
                  {quote.balances.map((b) => (
                    <li key={b.symbol} className="flex flex-wrap items-baseline justify-between gap-2 text-[15px]">
                      <span>
                        Needs <span className="num">{fmt(b.needed, b.decimals)}</span> {b.symbol}, you have <span className="num">{fmt(b.balance, b.decimals)}</span>
                      </span>
                      {b.sufficient ? <Pill tone="approve">Enough</Pill> : <Pill tone="ask">Top up {b.symbol}</Pill>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No cost reported.</p>
              )}
              {!quote.complete ? <p className="text-[13px] text-muted">Some fees are priced only after the first step lands, so the final cost can be a little higher.</p> : null}
              <details className="text-[13px] text-muted">
                <summary className="cursor-pointer">Details from Altana</summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {quote.lines.map((l) => (
                    <li key={l} className="num break-all">
                      {l}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-[15px] font-semibold">Grant the session</h2>
        <p className="mt-1 text-sm text-muted">
          One passkey tap. The session key belongs to Errand's agent (<span className="num">{short(ERRAND_AGENT.address)}</span>), which has its own identity on Celo.
        </p>
        <Button className="mt-4" onClick={onGrant} disabled={!caps || !quote || shortOn || busy !== ""}>
          {busy === "grant" ? "Waiting for your passkey…" : "Grant session"}
        </Button>
        {!quote ? <p className="mt-2 text-[13px] text-muted">Check the cost first.</p> : shortOn ? <p className="mt-2 text-[13px] text-ask">Top up your wallet, then check the cost again.</p> : null}
      </Card>
    </div>
  );
}

function Line({ label, value, note, href }: { label: string; value: string; note?: string; href?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3.5">
      <dt className="text-sm text-muted">
        {label}
        {note ? <span className="block text-[12px]">{note}</span> : null}
      </dt>
      <dd className="num text-[15px]">
        {href ? (
          <a href={href} className="underline decoration-line-strong underline-offset-4 hover:decoration-ink" rel="noreferrer">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
