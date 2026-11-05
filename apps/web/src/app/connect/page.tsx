import type { Metadata } from "next";
import { ConnectView } from "./connect-view";

export const metadata: Metadata = { title: "Connect your Kite Passport" };

export default function ConnectPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-12 pb-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Use your own Kite Passport</h1>
      <p className="mt-2 text-muted">
        Errands you start are then paid from your wallet. Every spending session is approved with your own passkey, and you can disconnect at any time.
      </p>
      <div className="mt-8">
        <ConnectView />
      </div>
    </div>
  );
}
