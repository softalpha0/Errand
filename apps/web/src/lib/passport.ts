"use client";

import { useEffect, useState } from "react";
import type { PassportPublic } from "@errand/core";

/**
 * The connection token for the person's own Kite Passport. It lives only in this
 * browser (localStorage) and is sent to the Errand agent as x-passport-token.
 * The agent stores only its hash. Storage can be unavailable (private windows),
 * so every read and write is wrapped and the site still works without it.
 */
const KEY = "errand.passport";

export function readPassportToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function savePassportToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(KEY, token);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the connection lasts until the page closes */
  }
  window.dispatchEvent(new Event("errand-passport"));
}

/** The connected Passport, or null. `loading` is true until the first check finishes. */
export function usePassport(): { passport: PassportPublic | null; loading: boolean; refresh: () => void } {
  const [passport, setPassport] = useState<PassportPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener("errand-passport", on);
    return () => window.removeEventListener("errand-passport", on);
  }, []);

  useEffect(() => {
    let live = true;
    if (!readPassportToken()) {
      setPassport(null);
      setLoading(false);
      return;
    }
    // Imported here to avoid a cycle with api.ts, which reads the token from this file.
    void import("./api").then(({ api, ApiError }) =>
      api
        .passportMe()
        .then((p) => live && setPassport(p))
        .catch((err) => {
          // The agent no longer knows this connection (logged out, or made in demo mode): forget it here too.
          if (err instanceof ApiError && err.status === 404) savePassportToken(null);
          if (live) setPassport(null);
        })
        .finally(() => live && setLoading(false)),
    );
    return () => {
      live = false;
    };
  }, [tick]);

  return { passport, loading, refresh: () => setTick((t) => t + 1) };
}
