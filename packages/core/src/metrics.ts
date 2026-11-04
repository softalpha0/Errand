import { spentUsd } from "./guard";
import type { Errand } from "./types";

export interface ErrandMetrics {
  attempted: number;
  paid: number;
  blocked: number;
  asked: number;
  unused: number;
  spentUsd: number;
  /** (paid calls the answer never used + blocked attempts) / attempted paid calls. */
  wasteRate: number;
  reppoScore: number | null;
  accepted: boolean | null;
}

export function errandMetrics(e: Errand): ErrandMetrics {
  const attempted = e.decisions.length;
  const blocked = e.decisions.filter((d) => d.decision === "block").length;
  const asked = e.decisions.filter((d) => d.decision === "ask").length;
  const unused = e.payments.filter((p) => p.used === false).length;
  return {
    attempted,
    paid: e.payments.length,
    blocked,
    asked,
    unused,
    spentUsd: spentUsd(e.payments),
    wasteRate: attempted === 0 ? 0 : (unused + blocked) / attempted,
    reppoScore: e.evaluation?.score ?? null,
    accepted: e.evaluation?.decision ? e.evaluation.decision === "accept" : null,
  };
}

export interface VersionStats {
  guardVersion: string;
  errands: number;
  graded: number;
  avgReppoScore: number | null;
  acceptRate: number | null;
  avgWasteRate: number;
  costPerAcceptedUsd: number | null;
}

/** Group finished errands by the guard graph version that ran them: the before/after view. */
export function statsByVersion(errands: Errand[]): VersionStats[] {
  const groups = new Map<string, Errand[]>();
  for (const e of errands) {
    if (e.status !== "done") continue;
    const list = groups.get(e.guardVersion) ?? [];
    list.push(e);
    groups.set(e.guardVersion, list);
  }
  return [...groups.entries()].map(([guardVersion, list]) => {
    const m = list.map(errandMetrics);
    const graded = m.filter((x) => x.reppoScore !== null);
    const accepted = m.filter((x) => x.accepted === true);
    const totalSpent = m.reduce((a, x) => a + x.spentUsd, 0);
    return {
      guardVersion,
      errands: list.length,
      graded: graded.length,
      avgReppoScore: graded.length ? graded.reduce((a, x) => a + (x.reppoScore ?? 0), 0) / graded.length : null,
      acceptRate: graded.length ? accepted.length / graded.length : null,
      avgWasteRate: m.reduce((a, x) => a + x.wasteRate, 0) / m.length,
      costPerAcceptedUsd: accepted.length ? totalSpent / accepted.length : null,
    };
  });
}
