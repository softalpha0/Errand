/**
 * Runs one errand from the user's own connected wallet (any EIP-1193 browser wallet on Celo):
 *   check (E1/E2, R14) → Textile firm quote for the EXACT Naira amount (user's wallet signs the proof
 *   when keyless) → R15 → approve takerPays to Textile's reactor → wait → recheck expiry → swap →
 *   /submit → wait for "filled" → pay the cNGN to the recipient → verify Errand's tag on every tx.
 * Every transaction Errand builds ends with Errand's attribution tag (R17) and goes only to an
 * allowed contract and function (R16). The user approves each one in their wallet.
 *
 * Inside MiniPay (window.ethereum.isMiniPay): no connect button, no message signing (needs the
 * server's Textile API key), legacy transactions with the network fee paid in USD₮ (feeCurrency =
 * USD₮ adapter), and a pre-flight check that USD₮ covers the conversion plus the network fees.
 *
 * When Altana answers on tagging (AGENTS.md Q2), the same steps run from the user's Altana wallet
 * under their session, without a prompt per transaction.
 */
import { createWalletClient, custom, formatEther, type Address, type EIP1193Provider, type Hex, type WalletClient } from "viem";
import { celo } from "viem/chains";
import { assertTagged, tagCalldata } from "@errand/celo/attribution";
import { USDT, USDT_FEE_CURRENCY, erc20Abi, formatUnitsExact } from "@errand/celo/tokens";
import { currencyByCode, type LocalCurrency } from "@errand/celo/currencies";
import { TEXTILE_REACTOR } from "@errand/celo/session";
import { encodeApprove, isTerminal, randomNonce, takerControlTypedData, validateFirmQuote, type FirmQuote, type NoQuote, type RfqStatus } from "@errand/celo/textile";
import { buildPayout, checkErrandCost, checkErrandRequest, r16Allowlist, r17Tagged, type RuleFinding } from "@errand/celo/rules";
import { publicClient } from "@/lib/wallet";

declare global {
  interface Window {
    ethereum?: EIP1193Provider & { isMiniPay?: boolean; isMetaMask?: boolean };
  }
}

const CELO_HEX = "0xa4ec"; // 42220
const MIN_GAS_CELO = 2n * 10n ** 16n; // 0.02 CELO: approve + swap + payout with room to spare
const SLIPPAGE_BPS = 200n; // the firm quote may cost at most 2% more than the preview

export type ConnectedWallet = { address: Address; client: WalletClient; isMiniPay: boolean };

/** MiniPay's Add Cash screen (docs.minipay.xyz deeplinks), for a low USD₮ balance. */
export const MINIPAY_DEPOSIT_URL = "https://link.minipay.xyz/add_cash?tokens=USDT";

/** Thrown when the wallet can't cover the errand; the screen offers a Deposit link in MiniPay. */
export class LowBalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LowBalanceError";
  }
}

export function hasBrowserWallet(): boolean {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

export function inMiniPay(): boolean {
  return typeof window !== "undefined" && window.ethereum?.isMiniPay === true;
}

/**
 * Network fees for a whole errand, paid in USD₮ (MiniPay): up to 4 transactions (reset, approve,
 * swap, payment) at a generous 400k gas each, priced with eth_gasPrice for the USD₮ adapter.
 * The adapter is 18-decimal, so divide by 1e12 for USD₮ atomic. Measured ≈ $0.002 per tx on 25 Nov.
 */
export async function networkFeeReserveUsdt(): Promise<bigint> {
  const hex = (await (publicClient.request as (a: { method: string; params: unknown[] }) => Promise<string>)({ method: "eth_gasPrice", params: [USDT_FEE_CURRENCY] })) as Hex;
  const fee = (BigInt(hex) * 4n * 400_000n) / 10n ** 12n;
  return fee < 10_000n ? 10_000n : fee; // never reserve less than $0.01
}

export async function connectWallet(): Promise<ConnectedWallet> {
  const eth = window.ethereum;
  if (!eth) throw new Error("No browser wallet found. Open this page in a browser with a Celo wallet (for example MetaMask).");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as Address[];
  if (!accounts[0]) throw new Error("The wallet didn't share an address.");
  if (eth.isMiniPay) {
    // MiniPay is always on Celo; no chain switching, no prompts.
    return { address: accounts[0], client: createWalletClient({ account: accounts[0], chain: celo, transport: custom(eth) }), isMiniPay: true };
  }
  const chainId = (await eth.request({ method: "eth_chainId" })) as string;
  if (chainId.toLowerCase() !== CELO_HEX) {
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CELO_HEX }] });
    } catch (e) {
      if ((e as { code?: number }).code !== 4902) throw new Error("Please switch your wallet to Celo.");
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: CELO_HEX, chainName: "Celo", nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 }, rpcUrls: ["https://forno.celo.org"], blockExplorerUrls: ["https://celoscan.io"] }],
      });
    }
  }
  return { address: accounts[0], client: createWalletClient({ account: accounts[0], chain: celo, transport: custom(eth) }), isMiniPay: Boolean(eth.isMiniPay) };
}

export async function readBalances(address: Address) {
  const [usdt, celoBal] = await Promise.all([
    publicClient.readContract({ address: USDT.address, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
    publicClient.getBalance({ address }),
  ]);
  return { usdt, celo: celoBal };
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string; reason?: string; details?: Record<string, unknown> } & T;
  if (!res.ok) {
    const reason = json.reason ? ` (${json.reason})` : "";
    throw new Error(`${json.error ?? `Request failed (${res.status})`}${reason}`);
  }
  return (json.data ?? json) as T;
}

export type Preview = { status: string; takerPays?: string; buyAmount?: string; feeAmount?: string; reason?: string };

export function previewCost(currency: LocalCurrency, amountAtomic: bigint): Promise<Preview> {
  return api<Preview>("/api/textile/preview", { currency: currency.code, buyAmount: amountAtomic.toString() });
}

export type Availability = { code: string; available: boolean; reason?: string; perUsdt?: number; depthUsd?: number };

export function currencyAvailability(): Promise<Availability[]> {
  return api<Availability[]>("/api/textile/currencies");
}

export type StepId = "check" | "quote" | "approve" | "swap" | "settle" | "pay" | "verify" | "tool";
export type StepState = "waiting" | "running" | "done" | "failed" | "skipped";
export type StepUpdate = { id: StepId; state: StepState; detail?: string; tx?: Hex };

export type ErrandInput = { currency: LocalCurrency; amountAtomic: bigint; recipient: Address; label: string };

export type Receipt = {
  id: string;
  createdAt: string;
  label: string;
  recipient: Address;
  /** Local currency code (older receipts without it were Naira). */
  currency?: string;
  amountAtomic?: string;
  /** Older receipts only. */
  nairaAtomic?: string;
  taker: Address;
  rfqId?: string;
  paidUsdt?: string;
  feeUsdt?: string;
  txs: { reset?: Hex; approve?: Hex; swap?: Hex; payout?: Hex };
  tagged: Record<string, boolean>;
  /** Errand's paid tool call on buy: Chainstack reads every tx back (see /api/receipt/verify). */
  buyCheck?: BuyCheck;
  status: "done" | "failed";
  failure?: string;
};

export type BuyCheck =
  | { status: "checked"; ok: boolean; checked: number; results: { hash: Hex; success: boolean; tagged: boolean }[]; paymentTx?: Hex; provider: string; at: string }
  | { status: "skipped"; reason: string };

const usdtShort = (atomic: bigint) => Number(formatUnitsExact(atomic, 6)).toFixed(2);

const RECEIPTS_KEY = "errand.celo.receipts.v1";

export function loadReceipts(): Receipt[] {
  try {
    return JSON.parse(window.localStorage.getItem(RECEIPTS_KEY) ?? "[]") as Receipt[];
  } catch {
    return [];
  }
}

function saveReceipt(r: Receipt) {
  try {
    const all = loadReceipts().filter((x) => x.id !== r.id);
    window.localStorage.setItem(RECEIPTS_KEY, JSON.stringify([r, ...all].slice(0, 50)));
  } catch {
    // not remembered in this browser; the receipt is still shown and every tx is on Celoscan
  }
}

function explain(findings: RuleFinding[]) {
  return findings.map((f) => `${f.rule}: ${f.reason}`).join(" ");
}

async function firmQuote(wallet: ConnectedWallet, currency: LocalCurrency, amountAtomic: bigint, keyed: boolean): Promise<FirmQuote> {
  let takerProof: { nonce: Hex; issuedAt: number; signature: Hex } | undefined;
  if (!keyed) {
    const nonce = randomNonce();
    const issuedAt = Date.now();
    const td = takerControlTypedData({ taker: wallet.address, chainId: 42220, nonce, issuedAtMs: issuedAt });
    const signature = await wallet.client.signTypedData({ account: wallet.address, ...td });
    takerProof = { nonce, issuedAt, signature };
  }
  const res = await api<FirmQuote | NoQuote>("/api/textile/quote", { currency: currency.code, buyAmount: amountAtomic.toString(), taker: wallet.address, ...(takerProof ? { takerProof } : {}) });
  if (res.status !== "quoted") throw new Error(`Textile has no quote right now (${(res as NoQuote).reason}). Try again in a minute.`);
  return res as FirmQuote;
}

async function send(wallet: ConnectedWallet, to: Address, data: Hex): Promise<Hex> {
  if (wallet.isMiniPay) {
    // MiniPay: legacy transaction (no EIP-1559 fields), network fee in USD₮ via the adapter (CIP-64).
    // Call request() ON the provider: MiniPay's request uses `this` (a detached call throws "reading '_request'").
    const eth = window.ethereum as unknown as { request(a: { method: string; params: unknown[] }): Promise<unknown> };
    return (await eth.request({ method: "eth_sendTransaction", params: [{ from: wallet.address, to, data, value: "0x0", feeCurrency: USDT_FEE_CURRENCY }] })) as Hex;
  }
  return wallet.client.sendTransaction({ account: wallet.address, chain: celo, to, data, value: 0n });
}

async function confirm(hash: Hex, what: string) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (receipt.status !== "success") throw new Error(`${what} failed on Celo: https://celoscan.io/tx/${hash}`);
}

/** Runs the whole errand. Throws on any refusal or failure; onStep reports progress for the screen. */
export async function runErrand(input: ErrandInput, wallet: ConnectedWallet, onStep: (u: StepUpdate) => void): Promise<Receipt> {
  const receipt: Receipt = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    label: input.label,
    recipient: input.recipient,
    currency: input.currency.code,
    amountAtomic: input.amountAtomic.toString(),
    taker: wallet.address,
    txs: {},
    tagged: {},
    status: "failed",
  };
  let current: StepId = "check";
  const step = (id: StepId, state: StepState, extra: Omit<StepUpdate, "id" | "state"> = {}) => {
    current = id;
    onStep({ id, state, ...extra });
  };

  try {
    // 1. Checks before anything is signed
    step("check", "running");
    const token = input.currency.token;
    const findings = checkErrandRequest({ localToken: token.address, amountAtomic: input.amountAtomic, recipient: input.recipient, payer: wallet.address });
    if (findings.length) throw new Error(explain(findings));
    const preview = await previewCost(input.currency, input.amountAtomic);
    if (preview.status !== "preview" || !preview.takerPays) throw new Error(`Textile can't price this right now (${preview.reason ?? preview.status}).`);
    const cost = checkErrandCost(BigInt(preview.takerPays));
    if (cost.length) throw new Error(explain(cost));
    const maxTakerPays = (BigInt(preview.takerPays) * (10_000n + SLIPPAGE_BPS)) / 10_000n;
    const bal = await readBalances(wallet.address);
    if (wallet.isMiniPay) {
      // Network fees come out of USD₮ too, so the balance must cover both.
      const fees = await networkFeeReserveUsdt();
      if (bal.usdt < maxTakerPays + fees)
        throw new LowBalanceError(`You need about ${usdtShort(maxTakerPays + fees)} USD₮ (the conversion plus about ${usdtShort(fees)} in network fees). You have ${usdtShort(bal.usdt)}.`);
    } else {
      if (bal.usdt < maxTakerPays) throw new LowBalanceError(`Your wallet needs about ${usdtShort(maxTakerPays)} USD₮ (it has ${usdtShort(bal.usdt)}).`);
      if (bal.celo < MIN_GAS_CELO) throw new LowBalanceError(`Your wallet needs a little CELO for network fees (about 0.02; it has ${formatEther(bal.celo)}).`);
    }
    step("check", "done", { detail: `Costs about ${formatUnitsExact(BigInt(preview.takerPays), 6)} USD₮. Checks passed.` });

    const { keyed } = await api<{ keyed: boolean }>("/api/textile/config");
    if (wallet.isMiniPay && !keyed) throw new Error("MiniPay can't sign Textile's request, and Errand's Textile key isn't set up on this site yet.");

    for (let attempt = 1; attempt <= 2; attempt++) {
      // 2. Firm quote + R15
      step("quote", "running", { detail: keyed ? "Asking Textile for a firm quote…" : "Sign the Textile request in your wallet (it moves no money)…" });
      const quote = await firmQuote(wallet, input.currency, input.amountAtomic, keyed);
      const r15 = validateFirmQuote(quote, { taker: wallet.address, sellToken: USDT.address, maxTakerPays, chainId: 42220, nowMs: Date.now() });
      if (BigInt(quote.quote.buyAmount) < input.amountAtomic) r15.push(`Quote delivers less ${token.symbol} than asked.`);
      if (r15.length) throw new Error(`R15 refused the quote: ${r15.join(" ")}`);
      receipt.rfqId = quote.rfqId;
      receipt.paidUsdt = quote.quote.takerPays;
      receipt.feeUsdt = quote.quote.feeAmount;
      step("quote", "done", { detail: `Firm quote: ${formatUnitsExact(BigInt(quote.quote.takerPays), 6)} USD₮ → ${formatLocal(input.currency, quote.quote.buyAmount)}.` });

      // Build every call first, then R16 + R17 on all of them
      const takerPays = BigInt(quote.quote.takerPays);
      const approveCall = { to: quote.transactions.approval.to, data: tagCalldata(quote.transactions.approval.data) };
      const swapCall = { to: quote.transactions.swap.to, data: tagCalldata(quote.transactions.swap.data) };
      const payout = buildPayout(token.address, input.recipient, input.amountAtomic);
      const policy = [...r16Allowlist([approveCall, swapCall, payout], token.address), ...r17Tagged([approveCall, swapCall, payout])];
      if (policy.length) throw new Error(explain(policy));

      // 3. Approve (reset first if an old allowance exists)
      step("approve", "running", { detail: "Confirm the USD₮ approval in your wallet…" });
      const allowance = await publicClient.readContract({
        address: USDT.address,
        abi: [{ type: "function", name: "allowance", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] }] as const,
        functionName: "allowance",
        args: [wallet.address, TEXTILE_REACTOR],
      });
      if (allowance < takerPays) {
        if (allowance > 0n) {
          receipt.txs.reset = await send(wallet, USDT.address, tagCalldata(encodeApprove(TEXTILE_REACTOR, 0n)));
          await confirm(receipt.txs.reset, "Allowance reset");
        }
        receipt.txs.approve = await send(wallet, approveCall.to, approveCall.data);
        await confirm(receipt.txs.approve, "Approval");
        step("approve", "done", { tx: receipt.txs.approve });
      } else {
        step("approve", "skipped", { detail: "Your earlier approval already covers it." });
      }

      // 4. Swap, only if the quote is still live
      if (Date.parse(quote.quote.expiresAt) <= Date.now()) {
        step("quote", "running", { detail: "The quote expired while approving. Getting a fresh one…" });
        if (attempt === 2) throw new Error("The quote expired twice. Please try again.");
        continue;
      }
      step("swap", "running", { detail: "Confirm the conversion in your wallet…" });
      receipt.txs.swap = await send(wallet, swapCall.to, swapCall.data);
      await confirm(receipt.txs.swap, "Conversion");
      step("swap", "done", { tx: receipt.txs.swap });

      // 5. Textile settlement
      step("settle", "running", { detail: "Waiting for Textile to confirm the fill…" });
      await api("/api/textile/submit", { rfqId: quote.rfqId, claimToken: quote.claimToken, txHash: receipt.txs.swap }).catch(() => undefined);
      let status = await api<RfqStatus>("/api/textile/status", { rfqId: quote.rfqId, claimToken: quote.claimToken });
      for (let i = 0; i < 30 && !isTerminal(status.status); i++) {
        await new Promise((r) => setTimeout(r, 3000));
        status = await api<RfqStatus>("/api/textile/status", { rfqId: quote.rfqId, claimToken: quote.claimToken });
      }
      if (status.status !== "filled") throw new Error(`Textile reports "${status.status}". Your USD₮ is safe unless the swap above shows success on Celoscan.`);
      step("settle", "done", { detail: "Textile confirmed the conversion." });

      // 6. Pay the recipient the exact Naira
      step("pay", "running", { detail: `Confirm the ${token.symbol} payment in your wallet…` });
      receipt.txs.payout = await send(wallet, payout.to, payout.data);
      await confirm(receipt.txs.payout, "Payment");
      step("pay", "done", { tx: receipt.txs.payout });
      break;
    }

    // 7. Verify the tag on every tx, read back from Celo
    step("verify", "running");
    for (const [name, hash] of Object.entries(receipt.txs)) {
      if (!hash) continue;
      try {
        await assertTagged(publicClient as never, hash);
        receipt.tagged[name] = true;
      } catch {
        receipt.tagged[name] = false;
      }
    }
    step("verify", "done", { detail: Object.values(receipt.tagged).every(Boolean) ? "Every transaction carries Errand's tag." : "A transaction is missing the tag. See the receipt." });
    receipt.status = "done";
    saveReceipt(receipt);

    // 8. Independent check: Errand pays $0.01 on buy for a Chainstack Celo node to read the same txs back.
    step("tool", "running", { detail: "Errand is paying $0.01 on buy for an independent Celo node to check your receipt…" });
    try {
      receipt.buyCheck = await api<BuyCheck>("/api/receipt/verify", { txs: Object.values(receipt.txs).filter(Boolean) });
      const b = receipt.buyCheck;
      if (b.status === "checked") step("tool", b.ok ? "done" : "failed", { detail: b.ok ? `Chainstack confirmed all ${b.checked} transactions succeeded and carry the tag.` : "The independent node disagreed. See the receipt.", ...(b.paymentTx ? { tx: b.paymentTx } : {}) });
      else step("tool", "skipped", { detail: b.reason });
    } catch (e) {
      receipt.buyCheck = { status: "skipped", reason: e instanceof Error ? e.message : String(e) };
      step("tool", "skipped", { detail: "The independent check isn't available right now. Your receipt is still valid on Celoscan." });
    }
    saveReceipt(receipt);
    return receipt;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const declined = (e as { code?: number })?.code === 4001 || /User rejected|denied|rejected the request/i.test(message);
    receipt.failure = declined ? "You declined in your wallet. Nothing more was sent." : message;
    step(current, "failed", { detail: receipt.failure });
    saveReceipt(receipt);
    if (e instanceof LowBalanceError) throw e;
    throw new Error(receipt.failure);
  }
}

/** "₦2,000", "Rp91,659.19", "R$29.53": the local amount with its sign and up to 2 decimals. */
export function formatLocal(currency: LocalCurrency, atomic: string | bigint): string {
  const [w, f = ""] = formatUnitsExact(BigInt(atomic), currency.token.decimals).split(".");
  const frac = f.slice(0, 2).replace(/0+$/, "");
  return `${currency.sign}${BigInt(w!).toLocaleString("en-US")}${frac ? `.${frac.padEnd(2, "0")}` : ""}`;
}

/** The currency of a stored receipt (older receipts were Naira). */
export function receiptCurrency(r: Receipt): { currency: LocalCurrency; amount: string } {
  const currency = currencyByCode(r.currency ?? "NGN") ?? currencyByCode("NGN")!;
  return { currency, amount: r.amountAtomic ?? r.nairaAtomic ?? "0" };
}
