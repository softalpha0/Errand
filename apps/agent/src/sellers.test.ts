import { describe, expect, it } from "vitest";
import { bitrefillCreateInvoice, pickPackage, pickProduct, readDetail, readInvoice } from "./sellers";

describe("bitrefill helpers", () => {
  const search = {
    products: [
      { slug: "airtel-nigeria", name: "Airtel", country: "NG", in_stock: true },
      { slug: "mtn-nigeria-old", name: "MTN", country: "NG", in_stock: false },
      { slug: "mtn-nigeria", name: "MTN", country: "NG", in_stock: true },
      { slug: "mtn-ghana", name: "MTN", country: "GH", in_stock: true },
    ],
  };

  it("picks the in-stock product for the right country", () => {
    expect(pickProduct(search, "MTN", "NG")?.slug).toBe("mtn-nigeria");
    expect(pickProduct(search, "MTN", "GH")?.slug).toBe("mtn-ghana");
    expect(pickProduct({ products: [] }, "MTN")).toBeNull();
  });

  it("reads the documented product detail shape", () => {
    const d = readDetail({ id: "amazon-us", name: "Amazon", recipient_type: "none", recipient_required: false, packages: [{ package_value: "25", package_currency: "USD" }, { package_value: "50", package_currency: "USD" }] });
    expect(d.packages).toHaveLength(2);
    expect(pickPackage(d, { amountUsd: 30 })?.package_value).toBe("25");
    expect(pickPackage(d, { amountUsd: 10 })).toBeNull();
    expect(pickPackage(d, { packageValue: "50", amountUsd: 60 })?.package_value).toBe("50");
  });

  it("builds the documented invoice body", () => {
    expect(bitrefillCreateInvoice({ productId: "mtn-nigeria", packageValue: "1000", refillInput: "+2348031234567" }).body).toEqual({
      items: [{ product_id: "mtn-nigeria", package_value: "1000", refill_input: "+2348031234567" }],
    });
  });

  it("reads the documented invoice shape", () => {
    expect(readInvoice({ invoice_id: "inv", price_usdc: "25000000", price_usd: 25, expires_in_minutes: 30 })).toEqual({ invoiceId: "inv", priceUsd: 25, expiresInMinutes: 30 });
    expect(readInvoice({ invoice_id: "inv", price_usdc: "680000" })?.priceUsd).toBe(0.68);
    expect(readInvoice({})).toBeNull();
  });
});

describe("Bitrefill live search shape (first real payment, 5 Nov)", () => {
  const live = { products: [{ _id: "mtn-nigeria", countries: ["NG"], currency: "NGN", in_stock: true, name: "MTN Nigeria", slug: "mtn-nigeria", type: "refills" }], found: 1 };
  it("matches the country from the countries list", () => {
    expect(pickProduct(live, "MTN", "NG")?.slug).toBe("mtn-nigeria");
    expect(pickProduct(live, "MTN", "GH")).toBeNull();
  });
});

