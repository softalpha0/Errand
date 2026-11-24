import type { Metadata } from "next";
import { PageHero } from "@/components/ui";
import { WalletScreen } from "./wallet-screen";

export const metadata: Metadata = {
  title: "Your wallet",
  description: "Create your own non-custodial Altana wallet on Celo with a passkey. Errand never holds your keys or your money.",
};

export default function WalletPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 pb-6 sm:px-6 sm:pt-16">
      <PageHero step={1} title="Your wallet.">
        A wallet on Celo that only you control, opened with a passkey on this device (Face ID, fingerprint or your screen lock). Errand never sees a key and never
        holds your money.
      </PageHero>
      <div className="relative mt-10">
        <WalletScreen />
      </div>
    </div>
  );
}
