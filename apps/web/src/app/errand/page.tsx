import type { Metadata } from "next";
import { ErrandScreen } from "./errand-screen";

export const metadata: Metadata = {
  title: "New errand",
  description: "Send an exact amount of local money (₦, Rp, AR$, R$) to someone, paid with USD₮ from your own wallet. Errand converts on Textile FX and checks every step.",
};

export default function ErrandPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 pb-6 sm:px-6 sm:pt-14">
      <p className="text-[13px] font-medium tracking-wide text-muted uppercase">Step 3 of 3 · Errand</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Send local money to someone</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted">
        Say how much they should receive and where. Errand converts your USD₮ to the local stablecoin (cNGN, IDRX, wARS, wBRL…) on Textile FX, checks every step, pays them the exact amount, and gives you
        a receipt with a Celoscan link for each transaction.
      </p>
      <div className="mt-8">
        <ErrandScreen />
      </div>
    </div>
  );
}
