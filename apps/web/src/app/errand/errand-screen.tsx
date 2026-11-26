"use client";

import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { formatUnitsExact } from "@errand/celo/tokens";
import { LOCAL_CURRENCIES, toAtomic, type LocalCurrency } from "@errand/celo/currencies";
import { checkErrandCost, checkErrandRequest } from "@errand/celo/rules";
import { ReceiptView } from "@/components/receipt-view";
import { Button, Card, CardHeader, ErrorNote, Field, Pill, inputClass } from "@/components/ui";
import { short, txUrl } from "@/lib/celo";
import { receiptLink } from "@/lib/receipt-link";
import { loadSession, sessionUsable, type StoredSession } from "@/lib/session";
import { loadWallet, type StoredWallet } from "@/lib/wallet";
import {
  LowBalanceError,
  MINIPAY_DEPOSIT_URL,
  connectWallet,
  currencyAvailability,
  formatLocal,
  hasBrowserWallet,
  inMiniPay,
  loadReceipts,
  previewCost,
  readBalances,
  receiptCurrency,
  runErrand,
  runSessionErrand,
  sessionPayoutToken,
  type Availability,
  type ConnectedWallet,
  type Preview,
  type Receipt,
  type StepId,
  type StepUpdate,
} from "@/lib/errand";

const DEFAULT_AMOUNT: Record<string, string> = { NGN: "2000", IDR: "25000", ARS: "2000", BRL: "10", MXN: "40", COP: "8000" };

const usdt = (atomic: string | bigint) => `${Number(formatUnitsExact(BigInt(atomic), 6)).toFixed(4)} USD₮`;

function stepsFor(c: LocalCurrency): { id: StepId; label: string }[] {
  return [
    { id: "check", label: "Check the errand and your balance" },
    { id: "quote", label: "Firm quote from Textile FX" },
    { id: "approve", label: "Approve USD₮ for the conversion" },
    { id: "swap", label: `Convert USD₮ to ${c.token.symbol}` },
    { id: "settle", label: "Textile confirms the fill" },
    { id: "pay", label: "Pay the recipient" },
    { id: "verify", label: "Check Errand's tag on every transaction" },
    { id: "tool", label: "Independent check on a second Celo node (Errand pays $0.01 on buy)" },
  ];
}

export function ErrandScreen() {
  const [currency, setCurrency] = useState<LocalCurrency>(LOCAL_CURRENCIES[0]!);
  const [availability, setAvailability] = useState<Record<string, Availability> | null>(null);
  const [amount, setAmount] = useState(DEFAULT_AMOUNT.NGN!);
  const [recipient, setRecipient] = useState("");
  const [label, setLabel] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [balances, setBalances] = useState<{ usdt: bigint; celo: bigint } | null>(null);
  const [steps, setSteps] = useState<Record<string, StepUpdate>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [history, setHistory] = useState<Receipt[]>([]);
  const [walletAvailable, setWalletAvailable] = useState(true);
  const [lowBalance, setLowBalance] = useState(false);
  const [origin, setOrigin] = useState("");
  // The user's Altana wallet with an active Errand session on this device, if any.
  const [errandWallet, setErrandWallet] = useState<{ wallet: StoredWallet; session: StoredSession & { deviceKey: `0x${string}` } } | null>(null);
  const [useSession, setUseSession] = useState(false);
  const [sessionUsdt, setSessionUsdt] = useState<bigint | null>(null);

  useEffect(() => {
    setHistory(loadReceipts());
    setWalletAvailable(hasBrowserWallet());
    setOrigin(window.location.origin);
    const w = loadWallet();
    const sess = w ? loadSession(w.address) : null;
    if (w && sessionUsable(sess) && !inMiniPay()) {
      setErrandWallet({ wallet: w, session: sess });
      setUseSession(true);
      readBalances(w.address as Address)
        .then((b) => setSessionUsdt(b.usdt))
        .catch(() => undefined);
    }
    // MiniPay: connect without a button (zero-click), as MiniPay requires.
    if (inMiniPay()) void onConnect();
    currencyAvailability()
      .then((list) => setAvailability(Object.fromEntries(list.map((a) => [a.code, a]))))
      .catch(() => setAvailability({}));
  }, []);

  function pick(c: LocalCurrency) {
    if (running) return;
    setCurrency(c);
    setAmount(DEFAULT_AMOUNT[c.code] ?? "10");
    setSteps({});
    setReceipt(null);
    setError(null);
  }

  const amountAtomic = useMemo(() => {
    try {
      return toAtomic(amount, currency.token.decimals);
    } catch {
      return null;
    }
  }, [amount, currency]);

  const findings = useMemo(() => {
    if (amountAtomic === null) return [{ rule: "E1", reason: `Enter an amount like ${DEFAULT_AMOUNT[currency.code]} (no currency sign).` }];
    return checkErrandRequest({ localToken: currency.token.address, amountAtomic, recipient: recipient.trim() || "0x", payer: wallet?.address }).filter(
      (f) => !(f.rule === "E2" && recipient.trim() === ""),
    );
  }, [amountAtomic, recipient, wallet, currency]);

  const costFindings = preview?.status === "preview" && preview.takerPays ? checkErrandCost(BigInt(preview.takerPays)) : [];
  const avail = availability?.[currency.code];
  const unavailable = avail && !avail.available;

  useEffect(() => {
    setPreview(null);
    setPreviewError(null);
    if (amountAtomic === null || amountAtomic === 0n || unavailable) return;
    const t = setTimeout(() => {
      previewCost(currency, amountAtomic)
        .then(setPreview)
        .catch((e) => setPreviewError(e instanceof Error ? e.message : String(e)));
    }, 500);
    return () => clearTimeout(t);
  }, [amountAtomic, currency, unavailable]);

  async function onConnect() {
    setError(null);
    try {
      const w = await connectWallet();
      setWallet(w);
      const b = await readBalances(w.address);
      setBalances(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onRun() {
    if (amountAtomic === null) return;
    if (useSession && errandWallet) return onRunSession();
    if (!wallet) return;
    setError(null);
    setLowBalance(false);
    setReceipt(null);
    setSteps({});
    setRunning(true);
    try {
      const r = await runErrand({ currency, amountAtomic, recipient: recipient.trim() as Address, label: label.trim().slice(0, 40) }, wallet, (u) =>
        setSteps((s) => ({ ...s, [u.id]: u })),
      );
      setReceipt(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLowBalance(e instanceof LowBalanceError);
    } finally {
      setRunning(false);
      setHistory(loadReceipts());
      readBalances(wallet.address)
        .then(setBalances)
        .catch(() => undefined);
    }
  }

  async function onRunSession() {
    if (!errandWallet || amountAtomic === null) return;
    setError(null);
    setLowBalance(false);
    setReceipt(null);
    setSteps({});
    setRunning(true);
    try {
      const r = await runSessionErrand({ currency, amountAtomic, recipient: recipient.trim() as Address, label: label.trim().slice(0, 40) }, errandWallet.wallet, errandWallet.session, (u) =>
        setSteps((s) => ({ ...s, [u.id]: u })),
      );
      setReceipt(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      setHistory(loadReceipts());
      readBalances(errandWallet.wallet.address as Address)
        .then((b) => setSessionUsdt(b.usdt))
        .catch(() => undefined);
    }
  }

  const sessionToken = errandWallet ? sessionPayoutToken(errandWallet.session) : null;
  const sessionCurrencyMismatch = Boolean(useSession && sessionToken && sessionToken.toLowerCase() !== currency.token.address.toLowerCase());

  const ready =
    (wallet || (useSession && errandWallet && !sessionCurrencyMismatch)) && amountAtomic !== null && recipient.trim() !== "" && findings.length === 0 && costFindings.length === 0 && preview?.status === "preview" && !running && !unavailable;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Currency" sub="The money they receive, as a local stablecoin on Celo." />
        <div className="grid grid-cols-2 gap-2 px-5 py-5 sm:grid-cols-3">
          {LOCAL_CURRENCIES.map((c) => {
            const a = availability?.[c.code];
            const off = a && !a.available;
            const selected = c.code === currency.code;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => pick(c)}
                aria-pressed={selected}
                disabled={running}
                className={`flex flex-col items-start rounded-xl border px-3.5 py-2.5 text-left ${selected ? "border-ink bg-sunken" : "border-line-strong bg-card hover:border-ink/40"} ${off ? "opacity-60" : ""}`}
              >
                <span className="text-[15px] font-medium">
                  {c.sign} {c.country}
                </span>
                <span className="num text-[12px] text-muted">
                  {c.token.symbol}
                  {a?.perUsdt ? ` · ${c.sign}${a.perUsdt.toLocaleString("en-US", { maximumFractionDigits: 2 })}/USD₮` : ""}
                </span>
                {off ? <span className="text-[12px] text-ask">Not available now</span> : null}
              </button>
            );
          })}
        </div>
        {availability === null ? <p className="border-t border-line px-5 py-3 text-[13px] text-muted">Checking live prices on Textile FX…</p> : null}
      </Card>

      <Card>
        <CardHeader title="The errand" sub={`The recipient gets exactly this much, in ${currency.token.symbol} on Celo.`} />
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
          <Field label={`They receive (${currency.name})`} htmlFor="amount" hint="Worth between about $1.10 and $35 while Errand is in testing.">
            <input id="amount" inputMode="decimal" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} disabled={running} />
          </Field>
          <Field label="Label (optional)" htmlFor="label" hint="Only saved in this browser, for your receipt.">
            <input id="label" className={inputClass} value={label} maxLength={40} placeholder="Ada, fabric supplier" onChange={(e) => setLabel(e.target.value)} disabled={running} />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Their Celo address"
              htmlFor="recipient"
              hint={
                <>
                  The Celo wallet that should receive the {currency.token.symbol} (a MiniPay or Valora address works). Check it with them first: payments can&apos;t be
                  reversed. They receive {currency.token.symbol}, a {currency.name} stablecoin, in that wallet, not in a bank account.
                </>
              }
            >
              <input id="recipient" className={`${inputClass} num`} value={recipient} spellCheck={false} autoComplete="off" placeholder="0x…" onChange={(e) => setRecipient(e.target.value)} disabled={running} />
            </Field>
          </div>
        </div>
        <div className="border-t border-line px-5 py-4">
          {unavailable ? (
            <p className="text-sm text-ask">
              {currency.token.symbol} isn&apos;t available on Textile FX right now ({avail?.reason}). Pick another currency or try later.
            </p>
          ) : findings.length || costFindings.length ? (
            <ul className="flex flex-col gap-1 text-sm text-ask">
              {[...findings, ...costFindings].map((f) => (
                <li key={f.reason}>{f.reason}</li>
              ))}
            </ul>
          ) : previewError ? (
            <p className="text-sm text-block">{previewError}</p>
          ) : preview?.status === "preview" && preview.takerPays && preview.buyAmount ? (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[15px]">
                {formatLocal(currency, preview.buyAmount)} costs about <span className="num font-medium">{usdt(preview.takerPays)}</span>
              </span>
              <span className="num text-sm text-muted">Textile FX, indicative</span>
            </div>
          ) : preview?.status === "no_quote" ? (
            <p className="text-sm text-ask">Textile can&apos;t price this right now ({preview.reason}). Try again shortly.</p>
          ) : (
            <p className="text-sm text-muted">Getting a price…</p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Pay from" sub="Your own wallet on Celo. You confirm each step in it." aside={wallet ? <Pill tone="approve">Connected</Pill> : null} />
        <div className="px-5 py-5">
          {errandWallet ? (
            <div className="mb-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setUseSession(true)}
                aria-pressed={useSession}
                disabled={running}
                className={`rounded-xl border px-4 py-3 text-left ${useSession ? "border-accent bg-accent-soft" : "border-line-strong hover:border-ink/40"}`}
              >
                <span className="block text-[15px] font-medium">Your Errand wallet</span>
                <span className="block text-[13px] text-muted">
                  No prompts: Errand runs it inside your session
                  {sessionUsdt !== null ? ` · ${usdt(sessionUsdt)}` : ""}
                </span>
                <span className="mt-1 block text-[12px] text-faint">Session until {new Date(errandWallet.session.session.expiry * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
              </button>
              <button
                type="button"
                onClick={() => setUseSession(false)}
                aria-pressed={!useSession}
                disabled={running}
                className={`rounded-xl border px-4 py-3 text-left ${!useSession ? "border-accent bg-accent-soft" : "border-line-strong hover:border-ink/40"}`}
              >
                <span className="block text-[15px] font-medium">Another wallet</span>
                <span className="block text-[13px] text-muted">MetaMask or another Celo wallet; you confirm each step</span>
              </button>
            </div>
          ) : null}
          {useSession && errandWallet ? (
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted">
                Errand will approve, convert and pay from your Errand wallet without asking again, only within your session&apos;s daily limits and allowed contracts.
                You can revoke it any time on the{" "}
                <a href="/session" className="text-accent underline decoration-accent/30 underline-offset-4">
                  Session page
                </a>
                .
              </p>
              {sessionCurrencyMismatch ? (
                <p className="text-sm text-ask">This session only pays out in another currency. Pick that currency above, or use another wallet.</p>
              ) : null}
            </div>
          ) : wallet?.isMiniPay ? (
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-medium">Your MiniPay wallet</span>
              {balances ? <span className="num text-sm text-muted">{usdt(balances.usdt)} available · network fees are paid in USD₮</span> : null}
            </div>
          ) : wallet ? (
            <div className="flex flex-col gap-1">
              <span className="num text-[15px] break-all">{wallet.address}</span>
              {balances ? (
                <span className="num text-sm text-muted">
                  {usdt(balances.usdt)} · {Number(formatUnitsExact(balances.celo, 18)).toFixed(4)} CELO for network fees
                </span>
              ) : null}
            </div>
          ) : walletAvailable && inMiniPay() ? (
            <p className="text-sm text-muted">Opening your MiniPay wallet…</p>
          ) : walletAvailable ? (
            <Button variant="secondary" onClick={onConnect}>
              Connect wallet
            </Button>
          ) : (
            <p className="text-sm text-muted">No wallet found. Open this page inside MiniPay, or in a browser with a Celo wallet such as MetaMask.</p>
          )}
          <p className="mt-4 text-[13px] leading-snug text-muted">
            Your wallet asks you to confirm three times: the USD₮ approval, the conversion, and the payment. With an Altana session (coming soon), Errand does these for
            you within the limits you set.
          </p>
        </div>
      </Card>

      {error ? (
        <ErrorNote>
          {error}
          {lowBalance && wallet?.isMiniPay ? (
            <a href={MINIPAY_DEPOSIT_URL} className="mt-3 block font-semibold underline underline-offset-4">
              Deposit USD₮ in MiniPay →
            </a>
          ) : null}
        </ErrorNote>
      ) : null}

      <Card className="p-5">
        <Button onClick={onRun} disabled={!ready}>
          {running ? "Running…" : amountAtomic !== null && amountAtomic > 0n ? `Send ${formatLocal(currency, amountAtomic)}` : "Send"}
        </Button>
        {Object.keys(steps).length ? (
          <ol className="mt-5 flex flex-col gap-3">
            {stepsFor(currency).map((s) => {
              const u = steps[s.id];
              const state = u?.state ?? "waiting";
              return (
                <li key={s.id} className="flex gap-3">
                  <span
                    className={`mt-1.5 size-2.5 shrink-0 rounded-full ${state === "done" ? "bg-accent" : state === "failed" ? "bg-block" : state === "running" ? "pulse-dot bg-ask" : state === "skipped" ? "bg-line-strong" : "bg-line"}`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className={`text-[15px] ${state === "waiting" ? "text-faint" : ""}`}>{s.label}</p>
                    {u?.detail ? <p className="text-sm text-muted">{u.detail}</p> : null}
                    {u?.tx ? (
                      <a href={txUrl(u.tx)} className="num text-sm underline decoration-line-strong underline-offset-2" rel="noreferrer">
                        {short(u.tx)} on Celoscan
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : null}
      </Card>

      {receipt?.status === "done" ? <ReceiptView r={{ ...receipt, ...(receipt.buyCheck?.status === "checked" ? { buy: { ok: receipt.buyCheck.ok, at: receipt.buyCheck.at, ...(receipt.buyCheck.paymentTx ? { tx: receipt.buyCheck.paymentTx } : {}) } } : {}) }} shareUrl={origin ? receiptLink(receipt, origin) : undefined} /> : null}

      {history.length ? (
        <Card>
          <CardHeader title="Your errands" sub="Saved in this browser." />
          <ul className="divide-y divide-line">
            {history.slice(0, 10).map((r) => {
              const { currency: c, amount: a } = receiptCurrency(r);
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span>
                    {formatLocal(c, a)} to {r.label || short(r.recipient)}
                    <span className="text-muted"> · {new Date(r.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    {r.status === "done" && origin ? (
                      <a href={receiptLink(r, origin)} className="text-accent underline decoration-accent/30 underline-offset-2">
                        Receipt
                      </a>
                    ) : r.txs.payout ? (
                      <a href={txUrl(r.txs.payout)} className="num underline decoration-line-strong underline-offset-2" rel="noreferrer">
                        {short(r.txs.payout)}
                      </a>
                    ) : null}
                    {r.status === "done" ? <Pill tone="approve">Paid</Pill> : <Pill tone="block">Stopped</Pill>}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
