import { describe, expect, it } from "vitest";
import { publicKeyToAddress } from "viem/accounts";
import { CNGN, USDT } from "./tokens.js";
import { LOCAL_CURRENCIES } from "./currencies.js";
import { ERRAND_AGENT, TEXTILE_REACTOR, buildSessionPermissions, describeAllowlist, expiryFromNow, toAtomic6 } from "./session.js";

describe("Errand agent key", () => {
  it("public key belongs to the agent wallet", () => {
    expect(publicKeyToAddress(ERRAND_AGENT.publicKey).toLowerCase()).toBe(ERRAND_AGENT.address.toLowerCase());
  });
});

describe("buildSessionPermissions", () => {
  const caps = { usdtPerDay: 5_000_000n, local: { token: CNGN.address, perDay: 10_000_000_000n } };

  it("always sets an allowlist of exactly three calls", () => {
    const p = buildSessionPermissions(caps);
    expect(p.calls).toEqual([
      { signature: "approve(address,uint256)", to: USDT.address },
      { to: TEXTILE_REACTOR },
      { signature: "transfer(address,uint256)", to: CNGN.address },
    ]);
  });

  it("caps USD₮ and cNGN per day", () => {
    const p = buildSessionPermissions(caps);
    expect(p.spend).toEqual([
      { limit: 5_000_000n, period: "day", token: USDT.address },
      { limit: 10_000_000_000n, period: "day", token: CNGN.address },
    ]);
  });

  it("refuses zero caps and caps above $100/day", () => {
    expect(() => buildSessionPermissions({ ...caps, usdtPerDay: 0n })).toThrow();
    expect(() => buildSessionPermissions({ ...caps, local: { token: USDT.address, perDay: 1n } })).toThrow(/local currencies/);
    expect(() => buildSessionPermissions({ ...caps, usdtPerDay: 100_000_001n })).toThrow(/100/);
  });

  it("describes every allowed call in plain words", () => {
    expect(describeAllowlist(CNGN.address).map((a) => a.to)).toEqual(buildSessionPermissions(caps).calls.map((c) => ("to" in c ? c.to : null)));
  });

  it("allows transfer() on the one chosen currency only", () => {
    const wbrl = LOCAL_CURRENCIES.find((c) => c.code === "BRL")!.token.address;
    const p = buildSessionPermissions({ usdtPerDay: 5_000_000n, local: { token: wbrl, perDay: 10n ** 20n } });
    expect(p.calls[2]).toEqual({ signature: "transfer(address,uint256)", to: wbrl });
    expect(p.calls.some((c) => "to" in c && c.to === CNGN.address)).toBe(false);
  });
});

describe("toAtomic6", () => {
  it("converts without floating-point error", () => {
    expect(toAtomic6("5")).toBe(5_000_000n);
    expect(toAtomic6("0.1")).toBe(100_000n);
    expect(toAtomic6("10,000")).toBe(10_000_000_000n);
    expect(toAtomic6("1.000001")).toBe(1_000_001n);
  });
  it("rejects junk and too many decimals", () => {
    expect(() => toAtomic6("abc")).toThrow();
    expect(() => toAtomic6("1.0000001")).toThrow();
    expect(() => toAtomic6("-1")).toThrow();
  });
});

describe("expiryFromNow", () => {
  it("adds whole days", () => {
    expect(expiryFromNow(7, 1_000_000_000_000)).toBe(1_000_000_000 + 7 * 86_400);
  });
  it("only allows 1, 7 or 30 days", () => {
    expect(() => expiryFromNow(3)).toThrow();
  });
});
