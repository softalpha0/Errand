import { describe, expect, it } from "vitest";
import { CNGN, USDT } from "@errand/celo/tokens";
import { checkPayment, fingerprintOf, parsePayment, type PaymentToCheck } from "./check.js";

const RECIPIENT = "0x1111111111111111111111111111111111111111";
const ok: PaymentToCheck = { chainId: 42220, token: CNGN.address, to: RECIPIENT, amount: "5000000000" };

describe("checkPayment", () => {
  it("approves a plain cNGN payment on Celo", () => {
    expect(checkPayment(ok).decision).toBe("approve");
  });

  it("G1 blocks other chains", () => {
    const r = checkPayment({ ...ok, chainId: 1 });
    expect(r.decision).toBe("block");
    expect(r.findings[0]!.rule).toBe("G1");
  });

  it("G3 blocks the 18-decimal USD₮ adapter", () => {
    const r = checkPayment({ ...ok, token: "0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72" });
    expect(r.decision).toBe("block");
    expect(r.findings.map((f) => f.rule)).toContain("G3");
  });

  it("G2 asks about unknown tokens", () => {
    expect(checkPayment({ ...ok, token: "0x2222222222222222222222222222222222222222" }).decision).toBe("ask");
  });

  it("G4 blocks the zero address and the token contract as recipient", () => {
    expect(checkPayment({ ...ok, to: "0x0000000000000000000000000000000000000000" }).decision).toBe("block");
    expect(checkPayment({ ...ok, to: USDT.address, token: USDT.address }).decision).toBe("block");
  });

  it("G5 blocks zero, junk and over-limit amounts", () => {
    expect(checkPayment({ ...ok, amount: "0" }).decision).toBe("block");
    expect(checkPayment({ ...ok, amount: "1.5" }).decision).toBe("block");
    expect(checkPayment({ ...ok, limits: { maxAmount: "4999999999" } }).decision).toBe("block");
    expect(checkPayment({ ...ok, limits: { maxAmount: "5000000000" } }).decision).toBe("approve");
  });

  it("G6 blocks recipients outside the approved list (case-insensitive)", () => {
    expect(checkPayment({ ...ok, limits: { allowedRecipients: ["0x3333333333333333333333333333333333333333"] } }).decision).toBe("block");
    expect(checkPayment({ ...ok, limits: { allowedRecipients: [RECIPIENT.toUpperCase().replace("0X", "0x")] } }).decision).toBe("approve");
  });

  it("G7 asks on a repeat of the same payment", () => {
    expect(checkPayment(ok, new Set([fingerprintOf(ok)])).decision).toBe("ask");
  });

  it("G8 blocks payments suggested by a seller, even if everything else is fine", () => {
    const r = checkPayment({ ...ok, suggestedBy: "seller" });
    expect(r.decision).toBe("block");
    expect(r.findings.map((f) => f.rule)).toEqual(["G8"]);
  });

  it("block beats ask", () => {
    expect(checkPayment({ ...ok, token: "0x2222222222222222222222222222222222222222", suggestedBy: "seller" }).decision).toBe("block");
  });
});

describe("parsePayment", () => {
  it("accepts a full body", () => {
    const r = parsePayment({ ...ok, limits: { maxAmount: "1", allowedRecipients: [RECIPIENT] }, suggestedBy: "user", purpose: "supplier" });
    expect(r.ok).toBe(true);
  });
  it("lists every problem", () => {
    const r = parsePayment({ chainId: "42220", suggestedBy: "friend" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.length).toBeGreaterThanOrEqual(4);
  });
  it("rejects non-objects", () => {
    expect(parsePayment(null).ok).toBe(false);
  });
});
