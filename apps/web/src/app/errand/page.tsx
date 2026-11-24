import type { Metadata } from "next";
import { PageHero } from "@/components/ui";
import { ErrandScreen } from "./errand-screen";

export const metadata: Metadata = {
  title: "New errand",
  description: "Send an exact amount of local money (₦, Rp, AR$, R$) to someone, paid with USD₮ from your own wallet. Errand converts on Textile FX and checks every step.",
};

export default function ErrandPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 pb-6 sm:px-6 sm:pt-16">
      <PageHero step={3} title="Send local money.">
        Say how much they should receive and where. Errand converts your USD₮ to the local stablecoin on Textile FX, checks every step, pays them the exact amount,
        and gives you a receipt with a Celoscan link for each transaction.
      </PageHero>
      <div className="relative mt-10">
        <ErrandScreen />
      </div>
    </div>
  );
}
