import type { Metadata } from "next";
import { PageHero } from "@/components/ui";
import { SharedReceiptScreen } from "./shared-receipt";

export const metadata: Metadata = {
  title: "Receipt",
  description: "An Errand receipt. Every line is checked again on Celo when you open it.",
};

export default function ReceiptPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 pb-6 sm:px-6 sm:pt-16">
      <PageHero title="Receipt.">Every line below is read back from Celo as you open this page, so you don&apos;t have to take anyone&apos;s word for it.</PageHero>
      <div className="relative mt-10">
        <SharedReceiptScreen />
      </div>
    </div>
  );
}
