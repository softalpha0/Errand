import { describe, expect, it } from "vitest";
import type { Hex } from "viem";
import { tagCalldata } from "./attribution.js";
import { TEXTILE_REACTOR } from "./session.js";
import { CNGN, USDT } from "./tokens.js";
import { encodeApprove } from "./textile.js";
import { buildPayout, checkErrandRequest, decodePayout, r14Corridor, r16Allowlist, r17Tagged } from "./rules.js";

const SOMEONE = "0x1111111111111111111111111111111111111111";

describe("R14 corridor", () => {
  it("allows USD₮ → cNGN on Celo", () => expect(r14Corridor(42220, USDT.address, CNGN.address)).toEqual([]));
  it("blocks other chains and pairs", () => {
    expect(r14Corridor(1, USDT.address, CNGN.address)).toHaveLength(1);
    expect(r14Corridor(42220, USDT.address, "0xcebA9300f2b948710d2653dD7B07f33A8B32118C")).toHaveLength(1);
  });
});

describe("R16 allowlist", () => {
  it("allows exactly the three errand calls", () => {
    const calls = [
      { to: USDT.address, data: encodeApprove(TEXTILE_REACTOR, 1n) },
      { to: TEXTILE_REACTOR, data: "0x12345678" as Hex },
      buildPayout(SOMEONE, 1n),
    ];
    expect(r16Allowlist(calls)).toEqual([]);
  });
  it("blocks other contracts and a transfer() on USD₮", () => {
    expect(r16Allowlist([{ to: SOMEONE, data: "0x" }])).toHaveLength(1);
    expect(r16Allowlist([{ to: USDT.address, data: "0xa9059cbb" }])).toHaveLength(1);
  });
});

describe("R17 tag", () => {
  it("passes tagged calldata and flags untagged", () => {
    expect(r17Tagged([{ to: CNGN.address, data: tagCalldata("0xa9059cbb") }])).toEqual([]);
    expect(r17Tagged([{ to: CNGN.address, data: "0xa9059cbb" }])).toHaveLength(1);
  });
});

describe("errand request checks", () => {
  it("accepts ₦5,000 to a person", () => expect(checkErrandRequest({ nairaAtomic: 5_000_000_000n, recipient: SOMEONE })).toEqual([]));
  it("refuses too small, too large, bad and self recipients", () => {
    expect(checkErrandRequest({ nairaAtomic: 1_000_000_000n, recipient: SOMEONE })[0]!.rule).toBe("E1");
    expect(checkErrandRequest({ nairaAtomic: 60_000_000_000n, recipient: SOMEONE })[0]!.rule).toBe("E1");
    expect(checkErrandRequest({ nairaAtomic: 5_000_000_000n, recipient: "0x123" })[0]!.rule).toBe("E2");
    expect(checkErrandRequest({ nairaAtomic: 5_000_000_000n, recipient: CNGN.address })[0]!.rule).toBe("E2");
    expect(checkErrandRequest({ nairaAtomic: 5_000_000_000n, recipient: SOMEONE, payer: SOMEONE })[0]!.rule).toBe("E2");
  });
});

describe("payout", () => {
  it("is a tagged cNGN transfer of the exact amount", () => {
    const p = buildPayout(SOMEONE, 5_000_000_000n);
    expect(p.to).toBe(CNGN.address);
    expect(r17Tagged([p])).toEqual([]);
    expect(decodePayout(p.data)).toEqual({ to: SOMEONE, amount: 5_000_000_000n });
  });
});
