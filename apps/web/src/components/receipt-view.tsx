"use client";

import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { assertTagged } from "@errand/celo/attribution";
import { currencyByCode } from "@errand/celo/currencies";
import { payoutInLogs } from "@errand/celo/rules";
import { formatUnitsExact } from "@errand/celo/tokens";
import { CELO, short, txUrl } from "@/lib/celo";
import { formatLocal } from "@/lib/errand";
import type { SharedReceipt } from "@/lib/receipt-link";
import { publicClient } from "@/lib/wallet";
import { CURRENCY_STYLE } from "./live-rates";
import { Button, Pill, cx } from "./ui";

type TxKey = "reset" | "approve" | "swap" | "payout";
const TX_LABEL: Record<TxKey, string> = {
  reset: "Old approval reset",
  approve: "USD₮ approval for Textile",
  swap: "Conversion on Textile FX",
  payout: "Payment to the recipient",
};

type Check = { success: boolean; tagged: boolean; matches?: boolean };
type LiveState = { phase: "checking" } | { phase: "done"; checks: Partial<Record<TxKey, Check>> } | { phase: "error"; message: string };

const usdt = (atomic: string) => `${Number(formatUnitsExact(BigInt(atomic), 6)).toFixed(4)} USD₮`;

/**
 * A receipt that proves itself: every fact is read back from Celo when the receipt is shown
 * (did each transaction succeed, does it carry Errand's tag, did the payment send exactly this
 * amount to this person), plus the result of Errand's paid independent check on buy, if any.
 */
export function ReceiptView({ r, shareUrl }: { r: SharedReceipt; shareUrl?: string }) {
  const currency = currencyByCode(r.currency ?? "NGN") ?? currencyByCode("NGN")!;
  const amount = r.amountAtomic ?? r.nairaAtomic ?? "0";
  const style = CURRENCY_STYLE[currency.code]!;
  const [live, setLive] = useState<LiveState>({ phase: "checking" });
  const [copied, setCopied] = useState(false);
  const entries = (Object.entries(r.txs) as [TxKey, Hex | undefined][]).filter((e): e is [TxKey, Hex] => Boolean(e[1]));

  useEffect(() => {
    let alive = true;
    (async () => {
      const checks: Partial<Record<TxKey, Check>> = {};
      for (const [key, hash] of entries) {
        const rc = await publicClient.getTransactionReceipt({ hash });
        // assertTagged reads a direct transaction (MiniPay, MetaMask) and an Altana relayed intent alike.
        const tagged = await assertTagged(publicClient as never, hash).then(() => true).catch(() => false);
        const check: Check = { success: rc.status === "success", tagged };
        if (key === "payout") {
          // The payment is read from the token's Transfer log, which looks the same whoever sent it.
          check.matches = payoutInLogs(rc.logs, { token: currency.token.address, recipient: r.recipient, amount: BigInt(amount), from: r.taker });
        }
        checks[key] = check;
      }
      if (alive) setLive({ phase: "done", checks });
    })().catch((e) => alive && setLive({ phase: "error", message: e instanceof Error ? e.message.slice(0, 140) : String(e) }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(r.txs)]);

  const allGood =
    live.phase === "done" && entries.length > 0 && entries.every(([k]) => live.checks[k]?.success && live.checks[k]?.tagged) && live.checks.payout?.matches === true;

  async function share() {
    if (!shareUrl) return;
    try {
      if (navigator.share) await navigator.share({ title: "Errand receipt", url: shareUrl });
      else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // the person closed the share sheet
    }
  }

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-card">
      <div className="p-5 sm:p-6" style={{ background: style.bg, color: style.fg }}>
        <div className="flex items-center justify-between text-sm font-medium">
          <span className="opacity-80">Errand receipt</span>
          <span className="opacity-80">{new Date(r.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
        </div>
        <p className="mt-6 text-sm opacity-80">They received</p>
        <p className="num mt-1 text-[44px] leading-none font-bold tracking-tight sm:text-6xl">{formatLocal(currency, amount)}</p>
        <p className="num mt-2 text-sm opacity-80">
          {currency.token.symbol} on Celo{r.paidUsdt ? ` · cost ${usdt(r.paidUsdt)}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        {live.phase === "checking" ? (
          <>
            <span className="pulse-dot size-2.5 rounded-full bg-ask" aria-hidden />
            <span className="text-sm text-muted">Checking every transaction on Celo…</span>
          </>
        ) : live.phase === "error" ? (
          <span className="text-sm text-ask">Couldn&apos;t reach Celo to re-check right now. The Celoscan links below still work.</span>
        ) : allGood ? (
          <>
            <span className="grid size-6 place-items-center rounded-full bg-accent text-[13px] font-bold text-accent-ink" aria-hidden>
              ✓
            </span>
            <span className="text-sm">Checked on Celo just now: every step succeeded, carries Errand&apos;s tag, and the payment matches.</span>
          </>
        ) : !r.txs.payout ? (
          <span className="text-sm text-ask">This receipt has no payment to the recipient, so the errand didn&apos;t finish. The steps below are checked on Celo.</span>
        ) : (
          <span className="text-sm text-block">Something on this receipt doesn&apos;t match what&apos;s on Celo. Check the lines marked in red below.</span>
        )}
      </div>

      <dl className="divide-y divide-line">
        <Row label="To">
          <span className="break-all">{r.label ? `${r.label} · ${short(r.recipient)}` : r.recipient}</span>
        </Row>
        {r.paidUsdt ? <Row label="You paid">{usdt(r.paidUsdt)}</Row> : null}
        {r.feeUsdt ? <Row label="Textile fee (included)">{usdt(r.feeUsdt)}</Row> : null}
        {entries.map(([key, hash]) => {
          const c = live.phase === "done" ? live.checks[key] : undefined;
          return (
            <Row key={key} label={TX_LABEL[key]}>
              <span className="flex flex-wrap items-center justify-end gap-2">
                <a href={txUrl(hash)} className="text-accent underline decoration-accent/30 underline-offset-4" rel="noreferrer">
                  {short(hash)} ↗
                </a>
                {c ? (
                  <>
                    <Pill tone={c.success ? "approve" : "block"}>{c.success ? "Succeeded" : "Failed"}</Pill>
                    <Pill tone={c.tagged ? "approve" : "block"}>{c.tagged ? "Tagged" : "No tag"}</Pill>
                    {key === "payout" ? <Pill tone={c.matches ? "approve" : "block"}>{c.matches ? "Amount matches" : "Doesn't match"}</Pill> : null}
                  </>
                ) : null}
              </span>
            </Row>
          );
        })}
        {r.buy ? (
          <Row label="Independent check">
            <span className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-sm text-muted">Chainstack node, paid by Errand on buy</span>
              <Pill tone={r.buy.ok ? "approve" : "block"}>{r.buy.ok ? "Confirmed" : "Disagreed"}</Pill>
              {r.buy.tx ? (
                <a href={txUrl(r.buy.tx)} className="text-accent underline decoration-accent/30 underline-offset-4" rel="noreferrer">
                  $0.01 payment ↗
                </a>
              ) : null}
            </span>
          </Row>
        ) : null}
        {r.rfqId ? <Row label="Textile quote">{r.rfqId}</Row> : null}
        <Row label="Attribution tag">{CELO.attributionTag}</Row>
      </dl>

      {shareUrl ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
          <Button variant="secondary" size="sm" onClick={share}>
            {copied ? "Link copied" : "Share receipt"}
          </Button>
          <span className="text-[13px] text-muted">Anyone with the link can check it on Celo.</span>
        </div>
      ) : null}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={cx("num text-[14px]")}>{children}</dd>
    </div>
  );
}
