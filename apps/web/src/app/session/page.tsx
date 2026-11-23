import type { Metadata } from "next";
import { SessionScreen } from "./session-screen";

export const metadata: Metadata = {
  title: "Your session",
  description: "Give Errand a session on your own wallet: a daily cap, the only contracts it may call, and an expiry. Revoke it in one transaction.",
};

export default function SessionPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 pb-6 sm:px-6 sm:pt-14">
      <p className="text-[13px] font-medium tracking-wide text-muted uppercase">Step 2 of 3 · Session</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Give Errand a session</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted">
        You decide how much Errand may spend each day, the only contracts it may call, and when the session ends. Celo enforces these limits, not Errand. You can
        revoke the session in one transaction.
      </p>
      <div className="mt-8">
        <SessionScreen />
      </div>
    </div>
  );
}
