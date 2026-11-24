import type { Address } from "viem";
import type { Token } from "./tokens.js";

/**
 * Local stablecoins Errand can pay out in: the hackathon's Textile FX corridors from USD₮ (RULES.md).
 * Addresses and decimals: docs/celo/SPONSORS.md §1 (Loops page, Textile address book, x402 config).
 * Which ones are usable at a given moment depends on Textile's makers; the web app checks live.
 * Nigeria (cNGN) is the launch market and listed first.
 */
export type LocalCurrency = {
  code: "NGN" | "IDR" | "ARS" | "BRL" | "MXN" | "COP";
  /** What people see before an amount. */
  sign: string;
  name: string;
  country: string;
  token: Token;
  /** Where a recipient can turn it into bank money, if we know one from the sponsor docs. */
  offRamp?: { name: string; url: string };
};

export const LOCAL_CURRENCIES: readonly LocalCurrency[] = [
  {
    code: "NGN",
    sign: "₦",
    name: "Nigerian naira",
    country: "Nigeria",
    token: { symbol: "cNGN", name: "cNGN", address: "0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f", decimals: 6 },
    offRamp: { name: "cNGN", url: "https://cngn.co" },
  },
  {
    code: "IDR",
    sign: "Rp",
    name: "Indonesian rupiah",
    country: "Indonesia",
    token: { symbol: "IDRX", name: "IDRX", address: "0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22", decimals: 2 },
  },
  {
    code: "ARS",
    sign: "AR$",
    name: "Argentine peso",
    country: "Argentina",
    token: { symbol: "wARS", name: "Peso Argentino", address: "0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D", decimals: 18 },
    offRamp: { name: "Ripio", url: "https://ramp.ripio.com" },
  },
  {
    code: "BRL",
    sign: "R$",
    name: "Brazilian real",
    country: "Brazil",
    token: { symbol: "wBRL", name: "Real Brasileño", address: "0xD76f5Faf6888e24D9F04Bf92a0c8B921FE4390e0", decimals: 18 },
    offRamp: { name: "Ripio", url: "https://ramp.ripio.com" },
  },
  {
    code: "MXN",
    sign: "MX$",
    name: "Mexican peso",
    country: "Mexico",
    token: { symbol: "wMXN", name: "Peso Mexicano", address: "0x337E7456B420bD3481e7FA61fA9850343d610d34", decimals: 18 },
    offRamp: { name: "Ripio", url: "https://ramp.ripio.com" },
  },
  {
    code: "COP",
    sign: "COL$",
    name: "Colombian peso",
    country: "Colombia",
    token: { symbol: "wCOP", name: "Peso Colombiano", address: "0x8a1D45e102e886510e891d2Ec656a708991e2D76", decimals: 18 },
    offRamp: { name: "Ripio", url: "https://ramp.ripio.com" },
  },
];

export type CurrencyCode = LocalCurrency["code"];

export function currencyByCode(code: string): LocalCurrency | undefined {
  return LOCAL_CURRENCIES.find((c) => c.code === code);
}

export function currencyByToken(address: string): LocalCurrency | undefined {
  return LOCAL_CURRENCIES.find((c) => c.token.address.toLowerCase() === address.toLowerCase());
}

export const LOCAL_TOKEN_ADDRESSES: readonly Address[] = LOCAL_CURRENCIES.map((c) => c.token.address);

/** "12,500.5" in whole units → atomic units for a token with `decimals`, without floating point. */
export function toAtomic(input: string, decimals: number): bigint {
  const trimmed = input.trim().replace(/,/g, "");
  const pattern = decimals > 0 ? new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`) : /^\d+$/;
  if (!pattern.test(trimmed)) throw new Error(`"${input}" is not an amount with at most ${decimals} decimals.`);
  const [whole, fraction = ""] = trimmed.split(".");
  return BigInt(whole!) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
}

/** Errand's limits per errand while in testing, in USD₮ (what the sender pays). Textile's minimum is about $1. */
export const MIN_ERRAND_USDT = 1_100_000n; // $1.10
export const MAX_ERRAND_USDT = 35_000_000n; // $35
