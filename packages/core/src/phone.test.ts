import { describe, expect, it } from "vitest";
import { isNorthAmerican, normalizePhone, samePhone } from "./phone";

describe("normalizePhone", () => {
  it.each([
    ["08031234567", "NG", "+2348031234567"],
    ["0803 123 4567", "NG", "+2348031234567"],
    ["2348031234567", "NG", "+2348031234567"],
    ["+234 803 123 4567", "NG", "+2348031234567"],
    ["00234 803 123 4567", "NG", "+2348031234567"],
    ["(415) 555-0100", "US", "+14155550100"],
    ["024 123 4567", "GH", "+233241234567"],
  ])("%s (%s) -> %s", (input, country, expected) => {
    expect(normalizePhone(input, country)).toBe(expected);
  });

  it("rejects junk", () => {
    expect(normalizePhone("call mum", "NG")).toBeNull();
    expect(normalizePhone("123", "US")).toBeNull();
  });

  it("compares local and international forms", () => {
    expect(samePhone("08031234567", "+2348031234567")).toBe(true);
    expect(samePhone("08031234567", "08031234568")).toBe(false);
  });

  it("knows StablePhone's +1 limit", () => {
    expect(isNorthAmerican("+14155550100")).toBe(true);
    expect(isNorthAmerican("+2348031234567")).toBe(false);
  });
});
