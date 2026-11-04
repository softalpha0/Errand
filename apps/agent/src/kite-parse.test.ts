import { describe, expect, it } from "vitest";
import { explorerUrl, extractBody, extractPayment, findApprovalUrl, readApproval } from "./kite-parse";

describe("kite-parse", () => {
  it("finds an approval link wherever it is", () => {
    expect(findApprovalUrl({ status: "human_action_required", data: { approval_url: "https://agentpassport.ai/approve/abc" } })).toBe("https://agentpassport.ai/approve/abc");
    expect(findApprovalUrl({ hint: "Open https://agentpassport.ai/session/xyz to approve" })).toBeNull();
    expect(findApprovalUrl({ links: ["https://agentpassport.ai/session/xyz"] })).toBe("https://agentpassport.ai/session/xyz");
  });

  it("reads approval state without trusting the CLI envelope", () => {
    expect(readApproval({ status: "success", approval_status: "pending" })).toBe("pending");
    expect(readApproval({ status: "success", session: { status: "active", session_id: "s1" } })).toBe("approved");
    expect(readApproval({ status: "success", request_status: "rejected" })).toBe("rejected");
    expect(readApproval({ status: "success" })).toBe("pending");
  });

  it("pulls the seller body out of an execute result", () => {
    expect(extractBody({ status: "success", response: { body: '{"products":[1]}' } })).toEqual({ products: [1] });
  });

  it("only accepts real-looking transaction hashes", () => {
    const hash = `0x${"ab".repeat(32)}`;
    expect(extractPayment({ payment: { tx_hash: hash, chain: "base", amount: "0.002" } })).toEqual({ txHash: hash, chain: "base", amountUsd: 0.002 });
    expect(extractPayment({ hash: "pending" }).txHash).toBeNull();
  });

  it("links to the right explorer", () => {
    expect(explorerUrl("kite", "0xabc")).toBe("https://kitescan.ai/tx/0xabc");
    expect(explorerUrl("base", "0xabc")).toBe("https://basescan.org/tx/0xabc");
    expect(explorerUrl(null, null)).toBeNull();
  });
});
