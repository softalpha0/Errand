"use client";

import { useState } from "react";
import type { AllowanceStatus } from "@errand/core";
import { Button, Card, CardHeader, ErrorNote, Field, LinkButton, Money, Pill, Skeleton, cx, inputClass } from "@/components/ui";
import { api, type ShippingForm } from "@/lib/api";
import { savePassportToken, usePassport } from "@/lib/passport";

function AllowanceLine({ a }: { a: AllowanceStatus | null }) {
  if (!a) return <p className="text-sm text-muted">Couldn't read your allowance right now.</p>;
  if (a.state === "active") {
    return (
      <p className="text-sm text-muted">
        <span className="font-medium text-ink">Allowance on:</span> <Money usd={a.left ?? 0} className="text-ink" /> left of <Money usd={a.amount ?? 0} /> this {a.period ?? "period"}. Standing errands
        pay from it without asking for your passkey each time.
      </p>
    );
  }
  return (
    <p className="text-sm text-muted">
      <span className="font-medium text-ink">No allowance{a.state === "used_up" ? " left" : ""}.</span> One-off errands still work (each one asks for your passkey). To repeat an errand
      on a schedule, turn on an allowance in{" "}
      <a href={a.dashboardUrl ?? "https://agentpassport.ai/overview"} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
        your Kite dashboard
      </a>
      .
    </p>
  );
}

const EMPTY_SHIP: ShippingForm = { name: "", email: "", line1: "", line2: "", city: "", state: "", postal: "", country: "US", phone: "" };

function ShippingCard() {
  const [f, setF] = useState<ShippingForm>(EMPTY_SHIP);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof ShippingForm) => (ev: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: ev.target.value });
  const fields: { k: keyof ShippingForm; label: string; auto: string; wide?: boolean }[] = [
    { k: "name", label: "First and last name", auto: "name", wide: true },
    { k: "email", label: "Email", auto: "email" },
    { k: "phone", label: "Phone (digits)", auto: "tel" },
    { k: "line1", label: "Address", auto: "address-line1", wide: true },
    { k: "line2", label: "Apartment, suite (optional)", auto: "address-line2", wide: true },
    { k: "city", label: "City", auto: "address-level2" },
    { k: "state", label: "State or region", auto: "address-level1" },
    { k: "postal", label: "Postal code", auto: "postal-code" },
    { k: "country", label: "Country (2 letters)", auto: "country" },
  ];
  return (
    <Card>
      <CardHeader title="Shipping address for Amazon orders" sub="Sent straight to your Kite profile (kpass shop:shipping). Errand doesn't keep it, and it never goes to SERV or Reppo." />
      <form
        className="grid gap-4 px-5 py-5 sm:grid-cols-2"
        onSubmit={async (ev) => {
          ev.preventDefault();
          setBusy(true);
          setErr(null);
          setMsg(null);
          try {
            const r = await api.passportShipping({ ...f, line2: f.line2 || undefined, country: f.country.toUpperCase() });
            setMsg(r.complete ? "Saved to your Kite profile." : `Saved. Kite still needs: ${r.missing.join(", ")}.`);
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Couldn't save the address.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {fields.map((x) => (
          <div key={x.k} className={cx(x.wide && "sm:col-span-2")}>
            <Field label={x.label} htmlFor={`ship-${x.k}`}>
              <input id={`ship-${x.k}`} className={inputClass} value={f[x.k] ?? ""} onChange={set(x.k)} autoComplete={x.auto} />
            </Field>
          </div>
        ))}
        <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted" role="status">
            {msg ?? "Only needed before your first Amazon order."}
          </p>
          <Button type="submit" variant="secondary" disabled={busy}>
            {busy ? "Saving…" : "Save to Kite"}
          </Button>
        </div>
        {err ? (
          <div className="sm:col-span-2">
            <ErrorNote>{err}</ErrorNote>
          </div>
        ) : null}
      </form>
    </Card>
  );
}

export function ConnectView() {
  const { passport, loading, refresh } = usePassport();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<{ passportId: string; simulated: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Skeleton className="h-40" />;

  if (passport) {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader
            title="Connected"
            sub={passport.email}
            aside={passport.simulated ? <Pill>Simulated (demo)</Pill> : <Pill tone="approve">Your Passport</Pill>}
          />
          <div className="flex flex-col gap-3 px-5 py-5">
            {passport.walletAddress ? (
              <p className="text-sm text-muted">
                Wallet <span className="num break-all text-ink">{passport.walletAddress}</span>
              </p>
            ) : passport.simulated ? (
              <p className="text-sm text-muted">Demo mode: no real wallet is used and no money moves.</p>
            ) : null}
            <AllowanceLine a={passport.allowance} />
            <div className="mt-2 flex flex-wrap gap-3">
              <LinkButton href="/new">Start an errand</LinkButton>
              <LinkButton href="/repeat" variant="secondary">
                Repeat an errand
              </LinkButton>
              <Button
                variant="ghost"
                onClick={async () => {
                  await api.passportLogout().catch(() => undefined);
                  savePassportToken(null);
                  refresh();
                }}
              >
                Disconnect
              </Button>
            </div>
          </div>
        </Card>
        <ShippingCard />
      </div>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-5 px-5 py-6">
        {!pending ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (ev) => {
              ev.preventDefault();
              setBusy(true);
              setError(null);
              try {
                setPending(await api.passportLogin(email.trim()));
              } catch (e) {
                setError(e instanceof Error ? e.message : "Couldn't start the login.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Your Kite Passport email" htmlFor="pp-email" hint="Kite emails you an 8-character code. No account at Kite yet? Sign up at agentpassport.ai first.">
              <input id="pp-email" type="email" autoComplete="email" className={inputClass} value={email} onChange={(ev) => setEmail(ev.target.value)} placeholder="you@example.com" />
            </Field>
            <Button type="submit" disabled={busy || !email.includes("@")}>
              {busy ? "Sending…" : "Email me a code"}
            </Button>
          </form>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (ev) => {
              ev.preventDefault();
              setBusy(true);
              setError(null);
              try {
                const r = await api.passportVerify(pending.passportId, code.trim());
                savePassportToken(r.token);
                refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "That code didn't work.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field
              label="Code from Kite's email"
              htmlFor="pp-code"
              hint={pending.simulated ? "Demo mode: no email is sent. Type any 8 letters or numbers, for example DEMO1234." : `Sent to ${email}. It has 8 letters and numbers.`}
            >
              <input id="pp-code" className={cx(inputClass, "num tracking-widest uppercase")} value={code} onChange={(ev) => setCode(ev.target.value)} maxLength={8} autoComplete="one-time-code" />
            </Field>
            <div className="flex gap-3">
              <Button type="submit" disabled={busy || code.trim().length !== 8}>
                {busy ? "Connecting…" : "Connect"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setPending(null)}>
                Use another email
              </Button>
            </div>
          </form>
        )}
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <p className="border-t border-line pt-4 text-[13px] leading-relaxed text-muted">
          What Errand can do with the connection: ask you to approve spending sessions (you approve each with your passkey), pay from your allowance only for standing errands you approved, and read your
          allowance. It can't move money without one of those approvals, and Disconnect logs it out of Kite.
        </p>
      </div>
    </Card>
  );
}
