import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_ATTRIBUTION_CODE,
  attributionCode,
  attributionSuffix,
  carriesErrandTag,
  hasErrandTag,
  tagCalldata,
} from "./attribution.js";

const TRANSFER_CALLDATA =
  "0xa9059cbb000000000000000000000000000000000000000000000000000000000000dead00000000000000000000000000000000000000000000000000000000000f4240";

afterEach(() => {
  delete process.env.ATTRIBUTION_CODE;
});

describe("attribution", () => {
  it("uses the Loops House code by default", () => {
    expect(attributionCode()).toBe("celo_511bb691f2f0");
    expect(DEFAULT_ATTRIBUTION_CODE).toBe("celo_511bb691f2f0");
  });

  it("tags calldata at the very end and leaves the call untouched", () => {
    const tagged = tagCalldata(TRANSFER_CALLDATA);
    expect(tagged.startsWith(TRANSFER_CALLDATA)).toBe(true);
    expect(tagged.endsWith(attributionSuffix().slice(2))).toBe(true);
    expect(hasErrandTag(tagged)).toBe(true);
  });

  it("tags a plain transfer with no calldata", () => {
    expect(hasErrandTag(tagCalldata(undefined))).toBe(true);
  });

  it("does not see a tag on untagged calldata", () => {
    expect(hasErrandTag(TRANSFER_CALLDATA)).toBe(false);
  });

  it("rejects a malformed override", () => {
    process.env.ATTRIBUTION_CODE = "Not A Code!";
    expect(() => attributionCode()).toThrow();
  });
});

describe("carriesErrandTag", () => {
  it("finds the tag at the end of a direct transaction and refuses untagged input", () => {
    expect(carriesErrandTag(tagCalldata("0xa9059cbb"))).toBe(true);
    expect(carriesErrandTag("0xa9059cbb")).toBe(false);
  });
});
