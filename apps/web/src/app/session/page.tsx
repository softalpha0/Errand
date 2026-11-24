import type { Metadata } from "next";
import { PageHero } from "@/components/ui";
import { SessionScreen } from "./session-screen";

export const metadata: Metadata = {
  title: "Your session",
  description: "Give Errand a session on your own wallet: a daily cap, the only contracts it may call, and an expiry. Revoke it in one transaction.",
};

export default function SessionPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 pb-6 sm:px-6 sm:pt-16">
      <PageHero step={2} title="Set the rules.">
        You decide how much Errand may spend each day, the only contracts it may call, and when the session ends. Celo enforces these limits, not Errand. You can
        revoke the session in one transaction.
      </PageHero>
      <div className="relative mt-10">
        <SessionScreen />
      </div>
    </div>
  );
}
