/**
 * The sellers Errand is allowed to pay, and nothing else.
 *
 * Every entry below was read from the seller's own unpaid HTTP 402 response
 * or published OpenAPI document on 4 Nov 2026, and every seller is listed in
 * the Kite Passport catalog (`ksearch service list`). Prices are the seller's
 * fixed price per call in USD. See docs/sellers.md for the raw evidence.
 *
 * If a seller changes a price or a path, update it here; the guard reads
 * this table, so an unlisted URL can never be paid.
 */

export type SellerId = "bitrefill" | "stableenrich" | "stableemail" | "stablephone" | "reppo" | "kiteshop";

export type EndpointKind = "research" | "shop" | "notify" | "call" | "assess";

export interface CatalogEndpoint {
  id: string;
  seller: SellerId;
  kind: EndpointKind;
  method: "GET" | "POST";
  url: string;
  /** Fixed price per call in USD. `null` means the price comes from an invoice. */
  priceUsd: number | null;
  summary: string;
}

export interface Seller {
  id: SellerId;
  name: string;
  baseUrl: string;
  kiteServiceId: string | null;
  summary: string;
}

export const SELLERS: Record<SellerId, Seller> = {
  bitrefill: {
    id: "bitrefill",
    name: "Bitrefill",
    baseUrl: "https://api.bitrefill.com",
    kiteServiceId: "8c750b3f556a632edf42cd5c",
    summary: "Mobile top-ups, eSIMs and gift cards in 180+ countries, paid in USDC over x402.",
  },
  stableenrich: {
    id: "stableenrich",
    name: "StableEnrich",
    baseUrl: "https://stableenrich.dev",
    kiteServiceId: "eb46bc3541c1b380e22c5948",
    summary: "Pay-per-call web search, answers, Reddit, news, shopping and Google Maps.",
  },
  stableemail: {
    id: "stableemail",
    name: "StableEmail",
    baseUrl: "https://stableemail.dev",
    kiteServiceId: "8065051cb5322e56fc65197a",
    summary: "Send an email from a relay address, paid per message.",
  },
  stablephone: {
    id: "stablephone",
    name: "StablePhone",
    baseUrl: "https://stablephone.dev",
    kiteServiceId: "9b14d31b7a7df777b5e66bf4",
    summary: "AI phone calls to US and Canadian (+1) numbers.",
  },
  reppo: {
    id: "reppo",
    name: "Reppo",
    baseUrl: "https://eval.reppo.xyz",
    kiteServiceId: null,
    summary: "Independent evaluators judge a subjective question; the lite endpoint answers at once, paid over x402.",
  },
  kiteshop: {
    id: "kiteshop",
    name: "Amazon (Kite shopping)",
    baseUrl: "kpass:shop",
    kiteServiceId: null,
    summary: "Physical products from Amazon through Kite Passport's own shopping checkout (`kpass shop:*`). Paid from a passkey-approved session only, never the allowance.",
  },
};

/** Pseudo-URL for Kite's shopping checkout: it is a kpass command, not an HTTP call Errand makes. */
export const SHOP_CHECKOUT_URL = "kpass:shop:checkout";
/** Kite's provider fee on every shopping checkout (Kite "shopping" skill). */
export const SHOP_FEE_USD = 1;
/** Kite's default price cap when none is given: subtotal + max(20%, $5). */
export function defaultShopCap(subtotalUsd: number): number {
  return Math.round((subtotalUsd + Math.max(subtotalUsd * 0.2, 5)) * 100) / 100;
}

export const ENDPOINTS: CatalogEndpoint[] = [
  // Research (StableEnrich, prices from https://stableenrich.dev/openapi.json)
  { id: "exa.answer", seller: "stableenrich", kind: "research", method: "POST", url: "https://stableenrich.dev/api/exa/answer", priceUsd: 0.01, summary: "Answer a question with cited web sources." },
  { id: "exa.search", seller: "stableenrich", kind: "research", method: "POST", url: "https://stableenrich.dev/api/exa/search", priceUsd: 0.01, summary: "Web search returning pages." },
  { id: "reddit.search", seller: "stableenrich", kind: "research", method: "POST", url: "https://stableenrich.dev/api/reddit/search", priceUsd: 0.02, summary: "Search Reddit posts for what people actually say." },
  { id: "news.search", seller: "stableenrich", kind: "research", method: "POST", url: "https://stableenrich.dev/api/serper/news", priceUsd: 0.04, summary: "Google News results." },
  { id: "shopping.search", seller: "stableenrich", kind: "research", method: "POST", url: "https://stableenrich.dev/api/serper/shopping", priceUsd: 0.04, summary: "Google Shopping prices." },
  { id: "maps.search", seller: "stableenrich", kind: "research", method: "POST", url: "https://stableenrich.dev/api/google-maps/text-search/partial", priceUsd: 0.02, summary: "Find places on Google Maps." },
  { id: "maps.details", seller: "stableenrich", kind: "research", method: "GET", url: "https://stableenrich.dev/api/google-maps/place-details/partial", priceUsd: 0.02, summary: "Opening hours and phone number for one place." },
  { id: "web.scrape", seller: "stableenrich", kind: "research", method: "POST", url: "https://stableenrich.dev/api/firecrawl/scrape", priceUsd: 0.0126, summary: "Read one web page as text." },

  // Shopping (Bitrefill x402 storefront, prices from its 402 responses)
  { id: "bitrefill.topups.search", seller: "bitrefill", kind: "shop", method: "GET", url: "https://api.bitrefill.com/x402/topups/search", priceUsd: 0.002, summary: "Find mobile top-up products for a carrier and country." },
  { id: "bitrefill.esims.search", seller: "bitrefill", kind: "shop", method: "GET", url: "https://api.bitrefill.com/x402/esims/search", priceUsd: 0.002, summary: "Find eSIM data plans for a country or region." },
  { id: "bitrefill.giftcards.search", seller: "bitrefill", kind: "shop", method: "GET", url: "https://api.bitrefill.com/x402/gift-cards/search", priceUsd: 0.002, summary: "Find gift card brands for a country." },
  { id: "bitrefill.product.detail", seller: "bitrefill", kind: "shop", method: "GET", url: "https://api.bitrefill.com/x402/products/detail", priceUsd: 0.001, summary: "Packages, prices and recipient rules for one product." },
  { id: "bitrefill.invoice.create", seller: "bitrefill", kind: "shop", method: "POST", url: "https://api.bitrefill.com/x402/invoice/create", priceUsd: 0.002, summary: "Create a price-locked invoice (valid 30 minutes)." },
  { id: "bitrefill.invoice.pay", seller: "bitrefill", kind: "shop", method: "POST", url: "https://api.bitrefill.com/x402/invoice/pay", priceUsd: null, summary: "Pay the invoice. The amount is the invoice price." },
  { id: "bitrefill.invoice.status", seller: "bitrefill", kind: "shop", method: "GET", url: "https://api.bitrefill.com/x402/invoice/status", priceUsd: 0.001, summary: "Check delivery of a paid invoice." },

  // Tell people
  { id: "email.send", seller: "stableemail", kind: "notify", method: "POST", url: "https://stableemail.dev/api/send", priceUsd: 0.02, summary: "Send one email from relay@stableemail.dev." },

  // Call (US and Canada only)
  { id: "phone.call", seller: "stablephone", kind: "call", method: "POST", url: "https://stablephone.dev/api/call", priceUsd: 0.54, summary: "Make an AI phone call to a +1 number with a task." },

  // Independent second opinion (Reppo lite evaluation: $0.22 in USDC on Base via x402, verdict returned at once)
  { id: "reppo.lite", seller: "reppo", kind: "assess", method: "POST", url: "https://eval.reppo.xyz/api/v1/x402/evals/lite", priceUsd: 0.22, summary: "Independent second opinion from Reppo's evaluators." },

  // Physical goods: Kite Passport's shopping checkout (Amazon). Searching and the cart are free;
  // only the checkout is paid. Kite charges the price cap + a $1 provider fee up front and the
  // provider refunds the unused part of the cap to the wallet (Kite "shopping" skill 3.6.7).
  { id: "kite.shop.checkout", seller: "kiteshop", kind: "shop", method: "POST", url: SHOP_CHECKOUT_URL, priceUsd: null, summary: "Place the Amazon order: cap + $1 fee charged up front, unused cap refunded." },
];

export const ENDPOINT_BY_ID: Record<string, CatalogEndpoint> = Object.fromEntries(
  ENDPOINTS.map((e) => [e.id, e]),
);

/** Endpoints the planner may choose as a step. Buying is one macro step. */
export const PLANNABLE_STEP_TYPES = [
  "exa.answer",
  "exa.search",
  "reddit.search",
  "news.search",
  "shopping.search",
  "maps.search",
  "maps.details",
  "web.scrape",
  "buy.topup",
  "buy.esim",
  "buy.giftcard",
  "buy.amazon",
  "email.send",
  "phone.call",
  "reppo.opinion",
] as const;

export type StepType = (typeof PLANNABLE_STEP_TYPES)[number];

/** Which catalog endpoints each plan step type is allowed to pay. */
export const STEP_ENDPOINTS: Record<StepType, string[]> = {
  "exa.answer": ["exa.answer"],
  "exa.search": ["exa.search"],
  "reddit.search": ["reddit.search"],
  "news.search": ["news.search"],
  "shopping.search": ["shopping.search"],
  "maps.search": ["maps.search"],
  "maps.details": ["maps.details"],
  "web.scrape": ["web.scrape"],
  "buy.topup": ["bitrefill.topups.search", "bitrefill.product.detail", "bitrefill.invoice.create", "bitrefill.invoice.pay", "bitrefill.invoice.status", "reppo.lite"],
  "buy.esim": ["bitrefill.esims.search", "bitrefill.product.detail", "bitrefill.invoice.create", "bitrefill.invoice.pay", "bitrefill.invoice.status", "reppo.lite"],
  "buy.giftcard": ["bitrefill.giftcards.search", "bitrefill.product.detail", "bitrefill.invoice.create", "bitrefill.invoice.pay", "bitrefill.invoice.status", "reppo.lite"],
  "buy.amazon": ["kite.shop.checkout", "reppo.lite"],
  "email.send": ["email.send"],
  "phone.call": ["phone.call", "reppo.lite"],
  "reppo.opinion": ["reppo.lite"],
};

/** Price of one Reppo lite evaluation (the "second opinion"). */
export const SECOND_OPINION_USD = 0.22;

/** Endpoints a step type always uses (optional ones, like a second opinion, excluded). */
export function requiredEndpoints(type: StepType, secondOpinion: boolean): string[] {
  const all = STEP_ENDPOINTS[type];
  if (type === "reppo.opinion") return all;
  return secondOpinion ? all : all.filter((id) => id !== "reppo.lite");
}

/** Step types that may run on the Kite allowance (no shopping: Kite's allowance never pays checkouts). */
export function allowanceCanPay(type: StepType): boolean {
  return type !== "buy.amazon";
}

/** Fixed fees a buy step pays on top of the product (search + detail + create + 2 status checks). */
export const BUY_OVERHEAD_USD = 0.002 + 0.001 + 0.002 + 0.001 * 2;

export function endpointForUrl(url: string, method: string): CatalogEndpoint | undefined {
  const clean = url.split("?")[0];
  return ENDPOINTS.find((e) => e.url === clean && e.method === method.toUpperCase());
}

/** The fixed cost of a step type, or null when it depends on what is bought. */
export function fixedStepCost(type: StepType, secondOpinion = false): number | null {
  if (type.startsWith("buy.")) return null;
  const ids = requiredEndpoints(type, secondOpinion);
  return Math.round(ids.reduce((sum, id) => sum + (ENDPOINT_BY_ID[id]?.priceUsd ?? 0), 0) * 1_000_000) / 1_000_000;
}
