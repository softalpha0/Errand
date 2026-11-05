import type { Metadata } from "next";
import { RepeatView } from "./repeat-view";

export const metadata: Metadata = { title: "Repeat an errand" };

export default function RepeatPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-12 pb-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Repeat an errand</h1>
      <p className="mt-2 text-muted">
        &ldquo;Keep Mum&rsquo;s data topped up, at most $1 a day.&rdquo; You approve the plan once; Errand repeats exactly that plan every day or week and pays from your Kite allowance. Every payment is
        still checked first.
      </p>
      <div className="mt-8">
        <RepeatView />
      </div>
    </div>
  );
}
