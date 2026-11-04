"use client";

import { Button } from "@/components/ui";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">This page didn't load.</h1>
      <p className="mt-2 text-muted">Nothing was paid because of this. Try again, or go back to the home page.</p>
      <Button className="mt-8" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
