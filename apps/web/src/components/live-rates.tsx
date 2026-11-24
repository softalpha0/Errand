"use client";

import { useEffect, useState } from "react";
import { LOCAL_CURRENCIES } from "@errand/celo/currencies";
import { currencyAvailability } from "@/lib/errand";
import { cx } from "./ui";

type Row = Awaited<ReturnType<typeof currencyAvailability>>[number];

/** Tile colours per currency (CSS variables in globals.css). Dark text on light tiles. */
export const CURRENCY_STYLE: Record<string, { bg: string; fg: string }> = {
  NGN: { bg: "var(--ngn)", fg: "#eafff4" },
  IDR: { bg: "var(--idr)", fg: "#fff1ef" },
  ARS: { bg: "var(--ars)", fg: "#eef7ff" },
  BRL: { bg: "var(--brl)", fg: "#2a2105" },
  MXN: { bg: "var(--mxn)", fg: "#f5f0ff" },
  COP: { bg: "var(--cop)", fg: "#2a1605" },
};

function fmt(n: number) {
  return n >= 100 ? Math.round(n).toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtUsd(n: number) {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`;
}

/** What 1 USD₮ buys in each local currency right now (Textile FX $5 preview, cached 60 s on the server). */
export function LiveRates() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    currencyAvailability()
      .then((r) => {
        if (!live) return;
        setRows(r);
        setCheckedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted">1 USD₮ buys right now</p>
        <p className="text-[13px] text-faint">
          {error ? "Live prices unavailable right now" : rows ? `Textile FX live price · checked ${checkedAt}` : "Asking Textile FX…"}
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {LOCAL_CURRENCIES.map((c) => {
          const row = rows?.find((r) => r.code === c.code);
          const on = !!row?.available && row.perUsdt !== undefined;
          const style = CURRENCY_STYLE[c.code]!;
          return (
            <div
              key={c.code}
              className={cx("relative overflow-hidden rounded-3xl p-5 transition-opacity sm:p-6", !on && "border border-line bg-card")}
              style={on ? { background: style.bg, color: style.fg } : undefined}
            >
              <div className="flex items-center justify-between text-sm font-medium">
                <span className={cx(on ? "opacity-85" : "text-muted")}>{c.country}</span>
                <span className={cx("num text-[12px]", on ? "opacity-70" : "text-faint")}>{c.token.symbol}</span>
              </div>
              {!rows && !error ? (
                <div className="mt-6 h-10 w-3/4 animate-pulse rounded-lg bg-sunken motion-reduce:animate-none" />
              ) : on ? (
                <p className="num mt-6 text-[34px] leading-none font-bold tracking-tight sm:text-5xl">
                  <span className="text-xl opacity-70 sm:text-3xl">{c.sign}</span>
                  {fmt(row!.perUsdt!)}
                </p>
              ) : (
                <p className="mt-6 text-[15px] leading-snug text-muted">{error ? "Price unavailable" : "Not available now"}</p>
              )}
              <p className={cx("mt-2 text-[13px]", on ? "opacity-70" : "text-faint")}>
                {on && row?.depthUsd !== undefined ? `up to ${fmtUsd(row.depthUsd)} available` : on ? c.code : row?.reason ? "No sellers at the moment" : c.code}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
