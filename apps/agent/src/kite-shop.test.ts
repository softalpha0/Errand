import { describe, expect, it } from "vitest";
import { parsePrice, readAllowance, readCart, readOrder, readShipping, readShopItems } from "./kite";

// Shapes copied from Kite's own skill references (passport-skills 3.6.7): shopping/references/commands.md
// and kite-passport/SKILL.md ("How the Account Allowance Works").

describe("kpass shop:* output", () => {
  it("reads search results", () => {
    const items = readShopItems({
      query: "usb c cable",
      source: "serpapi",
      items: [
        { provider: "amazon", external_identifier: "B01GGKZ2SC", title: "Amazon Basics USB-C Cable, 6 Foot, White", link: "https://www.amazon.com/dp/B01GGKZ2SC", price: "$5.85", rating: 4.5, reviews: 54800 },
        { provider: "", external_identifier: "", title: "broken row" },
      ],
      status: "success",
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ provider: "amazon", externalId: "B01GGKZ2SC", priceUsd: 5.85, rating: 4.5, reviews: 54800 });
  });

  it("parses price strings", () => {
    expect(parsePrice("$1,299.00")).toBe(1299);
    expect(parsePrice("see cart")).toBeNull();
  });

  it("reads the cart subtotal and payment rail", () => {
    const cart = readCart({
      items: [{ provider: "amazon", external_identifier: "B0CXYYWL6G", title: "Maxwell House Coffee 27.5oz", price: "$12.49", quantity: 2 }],
      item_count: 1,
      payment: { chain: "base", currency: "USDC" },
    });
    expect(cart.subtotalUsd).toBe(24.98);
    expect(cart.chain).toBe("base");
  });

  it("reads the shipping profile", () => {
    expect(readShipping({ name: "Jane Doe", city: "Austin", missing: [], complete: true })).toMatchObject({ complete: true, city: "Austin" });
    expect(readShipping({ missing: ["phone", "name (first and last name)"], complete: false }).missing).toHaveLength(2);
  });

  it("reads a checkout: charged_amount is USDC base units", () => {
    const o = readOrder({ order_id: "ord_abc123", order_status: "pending", destination_tx_hash: "0xdead", total_amount: "$18.49", charged_amount: "18490000", chain: "base" });
    expect(o).toMatchObject({ orderId: "ord_abc123", orderStatus: "pending", txHash: "0xdead", chain: "base", chargedUsd: 18.49 });
  });
});

describe("kpass allowance status", () => {
  it("reads an active allowance", () => {
    const a = readAllowance({ state: "active", amount: "0.08", period: "week", spent: "0.025", left: "0.055", reset_at: "2026-10-30T23:35:00Z", dashboard_url: "https://agentpassport.ai/overview", user_message: "Left this week: USD 0.055 of USD 0.08." });
    expect(a).toMatchObject({ state: "active", amount: 0.08, left: 0.055, period: "week" });
  });

  it("treats unknown states as unknown, not active", () => {
    expect(readAllowance({ state: "weird" }).state).toBe("unknown");
    expect(readAllowance(null).state).toBe("unknown");
  });
});
