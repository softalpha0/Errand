import type { Metadata } from "next";
import { WalletScreen } from "./wallet-screen";

export const metadata: Metadata = {
  title: "Your wallet",
  description: "Create your own non-custodial Altana wallet on Celo with a passkey. Errand never holds your keys or your money.",
};

export default function WalletPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 pb-6 sm:px-6 sm:pt-14">
      <p className="text-[13px] font-medium tracking-wide text-muted uppercase">Step 1 of 3 · Wallet</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Your wallet</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted">
        A wallet on Celo that only you control, opened with a passkey on this device (Face ID, fingerprint or your screen lock). Errand never sees a key and never
        holds your money.
      </p>
      <div className="mt-8">
        <WalletScreen />
      </div>
    </div>
  );
}
