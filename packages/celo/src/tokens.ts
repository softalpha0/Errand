import type { Address, PublicClient } from "viem";

/**
 * Celo mainnet tokens Errand uses. Addresses and decimals from docs/celo/SPONSORS.md §1
 * (Loops page, Textile address book, x402 config; read 20–23 Nov 2026).
 *
 * Trap: USD₮ also has an 18-decimal fee-currency adapter (0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72)
 * with the same name and symbol. Never pay or approve with it. `assertTokenDecimals` catches a mix-up.
 */
export type Token = {
  readonly symbol: string;
  readonly name: string;
  readonly address: Address;
  readonly decimals: number;
};

export const CELO_CHAIN_ID = 42220;

export const USDT: Token = {
  symbol: "USD₮",
  name: "Tether USD",
  address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
  decimals: 6,
};

export const CNGN: Token = {
  symbol: "cNGN",
  name: "cNGN",
  address: "0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f",
  decimals: 6,
};

/** CELO is the native gas token; this is its ERC-20 interface (balances match the native balance). */
export const CELO_TOKEN: Token = {
  symbol: "CELO",
  name: "Celo",
  address: "0x471EcE3750Da237f93B8E339c536989b8978a438",
  decimals: 18,
};

/** Addresses Errand must never pay or approve with (18-decimal fee-currency adapters). */
export const FORBIDDEN_ADAPTERS: readonly Address[] = [
  "0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72", // USD₮ adapter
  "0x0357EE22278c922e1D36cFe6b899269b161880C4", // USA₮ adapter
];

/**
 * The USD₮ fee-currency adapter, for the `feeCurrency` field ONLY (pay the network fee in USD₮, CIP-64).
 * Never a payment or approval token (see FORBIDDEN_ADAPTERS). It normalises USD₮ to 18 decimals, so
 * gas × eth_gasPrice(adapter) is in 18-decimal units: divide by 1e12 for USD₮ atomic (6 decimals).
 * Source: Celopedia builder-guide "Allowed Fee Currencies (Mainnet)"; checked on forno 25 Nov 2026.
 */
export const USDT_FEE_CURRENCY: Address = FORBIDDEN_ADAPTERS[0]!;

export const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

/** Formats atomic units as a decimal string without floating-point rounding. */
export function formatUnitsExact(value: bigint, decimals: number): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = (abs % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

/** Throws if a token's on-chain decimals don't match the table (e.g. an adapter address slipped in). */
export async function assertTokenDecimals(client: PublicClient, tokens: readonly Token[] = [USDT, CNGN]): Promise<void> {
  for (const token of tokens) {
    if (FORBIDDEN_ADAPTERS.some((a) => a.toLowerCase() === token.address.toLowerCase())) {
      throw new Error(`${token.symbol} points at a fee-currency adapter (${token.address}). Use the token address.`);
    }
    const onChain = await client.readContract({ address: token.address, abi: erc20Abi, functionName: "decimals" });
    if (Number(onChain) !== token.decimals) {
      throw new Error(`${token.symbol} at ${token.address} has ${onChain} decimals on chain, expected ${token.decimals}.`);
    }
  }
}
