"use client";

import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { formatUnitsExact } from "@errand/celo/tokens";
import { checkErrandRequest } from "@errand/celo/rules";
import { toAtomic6 } from "@errand/celo/session";
import { Button, Card, CardHeader, ErrorNote, Field, Pill, inputClass } from "@/components/ui";
import { short, txUrl } from "@/lib/celo";
import {
  connectWallet,
  hasBrowserWallet,
  loadReceipts,
  previewCost,
  readBalances,
  runErrand,
  type ConnectedWallet,
  type Preview,
  type Receipt,
  type StepId,
  type StepUpdate,
} from "@/lib/errand";

const STEPS: { id: StepId; label: string }[] = [
  { id: "check", label: "Check the errand and your balance" },
  { id: "quote", label: "Firm quote from Textile FX" },
  { id: "approve", label: "Approve USD₮ for the conversion" },
  { id: "swap", label: "Convert USD₮ to cNGN" },
  { id: "settle", label: "Textile confirms the fill" },
  { id: "pay", label: "Pay the recipient" },
  { id: "verify", label: "Check Errand's tag on every transaction" },
];

const naira = (atomic: string | bigint) => {
  const [w, f = ""] = formatUnitsExact(BigInt(atomic), 6).split(".");
  return `₦${BigInt(w!).toLocaleString("en-US")}${f ? `.${f.slice(0, 2).padEnd(2, "0")}` : ""}`;
};
const usdt = (atomic: string | bigint) => `${Number(formatUnitsExact(BigInt(atomic), 6)).toFixed(4)} USD₮`;

export function ErrandScreen() {
  const [amount, setAmount] = useState("2000");
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

  useEffect(() => {
    setHistory(loadReceipts());
    setWalletAvailable(hasBrowserWallet());
  }, []);

  const nairaAtomic = useMemo(() => {
    try {
      return toAtomic6(amount);
    } catch {
      return null;
    }
  }, [amount]);

  const findings = useMemo(
    () => (nairaAtomic === null ? [{ rule: "E1", reason: "Enter an amount like 2000 (no ₦ sign)." }] : checkErrandRequest({ nairaAtomic, recipient: recipient.trim() || "0x", payer: wallet?.address })).filter(
      (f) => !(f.rule === "E2" && recipient.trim() === ""),
    ),
    [nairaAtomic, recipient, wallet],
  );

  useEffect(() => {
    setPreview(null);
    setPreviewError(null);
    if (nairaAtomic === null || findings.some((f) => f.rule === "E1")) return;
    const t = setTimeout(() => {
      previewCost(nairaAtomic)
        .then(setPreview)
        .catch((e) => setPreviewError(e instanceof Error ? e.message : String(e)));
    }, 500);
    return () => clearTimeout(t);
  }, [nairaAtomic, findings]);

  async function onConnect() {
    setError(null);
    try {
      const w = await connectWallet();
      setWallet(w);
      const b = await readBalances(w.address);
      setBalances({ usdt: b.usdt, celo: b.celo });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onRun() {
    if (!wallet || nairaAtomic === null) return;
    setError(null);
    setReceipt(null);
    setSteps({});
    setRunning(true);
    try {
      const r = await runErrand({ nairaAtomic, recipient: recipient.trim() as Address, label: label.trim().slice(0, 40) }, wallet, (u) => setSteps((s) => ({ ...s, [u.id]: u })));
      setReceipt(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      setHistory(loadReceipts());
      readBalances(wallet.address)
        .then((b) => setBalances({ usdt: b.usdt, celo: b.celo }))
        .catch(() => undefined);
    }
  }

  const ready = wallet && nairaAtomic !== null && recipient.trim() !== "" && findings.length === 0 && preview?.status === "preview" && !running;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="The errand" sub="The recipient gets exactly this much, in cNGN on Celo." />
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
          <Field label="They receive (Naira)" htmlFor="amount" hint="Between ₦1,500 and ₦50,000 while Errand is in testing.">
            <input id="amount" inputMode="decimal" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} disabled={running} />
          </Field>
          <Field label="Label (optional)" htmlFor="label" hint="Only saved in this browser, for your receipt.">
            <input id="label" className={inputClass} value={label} maxLength={40} placeholder="Ada, fabric supplier" onChange={(e) => setLabel(e.target.value)} disabled={running} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Their Celo address" htmlFor="recipient" hint="The wallet that should receive the cNGN. Check it with them first: payments can't be reversed.">
              <input
                id="recipient"
                className={`${inputClass} num`}
                value={recipient}
                spellCheck={false}
                autoComplete="off"
                placeholder="0x…"
                onChange={(e) => setRecipient(e.target.value)}
                disabled={running}
              />
            </Field>
          </div>
        </div>
        <div className="border-t border-line px-5 py-4">
          {findings.length ? (
            <ul className="flex flex-col gap-1 text-sm text-ask">
              {findings.map((f) => (
                <li key={f.reason}>{f.reason}</li>
              ))}
            </ul>
          ) : previewError ? (
            <p className="text-sm text-block">{previewError}</p>
          ) : preview?.status === "preview" && preview.takerPays && preview.buyAmount ? (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[15px]">
                {naira(preview.buyAmount)} costs about <span className="num font-medium">{usdt(preview.takerPays)}</span>
              </span>
              <span className="num text-sm text-muted">
                ≈ ₦{(Number(formatUnitsExact(BigInt(preview.buyAmount), 6)) / Number(formatUnitsExact(BigInt(preview.takerPays), 6))).toFixed(2)} per USD₮ · Textile FX, indicative
              </span>
            </div>
          ) : preview?.status === "no_quote" ? (
            <p className="text-sm text-ask">Textile can't price this right now ({preview.reason}). Try again shortly.</p>
          ) : (
            <p className="text-sm text-muted">Getting a price…</p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Pay from" sub="Your own wallet on Celo. You confirm each step in it." aside={wallet ? <Pill tone="approve">Connected</Pill> : null} />
        <div className="px-5 py-5">
          {wallet ? (
            <div className="flex flex-col gap-1">
              <span className="num text-[15px] break-all">{wallet.address}</span>
              {balances ? (
                <span className="num text-sm text-muted">
                  {usdt(balances.usdt)} · {Number(formatUnitsExact(balances.celo, 18)).toFixed(4)} CELO for network fees
                </span>
              ) : null}
              {wallet.isMiniPay ? (
                <p className="mt-2 text-sm text-ask">MiniPay can't sign Textile's request yet. Errand will support MiniPay once its Textile API key is set up.</p>
              ) : null}
            </div>
          ) : walletAvailable ? (
            <Button variant="secondary" onClick={onConnect}>
              Connect wallet
            </Button>
          ) : (
            <p className="text-sm text-muted">No browser wallet found. Open this page in a browser with a Celo wallet such as MetaMask.</p>
          )}
          <p className="mt-4 text-[13px] leading-snug text-muted">
            Your wallet asks you to confirm about four times: a Textile request (moves no money), the USD₮ approval, the conversion, and the payment. With an Altana
            session (coming soon), Errand does these for you within the limits you set.
          </p>
        </div>
      </Card>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <Card className="p-5">
        <Button onClick={onRun} disabled={!ready || Boolean(wallet?.isMiniPay)}>
          {running ? "Running…" : nairaAtomic !== null ? `Send ${naira(nairaAtomic)}` : "Send"}
        </Button>
        {Object.keys(steps).length ? (
          <ol className="mt-5 flex flex-col gap-3">
            {STEPS.map((s) => {
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

      {receipt?.status === "done" ? <ReceiptCard r={receipt} /> : null}

      {history.length ? (
        <Card>
          <CardHeader title="Your errands" sub="Saved in this browser." />
          <ul className="divide-y divide-line">
            {history.slice(0, 10).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span>
                  {naira(r.nairaAtomic)} to {r.label || short(r.recipient)}
                  <span className="text-muted"> · {new Date(r.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                </span>
                <span className="flex items-center gap-3">
                  {r.txs.payout ? (
                    <a href={txUrl(r.txs.payout)} className="num underline decoration-line-strong underline-offset-2" rel="noreferrer">
                      {short(r.txs.payout)}
                    </a>
                  ) : null}
                  {r.status === "done" ? <Pill tone="approve">Paid</Pill> : <Pill tone="block">Stopped</Pill>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function ReceiptCard({ r }: { r: Receipt }) {
  const rows: [string, string | undefined][] = [
    ["USD₮ approval", r.txs.approve],
    ["Conversion on Textile FX", r.txs.swap],
    ["Payment to recipient", r.txs.payout],
  ];
  return (
    <Card>
      <CardHeader title="Receipt" sub={new Date(r.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} aside={<Pill tone="approve">Paid</Pill>} />
      <dl className="divide-y divide-line">
        <Line label="Recipient received" value={naira(r.nairaAtomic)} />
        <Line label="To" value={r.label ? `${r.label} · ${short(r.recipient)}` : r.recipient} />
        {r.paidUsdt ? <Line label="You paid" value={usdt(r.paidUsdt)} /> : null}
        {r.feeUsdt ? <Line label="Textile fee (included)" value={usdt(r.feeUsdt)} /> : null}
        {rows.map(([label, hash]) =>
          hash ? <Line key={label} label={label} value={`${short(hash)}${r.tagged[label === "USD₮ approval" ? "approve" : label.startsWith("Conversion") ? "swap" : "payout"] ? " · tagged" : ""}`} href={txUrl(hash)} /> : null,
        )}
        {r.rfqId ? <Line label="Textile quote" value={r.rfqId} /> : null}
      </dl>
    </Card>
  );
}

function Line({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="num text-[15px] break-all">
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
