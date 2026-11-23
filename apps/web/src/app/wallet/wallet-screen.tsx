"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CNGN, USDT, formatUnitsExact } from "@errand/celo/tokens";
import { Button, Card, CardHeader, ErrorNote, Pill, Skeleton } from "@/components/ui";
import { addressUrl } from "@/lib/celo";
import {
  backupFile,
  createWallet,
  explainError,
  forgetWallet,
  loadWallet,
  parseBackup,
  passkeysSupported,
  readWalletState,
  recoverWallet,
  saveWallet,
  type StoredWallet,
  type WalletState,
} from "@/lib/wallet";

type Phase = "loading" | "unsupported" | "none" | "working" | "ready";

function amount(value: bigint, decimals: number, maxFraction: number) {
  const exact = formatUnitsExact(value, decimals);
  const [whole, fraction = ""] = exact.split(".");
  const wholeGrouped = BigInt(whole!).toLocaleString("en-US");
  const trimmed = fraction.slice(0, maxFraction).replace(/0+$/, "");
  return trimmed ? `${wholeGrouped}.${trimmed}` : wholeGrouped;
}

/** Rounds CELO up to 2 decimals so "at least" is never short. */
function celoAtLeast(wei: bigint) {
  const step = 10n ** 16n;
  const rounded = ((wei + step - 1n) / step) * step;
  return amount(rounded, 18, 2);
}

export function WalletScreen() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [wallet, setWallet] = useState<StoredWallet | null>(null);
  const [state, setState] = useState<WalletState | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string>("");
  const [notStored, setNotStored] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!passkeysSupported()) {
      setPhase("unsupported");
      return;
    }
    const stored = loadWallet();
    if (stored) {
      setWallet(stored);
      setPhase("ready");
    } else {
      setPhase("none");
    }
  }, []);

  const refresh = useCallback(async (address: StoredWallet["address"]) => {
    setRefreshing(true);
    setStateError(null);
    try {
      setState(await readWalletState(address));
    } catch (e) {
      setStateError(explainError(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (phase === "ready" && wallet) void refresh(wallet.address);
  }, [phase, wallet, refresh]);

  function adopt(next: StoredWallet) {
    setNotStored(!saveWallet(next));
    setWallet(next);
    setState(null);
    setPhase("ready");
  }

  async function run(label: string, action: () => Promise<StoredWallet>) {
    setError(null);
    setWorking(label);
    setPhase("working");
    try {
      adopt(await action());
    } catch (e) {
      setError(explainError(e));
      setPhase("none");
    } finally {
      setWorking("");
    }
  }

  async function onBackupChosen(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      adopt(parseBackup(await file.text()));
    } catch (e) {
      setError(explainError(e));
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function downloadBackup() {
    if (!wallet) return;
    const url = URL.createObjectURL(backupFile(wallet));
    const a = document.createElement("a");
    a.href = url;
    a.download = `errand-wallet-${wallet.address.slice(2, 8).toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyAddress() {
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  function forget() {
    if (!window.confirm("Remove this wallet from this browser? Your money stays in the wallet. You'll need your passkey or backup file to open it again.")) return;
    forgetWallet();
    setWallet(null);
    setState(null);
    setPhase("none");
  }

  if (phase === "loading") {
    return (
      <Card className="p-5" aria-busy="true">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-11 w-full" />
      </Card>
    );
  }

  if (phase === "unsupported") {
    return (
      <Card className="p-5">
        <h2 className="text-[15px] font-semibold">This browser can't create a passkey</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Open this page in a current version of Chrome, Safari, Edge or Firefox on your phone or computer, with a screen lock set up.
        </p>
      </Card>
    );
  }

  if (phase === "none" || phase === "working") {
    const busy = phase === "working";
    return (
      <div className="flex flex-col gap-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Card>
          <CardHeader title="Create your wallet" sub="Free. No transaction is sent." />
          <div className="px-5 py-5">
            <ul className="flex flex-col gap-2 text-sm leading-relaxed text-muted">
              <li>Your device asks you to save a passkey named “Errand”. That passkey is the only way to open the wallet.</li>
              <li>The wallet works on Celo mainnet. You fund it yourself; Errand never sends you money.</li>
            </ul>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={() => run("Waiting for your passkey…", createWallet)} disabled={busy}>
                {busy && working.startsWith("Waiting") ? working : "Create wallet with a passkey"}
              </Button>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Already have an Errand wallet?" />
          <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:flex-wrap sm:items-center">
            <Button variant="secondary" onClick={() => run("Looking for your wallet…", recoverWallet)} disabled={busy}>
              {busy && working.startsWith("Looking") ? working : "Find it with my passkey"}
            </Button>
            <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
              Restore from backup file
            </Button>
            <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onBackupChosen(e.target.files?.[0])} />
          </div>
          <p className="border-t border-line px-5 py-3 text-[13px] leading-snug text-muted">
            “Find it with my passkey” works once the wallet has made its first transaction. Before that, use the browser you created it in or its backup file.
          </p>
        </Card>
      </div>
    );
  }

  // phase === "ready"
  if (!wallet) return null;
  const funded = state ? state.celo >= state.setupCeloNeeded : false;

  return (
    <div className="flex flex-col gap-4">
      {notStored ? (
        <ErrorNote>This browser can't remember your wallet (private window or blocked storage). Download the backup file now, or you may lose access.</ErrorNote>
      ) : null}

      <Card>
        <CardHeader
          title="Wallet address"
          sub="Celo mainnet"
          aside={state ? state.registered ? <Pill tone="approve">Set up on Celo</Pill> : <Pill tone="ask">Not set up yet</Pill> : null}
        />
        <div className="px-5 py-5">
          <p className="num text-[15px] break-all sm:text-base">{wallet.address}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm" variant="secondary" onClick={copyAddress}>
              {copied ? "Copied" : "Copy address"}
            </Button>
            <a href={addressUrl(wallet.address)} className="text-sm underline decoration-line-strong underline-offset-4 hover:decoration-ink" rel="noreferrer">
              View on Celoscan
            </a>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Balance"
          sub="Read live from Celo"
          aside={
            <Button size="sm" variant="ghost" onClick={() => refresh(wallet.address)} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          }
        />
        {stateError ? (
          <div className="px-5 py-4">
            <ErrorNote>{stateError}</ErrorNote>
          </div>
        ) : !state ? (
          <div className="flex flex-col gap-3 px-5 py-5" aria-busy="true">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        ) : (
          <dl className="divide-y divide-line">
            <Row label="Naira (cNGN)" value={`₦${amount(state.cngn, CNGN.decimals, 2)}`} />
            <Row label="Dollars (USD₮)" value={`$${amount(state.usdt, USDT.decimals, 2)}`} />
            <Row label="CELO, for the setup fee" value={`${amount(state.celo, 18, 4)} CELO`} />
          </dl>
        )}
      </Card>

      {state && !state.registered ? (
        <Card>
          <CardHeader title="Fund your wallet" sub="From your own exchange or wallet. Use the Celo network only." />
          <ol className="flex flex-col gap-4 px-5 py-5 text-[15px] leading-relaxed">
            <li className="flex gap-3">
              <span className="num mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-sunken text-xs text-muted">1</span>
              <span>
                Send the <strong>USD₮</strong> you want Errand to spend to the address above, on the <strong>Celo</strong> network. A test errand needs as little as $1.
                Sending on any other network can lose the money.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="num mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-sunken text-xs text-muted">2</span>
              <span>
                Send at least <strong className="num">{celoAtLeast(state.setupCeloNeeded)} CELO</strong>. Altana charges a one-time setup fee of{" "}
                <span className="num">{celoAtLeast(state.setupFee)} CELO</span> (about $0.50, priced live) on your wallet's first transaction. The wallet sends 10%
                extra to cover price moves, and that extra comes straight back.
                {funded ? <Pill tone="approve">Enough CELO</Pill> : null}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="num mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-sunken text-xs text-muted">3</span>
              <span className="text-muted">Each later transaction also pays a small network fee, in CELO or USD₮. Tap Refresh after sending to see your balance.</span>
            </li>
          </ol>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Keep access" />
        <div className="px-5 py-5">
          <p className="text-sm leading-relaxed text-muted">
            {state?.registered
              ? "Your passkey can find this wallet on any device where it's saved. The backup file is a spare way back."
              : "Until your wallet's first transaction, only this browser and the backup file can reconnect your passkey to this wallet. The file holds public details only; it can't move money without your passkey."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm" variant="secondary" onClick={downloadBackup}>
              Download backup file
            </Button>
            <Button size="sm" variant="ghost" onClick={forget}>
              Remove from this browser
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">Next: give Errand a session</h2>
            <p className="mt-1 text-sm text-muted">Set a daily cap, the contracts it may call, and an expiry. Coming in the next update.</p>
          </div>
          <Pill>Step 2 of 3</Pill>
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="num text-[15px]">{value}</dd>
    </div>
  );
}
