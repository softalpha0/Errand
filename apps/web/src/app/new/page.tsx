import type { Metadata } from "next";
import { EXAMPLES } from "@/lib/examples";
import { Composer } from "./composer";

export const metadata: Metadata = { title: "Start an errand" };

export default async function NewErrand({ searchParams }: { searchParams: Promise<{ example?: string }> }) {
  const { example } = await searchParams;
  const n = example !== undefined ? Number(example) : NaN;
  const initial = Number.isInteger(n) && n >= 0 && n < EXAMPLES.length ? n : null;
  return (
    <div className="mx-auto max-w-2xl px-4 pt-12 pb-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Start an errand</h1>
      <p className="mt-2 text-muted">You'll see the plan and every price before anything is paid.</p>
      <div className="mt-8">
        <Composer initial={initial} />
      </div>
    </div>
  );
}
