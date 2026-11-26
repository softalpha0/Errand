import { describe, expect, it } from "vitest";
import type { Hex } from "viem";
import { tagCalldata } from "./attribution.js";
import { LOCAL_CURRENCIES, currencyByCode, toAtomic } from "./currencies.js";
import { TEXTILE_REACTOR } from "./session.js";
import { CNGN, USDT } from "./tokens.js";
import { encodeApprove } from "./textile.js";
import { buildPayout, checkErrandCost, checkErrandRequest, decodePayout, payoutInLogs, r14Corridor, r16Allowlist, r17Tagged } from "./rules.js";

const SOMEONE = "0x1111111111111111111111111111111111111111";
const WBRL = currencyByCode("BRL")!.token.address;

describe("currencies", () => {
  it("lists the six hackathon corridors with Nigeria first", () => {
    expect(LOCAL_CURRENCIES.map((c) => c.token.symbol)).toEqual(["cNGN", "IDRX", "wARS", "wBRL", "wMXN", "wCOP"]);
    expect(LOCAL_CURRENCIES[0]!.token.address).toBe(CNGN.address);
  });
  it("converts amounts with each token's own decimals", () => {
    expect(toAtomic("2000", 6)).toBe(2_000_000_000n);
    expect(toAtomic("91,659.19", 2)).toBe(9_165_919n);
    expect(toAtomic("29.53", 18)).toBe(29_530_000_000_000_000_000n);
    expect(() => toAtomic("1.234", 2)).toThrow();
  });
});

describe("R14 corridor", () => {
  it("allows USD₮ → every local currency on Celo", () => {
    for (const c of LOCAL_CURRENCIES) expect(r14Corridor(42220, USDT.address, c.token.address)).toEqual([]);
  });
  it("blocks other chains and pairs", () => {
    expect(r14Corridor(1, USDT.address, CNGN.address)).toHaveLength(1);
    expect(r14Corridor(42220, USDT.address, "0xcebA9300f2b948710d2653dD7B07f33A8B32118C")).toHaveLength(1);
  });
});

describe("R16 allowlist", () => {
  it("allows exactly the three errand calls for the chosen currency", () => {
    const calls = [{ to: USDT.address, data: encodeApprove(TEXTILE_REACTOR, 1n) }, { to: TEXTILE_REACTOR, data: "0x12345678" as Hex }, buildPayout(WBRL, SOMEONE, 1n)];
    expect(r16Allowlist(calls, WBRL)).toEqual([]);
  });
  it("blocks a payout in a different currency than the session's", () => {
    expect(r16Allowlist([buildPayout(CNGN.address, SOMEONE, 1n)], WBRL)).toHaveLength(1);
  });
  it("blocks other contracts and a transfer() on USD₮", () => {
    expect(r16Allowlist([{ to: SOMEONE, data: "0x" }], CNGN.address)).toHaveLength(1);
    expect(r16Allowlist([{ to: USDT.address, data: "0xa9059cbb" }], CNGN.address)).toHaveLength(1);
  });
});

describe("R17 tag", () => {
  it("passes tagged calldata and flags untagged", () => {
    expect(r17Tagged([{ to: CNGN.address, data: tagCalldata("0xa9059cbb") }])).toEqual([]);
    expect(r17Tagged([{ to: CNGN.address, data: "0xa9059cbb" }])).toHaveLength(1);
  });
});

describe("errand checks", () => {
  it("accepts a positive amount to a person in a supported currency", () => {
    expect(checkErrandRequest({ localToken: CNGN.address, amountAtomic: 5_000_000_000n, recipient: SOMEONE })).toEqual([]);
  });
  it("refuses unsupported currencies, zero, bad and self recipients", () => {
    expect(checkErrandRequest({ localToken: USDT.address, amountAtomic: 1n, recipient: SOMEONE })[0]!.rule).toBe("E0");
    expect(checkErrandRequest({ localToken: CNGN.address, amountAtomic: 0n, recipient: SOMEONE })[0]!.rule).toBe("E1");
    expect(checkErrandRequest({ localToken: CNGN.address, amountAtomic: 1n, recipient: "0x123" })[0]!.rule).toBe("E2");
    expect(checkErrandRequest({ localToken: CNGN.address, amountAtomic: 1n, recipient: WBRL })[0]!.rule).toBe("E2");
    expect(checkErrandRequest({ localToken: CNGN.address, amountAtomic: 1n, recipient: SOMEONE, payer: SOMEONE })[0]!.rule).toBe("E2");
  });
  it("keeps the cost between $1.10 and $35", () => {
    expect(checkErrandCost(1_000_000n)).toHaveLength(1);
    expect(checkErrandCost(5_000_000n)).toEqual([]);
    expect(checkErrandCost(36_000_000n)).toHaveLength(1);
  });
});

describe("payout", () => {
  it("is a tagged transfer of the exact amount in the chosen token", () => {
    const p = buildPayout(WBRL, SOMEONE, 29_530_000_000_000_000_000n);
    expect(p.to).toBe(WBRL);
    expect(r17Tagged([p])).toEqual([]);
    expect(decodePayout(p.data)).toEqual({ to: SOMEONE, amount: 29_530_000_000_000_000_000n });
  });
});

describe("payout in logs (works for direct and Altana relayed transactions)", () => {
  // Real log from the first errand's payout, 25 Nov 2026 (tx 0xbc98…e4e7): 2,000 cNGN to the recipient.
  const log = {
    address: CNGN.address,
    topics: [
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      "0x000000000000000000000000d80fc279ba93ec7a89c9daf8b1e430770b13d57c",
      "0x00000000000000000000000082ac58f4be1bb904bbe99eb6f97bf526a43806ed",
    ],
    data: "0x0000000000000000000000000000000000000000000000000000000077359400",
  };
  const recipient = "0x82ac58F4BE1BB904bbe99Eb6f97Bf526A43806ED";
  it("finds the exact payout", () => {
    expect(payoutInLogs([log], { token: CNGN.address, recipient, amount: 2_000_000_000n })).toBe(true);
    expect(payoutInLogs([log], { token: CNGN.address, recipient, amount: 2_000_000_000n, from: "0xd80fc279ba93ec7a89c9daf8b1e430770b13d57c" })).toBe(true);
  });
  it("refuses a different amount, token, recipient or sender", () => {
    expect(payoutInLogs([log], { token: CNGN.address, recipient, amount: 1_999_000_000n })).toBe(false);
    expect(payoutInLogs([log], { token: USDT.address, recipient, amount: 2_000_000_000n })).toBe(false);
    expect(payoutInLogs([log], { token: CNGN.address, recipient: SOMEONE, amount: 2_000_000_000n })).toBe(false);
    expect(payoutInLogs([log], { token: CNGN.address, recipient, amount: 2_000_000_000n, from: SOMEONE })).toBe(false);
  });
});
