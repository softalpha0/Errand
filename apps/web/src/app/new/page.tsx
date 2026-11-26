import type { Metadata } from "next";
import { EXAMPLES } from "@/lib/examples";
import { PageHero } from "@/components/ui";
import { Composer } from "./composer";

export const metadata: Metadata = { title: "Buy for me", description: "Ask Errand to buy airtime, data, eSIMs or gift cards for you. Every payment is planned, priced and checked before it is paid." };

export default async function NewErrand({ searchParams }: { searchParams: Promise<{ example?: string }> }) {
  const { example } = await searchParams;
  const n = example !== undefined ? Number(example) : NaN;
  const initial = Number.isInteger(n) && n >= 0 && n < EXAMPLES.length ? n : null;
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 pb-10 sm:px-6 sm:pt-16">
      <PageHero title="Buy for me.">
        Ask Errand to buy something for you: mobile airtime and data, eSIMs, gift cards, or research before a purchase. You'll see the plan and every price before
        anything is paid, and every payment is checked first.
      </PageHero>
      <div className="relative mt-6 rounded-2xl border border-line bg-card px-4 py-3 text-sm leading-relaxed text-muted">
        This errand type is Errand&apos;s first version, built for SERV Hackathon 02. It pays sellers through your own <span className="text-ink">Kite Agent Passport</span>{" "}
        in USDC on Base, and SERV Reasoning checks each payment. Airtime and data have run on mainnet; eSIMs, gift cards and Amazon shopping are built and tested
        but haven&apos;t made a mainnet payment yet. To pay people in local money on Celo, use{" "}
        <a href="/errand" className="text-accent underline decoration-accent/30 underline-offset-4">
          Pay someone
        </a>
        .
      </div>
      <div className="relative mt-8">
        <Composer initial={initial} />
      </div>
    </div>
  );
}
