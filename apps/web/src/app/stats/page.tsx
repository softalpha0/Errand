import type { Metadata } from "next";
import { StatsView } from "./stats-view";

export const metadata: Metadata = { title: "Results" };

export default function StatsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-12 pb-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Results</h1>
      <p className="mt-2 max-w-2xl text-muted">
        How well Errand spends money, graded by Reppo and grouped by the version of the SERV guard that ran each errand.
      </p>
      <div className="mt-8">
        <StatsView />
      </div>
    </div>
  );
}
