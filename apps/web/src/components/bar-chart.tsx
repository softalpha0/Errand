"use client";

import { useId, useState } from "react";

export interface Series {
  key: string;
  label: string;
  color: string;
}

/**
 * Dependency-free grouped SVG bar chart, after EasyUI's bar chart:
 * hover and keyboard tooltips, a legend that toggles series, compact ticks,
 * and no animation for people who prefer reduced motion.
 */
export function BarChart({
  data,
  series,
  height = 240,
  max,
  formatValue = (v) => String(Math.round(v)),
  ariaLabel,
}: {
  data: { label: string; values: Record<string, number | null> }[];
  series: Series[];
  height?: number;
  max?: number;
  formatValue?: (v: number) => string;
  ariaLabel: string;
}) {
  const [hidden, setHidden] = useState<string[]>([]);
  const [active, setActive] = useState<{ i: number; key: string } | null>(null);
  const id = useId();
  const shown = series.filter((s) => !hidden.includes(s.key));
  const all = data.flatMap((d) => shown.map((s) => d.values[s.key] ?? 0));
  const top = max ?? Math.max(1, ...all) * 1.1;
  const W = Math.max(680, data.length * (shown.length * 22 + 28));
  const H = height;
  const pad = { l: 40, r: 8, t: 12, b: 28 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const groupW = innerW / Math.max(1, data.length);
  const barW = Math.min(22, (groupW - 12) / Math.max(1, shown.length));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * top);

  return (
    <figure className="w-full">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Show or hide series">
        {series.map((s) => {
          const off = hidden.includes(s.key);
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={!off}
              onClick={() => setHidden((h) => (off ? h.filter((k) => k !== s.key) : [...h, s.key]))}
              className="inline-flex h-8 items-center gap-2 rounded-full border border-line px-3 text-sm text-muted hover:text-ink aria-pressed:text-ink"
            >
              <span className="size-2.5 rounded-sm" style={{ background: off ? "transparent" : s.color, outline: `1.5px solid ${s.color}` }} aria-hidden />
              {s.label}
            </button>
          );
        })}
      </div>
      <div className="relative mt-4 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: Math.min(W, 560) }} role="img" aria-labelledby={`${id}-t`}>
          <title id={`${id}-t`}>{ariaLabel}</title>
          {ticks.map((t) => {
            const y = pad.t + innerH - (t / top) * innerH;
            return (
              <g key={t}>
                <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : "2 4"} />
                <text x={pad.l - 8} y={y + 4} textAnchor="end" fontSize="11" fill="var(--faint)" className="num">
                  {formatValue(t)}
                </text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const gx = pad.l + i * groupW + (groupW - barW * shown.length) / 2;
            return (
              <g key={d.label}>
                {shown.map((s, j) => {
                  const v = d.values[s.key];
                  const h = v === null || v === undefined ? 0 : (v / top) * innerH;
                  const x = gx + j * barW;
                  const y = pad.t + innerH - h;
                  const isActive = active?.i === i && active.key === s.key;
                  return (
                    <rect
                      key={s.key}
                      x={x + 1.5}
                      y={y}
                      width={barW - 3}
                      height={Math.max(h, v === null ? 0 : 1)}
                      rx={3}
                      fill={s.color}
                      opacity={active && !isActive ? 0.45 : 1}
                      tabIndex={v === null || v === undefined ? -1 : 0}
                      aria-label={`${d.label}, ${s.label}: ${v === null || v === undefined ? "no data" : formatValue(v)}`}
                      onMouseEnter={() => setActive({ i, key: s.key })}
                      onMouseLeave={() => setActive(null)}
                      onFocus={() => setActive({ i, key: s.key })}
                      onBlur={() => setActive(null)}
                      style={{ transition: "y 400ms ease, height 400ms ease, opacity 150ms" }}
                    />
                  );
                })}
                <text x={pad.l + i * groupW + groupW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
                  {d.label.length > 22 ? `${d.label.slice(0, 21)}…` : d.label}
                </text>
              </g>
            );
          })}
        </svg>
        {active ? (
          <div className="pointer-events-none absolute top-0 right-0 rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm" role="status">
            <span className="text-muted">{data[active.i]?.label} · </span>
            <span className="text-muted">{series.find((s) => s.key === active.key)?.label}: </span>
            <span className="num font-medium">
              {(() => {
                const v = data[active.i]?.values[active.key];
                return v === null || v === undefined ? "no data" : formatValue(v);
              })()}
            </span>
          </div>
        ) : null}
      </div>
    </figure>
  );
}
