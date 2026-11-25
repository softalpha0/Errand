"use client";

import { useEffect, useState } from "react";
import { ReceiptView } from "@/components/receipt-view";
import { LinkButton, Skeleton } from "@/components/ui";
import { readReceiptLink, type SharedReceipt } from "@/lib/receipt-link";

export function SharedReceiptScreen() {
  const [state, setState] = useState<{ r: SharedReceipt | null; url: string } | undefined>(undefined);

  useEffect(() => {
    setState({ r: readReceiptLink(window.location.hash), url: window.location.href });
  }, []);

  if (state === undefined) return <Skeleton className="h-96 w-full rounded-[var(--radius-card)]" />;
  if (!state.r)
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-card p-6">
        <p className="font-semibold">This receipt link is incomplete.</p>
        <p className="mt-2 text-sm text-muted">Ask the sender to share it again from Errand, or look up the transactions on Celoscan.</p>
        <LinkButton href="/errand" variant="secondary" size="sm" className="mt-5">
          Send money with Errand
        </LinkButton>
      </div>
    );
  return <ReceiptView r={state.r} shareUrl={state.url} />;
}
