"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart } from "@/components/bar-chart";
import { Card, CardHeader, ErrorNote, LinkButton, Money, Pill, Skeleton } from "@/components/ui";
import { api, type ErrandSummary, type StatsResponse } from "@/lib/api";
import { STATUS_TEXT, dateOf } from "@/lib/format";

export function StatsView() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [list, setList] = useState<ErrandSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.stats(), api.list(30)])
      .then(([s, l]) => {
        setStats(s);
        setList(l);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load results."));
  }, []);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!stats || !list) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-64" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (stats.series.length === 0) {
    return (
      <Card>
        <div className="px-6 py-10 text-center">
          <p className="font-medium">No finished errands yet.</p>
          <p className="mt-1 text-sm text-muted">Results appear here once errands finish and Reppo grades them.</p>
          <LinkButton href="/new" className="mt-5">
            Run the first one
          </LinkButton>
        </div>
      </Card>
    );
  }

  const versions = stats.byVersion;
  const series = stats.series.slice(-16);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Before and after, by guard version" sub="Each time Reppo's grades point to a weak guard step, the step is changed and the version goes up." />
        <div className="px-5 py-5">
          <BarChart
            ariaLabel="Average Reppo score and waste rate by guard version"
            data={versions.map((v) => ({ label: v.guardVersion, values: { score: v.avgReppoScore, waste: v.avgWasteRate * 100 } }))}
            series={[
              { key: "score", label: "Avg Reppo score", color: "var(--accent)" },
              { key: "waste", label: "Waste rate %", color: "var(--block)" },
            ]}
            max={100}
            formatValue={(v) => v.toFixed(0)}
          />
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-4 font-medium">Guard</th>
                  <th className="py-2 pr-4 font-medium">Errands</th>
                  <th className="py-2 pr-4 font-medium">Graded</th>
                  <th className="py-2 pr-4 font-medium">Avg score</th>
                  <th className="py-2 pr-4 font-medium">Accepted</th>
                  <th className="py-2 pr-4 font-medium">Waste</th>
                  <th className="py-2 font-medium">Cost / accepted</th>
                </tr>
              </thead>
              <tbody className="num">
                {versions.map((v) => (
                  <tr key={v.guardVersion} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-4">{v.guardVersion}</td>
                    <td className="py-2.5 pr-4">{v.errands}</td>
                    <td className="py-2.5 pr-4">{v.graded}</td>
                    <td className="py-2.5 pr-4">{v.avgReppoScore?.toFixed(1) ?? "–"}</td>
                    <td className="py-2.5 pr-4">{v.acceptRate !== null ? `${Math.round(v.acceptRate * 100)}%` : "–"}</td>
                    <td className="py-2.5 pr-4">{Math.round(v.avgWasteRate * 100)}%</td>
                    <td className="py-2.5">{v.costPerAcceptedUsd !== null ? <Money usd={v.costPerAcceptedUsd} /> : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-faint">Waste rate = (paid calls the answer never used + blocked attempts) ÷ attempted payments. Small samples: read as a direction, not proof.</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Recent runs" sub="Spend per errand, in dollars." />
        <div className="px-5 py-5">
          <BarChart
            ariaLabel="Spend per recent errand"
            data={series.map((s, i) => ({ label: `#${stats.series.length - series.length + i + 1}`, values: { spent: s.spentUsd } }))}
            series={[{ key: "spent", label: "Spent ($)", color: "var(--ink)" }]}
            formatValue={(v) => (v < 1 ? v.toFixed(2) : v.toFixed(1))}
            height={200}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="All errands" />
        <ul className="divide-y divide-line">
          {list.map((x) => (
            <li key={x.id}>
              <Link href={x.status === "done" ? `/r/${x.id}` : `/e/${x.id}`} className="flex items-start gap-4 px-5 py-3.5 hover:bg-sunken/60">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{x.task}</p>
                  <p className="text-xs text-faint">
                    {dateOf(x.createdAt)} · {x.mode === "demo" ? "simulated" : "live"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                  <Money usd={x.metrics.spentUsd} />
                  <Pill tone={x.status === "done" ? "approve" : x.status === "failed" ? "block" : "neutral"}>{STATUS_TEXT[x.status]}</Pill>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
