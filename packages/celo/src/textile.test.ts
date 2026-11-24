import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { recoverTypedDataAddress, type Address, type Hex } from "viem";
import { CNGN, USDT } from "./tokens.js";
import { TEXTILE_REACTOR } from "./session.js";
import { TextileClient, TextileError, encodeApprove, isTerminal, takerControlTypedData, validateFirmQuote, type FirmQuote } from "./textile.js";

const account = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const TAKER = account.address;

function firmQuote(over: Partial<FirmQuote["quote"]> = {}): FirmQuote {
  const takerPays = over.takerPays ?? "1000000";
  return {
    rfqId: "rfq_1",
    claimToken: "rfqc_1",
    status: "quoted",
    quote: {
      sellAmount: "1000000",
      buyAmount: "1447000000",
      feeAmount: "200",
      takerPays,
      rateRay: "1",
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
      orderDeadline: new Date(Date.now() + 60_000).toISOString(),
      latestOrderDeadline: new Date(Date.now() + 60_000).toISOString(),
      reactor: TEXTILE_REACTOR,
      taker: TAKER,
      encodedOrder: "0x",
      signature: "0x",
      orders: [],
      ...over,
    },
    transactions: {
      approval: { to: USDT.address, data: encodeApprove(TEXTILE_REACTOR, BigInt(takerPays)), value: "0", chainId: 42220 },
      swap: { to: TEXTILE_REACTOR, data: "0xdeadbeef", value: "0", chainId: 42220 },
    },
  };
}

const expectOk = { taker: TAKER as Address, sellToken: USDT.address, maxTakerPays: 1_000_000n, chainId: 42220, nowMs: Date.now() };

describe("takerControlTypedData", () => {
  it("signs and recovers as the taker (TakerControl v1, issuedAt in ms)", async () => {
    const td = takerControlTypedData({ taker: TAKER, chainId: 42220, nonce: `0x${"11".repeat(32)}` as Hex, issuedAtMs: 1756400000000 });
    expect(td.domain).toEqual({ name: "Textile Taker Control", version: "1", chainId: 42220 });
    expect(td.types.TakerControl.map((f) => f.name)).toEqual(["taker", "chainId", "nonce", "issuedAt"]);
    const sig = await account.signTypedData(td);
    expect(await recoverTypedDataAddress({ ...td, signature: sig })).toBe(TAKER);
  });
});

describe("TextileClient.request", () => {
  it("retries once with a signed takerProof after 401 proof_of_control_required", async () => {
    const calls: { body: Record<string, unknown> }[] = [];
    const fake = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      calls.push({ body });
      if (!body.takerProof) {
        return new Response(JSON.stringify({ error: { code: "unauthorized", message: "proof needed", details: { reason: "proof_of_control_required" } } }), { status: 401 });
      }
      return new Response(JSON.stringify({ data: firmQuote() }), { status: 200 });
    });
    const client = new TextileClient({ fetch: fake as unknown as typeof fetch, now: () => 1756400000000 });
    const res = await client.request({ chainId: 42220, sellToken: USDT.address, buyToken: CNGN.address, sellAmount: "1000000", taker: TAKER }, (td) => account.signTypedData(td));
    expect(res.status).toBe("quoted");
    expect(calls).toHaveLength(2);
    const proof = calls[1]!.body.takerProof as { nonce: string; issuedAt: number; signature: string };
    expect(proof.issuedAt).toBe(1756400000000);
    expect(proof.nonce).toMatch(/^0x[0-9a-f]{64}$/);
    expect(proof.signature).toMatch(/^0x/);
  });

  it("returns no_quote as data, not an error", async () => {
    const fake = async () => new Response(JSON.stringify({ data: { status: "no_quote", reason: "no_makers_online", retryAfterMs: 5000 } }), { status: 200 });
    const client = new TextileClient({ fetch: fake as unknown as typeof fetch });
    const res = await client.request({ chainId: 42220, sellToken: USDT.address, buyToken: CNGN.address, sellAmount: "1000000", taker: TAKER }, async () => "0x");
    expect(res.status).toBe("no_quote");
  });

  it("throws TextileError with code and reason on other errors", async () => {
    const fake = async () =>
      new Response(JSON.stringify({ error: { code: "invalid_request", message: "low funds", request_id: "req_x", details: { reason: "insufficient_funds" } } }), { status: 400 });
    const client = new TextileClient({ fetch: fake as unknown as typeof fetch });
    await expect(
      client.request({ chainId: 42220, sellToken: USDT.address, buyToken: CNGN.address, sellAmount: "1000000", taker: TAKER }, async () => "0x"),
    ).rejects.toMatchObject({ name: "TextileError", httpStatus: 400, code: "invalid_request", reason: "insufficient_funds", requestId: "req_x" } satisfies Partial<TextileError>);
  });

  it("sends the claim token as X-Rfq-Claim on get/submit/cancel", async () => {
    const seen: string[] = [];
    const fake = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      seen.push(new Headers(init?.headers).get("X-Rfq-Claim") ?? "");
      return new Response(JSON.stringify({ data: { rfqId: "rfq_1", status: "filled" } }), { status: 200 });
    });
    const client = new TextileClient({ fetch: fake as unknown as typeof fetch });
    await client.get("rfq_1", "rfqc_1");
    await client.submit("rfq_1", "rfqc_1", "0xabc");
    await client.cancel("rfq_1", "rfqc_1");
    expect(seen).toEqual(["rfqc_1", "rfqc_1", "rfqc_1"]);
  });
});

describe("validateFirmQuote (R15)", () => {
  it("accepts a clean quote", () => {
    expect(validateFirmQuote(firmQuote(), expectOk)).toEqual([]);
  });
  it("refuses an expired quote", () => {
    expect(validateFirmQuote(firmQuote({ expiresAt: new Date(Date.now() - 1000).toISOString() }), expectOk)).toContain("Quote has expired.");
  });
  it("refuses a quote for another taker or reactor", () => {
    const other = "0x2222222222222222222222222222222222222222" as Address;
    expect(validateFirmQuote(firmQuote({ taker: other }), expectOk)).toContain("Quote is bound to a different taker.");
    expect(validateFirmQuote(firmQuote({ reactor: other }), expectOk)).toContain("Quote's reactor is not Textile's LimitOrderReactor.");
  });
  it("refuses a quote that costs more than planned", () => {
    expect(validateFirmQuote(firmQuote({ takerPays: "1000001" }), expectOk)).toContain("Quote costs more than the planned maximum.");
  });
  it("refuses an approval to another spender", () => {
    const q = firmQuote();
    q.transactions.approval.data = encodeApprove("0x3333333333333333333333333333333333333333", 1_000_000n);
    expect(validateFirmQuote(q, expectOk)).toContain("Approval spender is not the reactor.");
  });
});

describe("isTerminal", () => {
  it("knows the terminal statuses", () => {
    expect(["filled", "failed", "expired", "no_quote"].every(isTerminal)).toBe(true);
    expect(isTerminal("submitted")).toBe(false);
  });
});

describe("TextileClient keyed and relayed requests", () => {
  it("sends the API key as a Bearer token and no takerProof", async () => {
    let seen: { auth: string | null; body: Record<string, unknown> } | undefined;
    const fake = async (_u: string | URL | Request, init?: RequestInit) => {
      seen = { auth: new Headers(init?.headers).get("Authorization"), body: JSON.parse(String(init?.body)) };
      return new Response(JSON.stringify({ data: firmQuote() }), { status: 200 });
    };
    const client = new TextileClient({ fetch: fake as unknown as typeof fetch, apiKey: "tx_live_test" });
    expect(client.keyed).toBe(true);
    await client.requestWithProof({ chainId: 42220, sellToken: USDT.address, buyToken: CNGN.address, buyAmount: "1", taker: TAKER }, { nonce: "0x01", issuedAt: 1, signature: "0x02" });
    expect(seen!.auth).toBe("Bearer tx_live_test");
    expect(seen!.body.takerProof).toBeUndefined();
  });

  it("relays a browser-signed proof when keyless", async () => {
    let body: Record<string, unknown> = {};
    const fake = async (_u: string | URL | Request, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ data: firmQuote() }), { status: 200 });
    };
    const client = new TextileClient({ fetch: fake as unknown as typeof fetch });
    await client.requestWithProof({ chainId: 42220, sellToken: USDT.address, buyToken: CNGN.address, buyAmount: "1", taker: TAKER }, { nonce: "0x01", issuedAt: 5, signature: "0x02" });
    expect(body.takerProof).toEqual({ nonce: "0x01", issuedAt: 5, signature: "0x02" });
  });
});
