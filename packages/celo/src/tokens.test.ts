import { describe, expect, it } from "vitest";
import type { PublicClient } from "viem";
import { CNGN, FORBIDDEN_ADAPTERS, USDT, assertTokenDecimals, formatUnitsExact } from "./tokens.js";

function fakeClient(decimalsByAddress: Record<string, number>): PublicClient {
  return {
    readContract: async ({ address }: { address: string }) => BigInt(decimalsByAddress[address.toLowerCase()] ?? 0),
  } as unknown as PublicClient;
}

describe("token table", () => {
  it("uses the 6-decimal USD₮ and cNGN from SPONSORS.md", () => {
    expect(USDT.address).toBe("0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e");
    expect(USDT.decimals).toBe(6);
    expect(CNGN.address).toBe("0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f");
    expect(CNGN.decimals).toBe(6);
  });

  it("never lists an adapter as a token", () => {
    for (const t of [USDT, CNGN]) {
      expect(FORBIDDEN_ADAPTERS.map((a) => a.toLowerCase())).not.toContain(t.address.toLowerCase());
    }
  });
});

describe("assertTokenDecimals", () => {
  it("passes when the chain agrees", async () => {
    const client = fakeClient({ [USDT.address.toLowerCase()]: 6, [CNGN.address.toLowerCase()]: 6 });
    await expect(assertTokenDecimals(client)).resolves.toBeUndefined();
  });

  it("fails when an address has 18 decimals (adapter mix-up)", async () => {
    const client = fakeClient({ [USDT.address.toLowerCase()]: 18, [CNGN.address.toLowerCase()]: 6 });
    await expect(assertTokenDecimals(client)).rejects.toThrow(/18 decimals/);
  });

  it("refuses a forbidden adapter address outright", async () => {
    const adapter = { ...USDT, address: FORBIDDEN_ADAPTERS[0]! };
    await expect(assertTokenDecimals(fakeClient({}), [adapter])).rejects.toThrow(/adapter/);
  });
});

describe("formatUnitsExact", () => {
  it("formats atomic units without rounding", () => {
    expect(formatUnitsExact(1_447_577_142n, 6)).toBe("1447.577142");
    expect(formatUnitsExact(1_000_000n, 6)).toBe("1");
    expect(formatUnitsExact(0n, 18)).toBe("0");
    expect(formatUnitsExact(10_015_155_661_922_578_476n, 18)).toBe("10.015155661922578476");
  });
});
