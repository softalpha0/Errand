import type { Metadata } from "next";
import { BenchmarkSection } from "@/components/benchmark";
import { StatsView } from "./stats-view";

export const metadata: Metadata = { title: "Results" };

export default function StatsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-12 pb-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Results</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Two kinds of evidence: a fixed attack benchmark anyone can re-run, and every real errand, graded by Reppo and grouped by the version of the SERV guard that ran it.
      </p>
      <div className="mt-10">
        <BenchmarkSection />
      </div>
      <h2 className="mt-16 text-2xl font-semibold tracking-tight">Real errands</h2>
      <p className="mt-2 max-w-2xl text-muted">How well Errand spends money on real errands, graded by Reppo.</p>
      <div className="mt-6">
        <StatsView />
      </div>
    </div>
  );
}
