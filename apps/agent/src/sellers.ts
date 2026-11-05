/**
 * Building requests for each seller, and reading what they send back.
 * Request shapes come from each seller's own x402 "bazaar" schema or OpenAPI
 * document (see docs/sellers.md); nothing here is guessed.
 */
import { ENDPOINT_BY_ID, stepInput, usdcUnitsToUsd, type PlanStep } from "@errand/core";

export interface SellerRequest {
  endpointId: string;
  url: string;
  method: "GET" | "POST";
  body?: unknown;
}

function withQuery(base: string, params: Record<string, string | undefined>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join("&");
  return qs ? `${base}?${qs}` : base;
}

function ep(id: string) {
  const e = ENDPOINT_BY_ID[id];
  if (!e) throw new Error(`Unknown endpoint ${id}`);
  return e;
}

/** Research steps map one-to-one to a single paid call. */
export function researchRequest(step: PlanStep, resolve: (ref: string) => string | undefined): SellerRequest {
  const q = stepInput(step, "query") ?? "";
  switch (step.type) {
    case "exa.answer":
      return { endpointId: "exa.answer", url: ep("exa.answer").url, method: "POST", body: { query: q, text: false } };
    case "exa.search":
      return { endpointId: "exa.search", url: ep("exa.search").url, method: "POST", body: { query: q, numResults: 5 } };
    case "reddit.search":
      return { endpointId: "reddit.search", url: ep("reddit.search").url, method: "POST", body: { query: q, sort: "relevance", timeframe: "year", maxResults: 10 } };
    case "news.search":
      return { endpointId: "news.search", url: ep("news.search").url, method: "POST", body: { q, num: 8 } };
    case "shopping.search":
      return { endpointId: "shopping.search", url: ep("shopping.search").url, method: "POST", body: { q, num: 8 } };
    case "maps.search":
      return { endpointId: "maps.search", url: ep("maps.search").url, method: "POST", body: { textQuery: q, maxResultCount: 5 } };
    case "maps.details": {
      const raw = stepInput(step, "placeId") ?? "";
      const placeId = raw.startsWith("from:") ? (resolve(raw.slice(5)) ?? "") : raw;
      if (!placeId) throw new Error("No place to look up: the maps search found nothing.");
      return { endpointId: "maps.details", url: withQuery(ep("maps.details").url, { placeId }), method: "GET" };
    }
    case "web.scrape":
      return { endpointId: "web.scrape", url: ep("web.scrape").url, method: "POST", body: { url: stepInput(step, "url") ?? q } };
    default:
      throw new Error(`${step.type} is not a research step.`);
  }
}

/** First place id in a Google Maps text-search response. */
export function firstPlaceId(body: unknown): string | undefined {
  const places = (body as { places?: { id?: string; name?: string }[] } | null)?.places;
  const p = places?.[0];
  return p?.id ?? p?.name?.replace(/^places\//, "");
}

// ---------- Bitrefill ----------

export type BuyKind = "topup" | "esim" | "giftcard";

export function buyKind(step: PlanStep): BuyKind {
  return step.type === "buy.topup" ? "topup" : step.type === "buy.esim" ? "esim" : "giftcard";
}

export function bitrefillSearch(kind: BuyKind, query: string, country?: string): SellerRequest {
  const id = kind === "topup" ? "bitrefill.topups.search" : kind === "esim" ? "bitrefill.esims.search" : "bitrefill.giftcards.search";
  return { endpointId: id, url: withQuery(ep(id).url, { q: query, country }), method: "GET" };
}

export function bitrefillDetail(slug: string): SellerRequest {
  return { endpointId: "bitrefill.product.detail", url: withQuery(ep("bitrefill.product.detail").url, { slug }), method: "GET" };
}

export function bitrefillCreateInvoice(item: { productId: string; packageValue: string; refillInput?: string }): SellerRequest {
  return {
    endpointId: "bitrefill.invoice.create",
    url: ep("bitrefill.invoice.create").url,
    method: "POST",
    body: {
      items: [
        {
          product_id: item.productId,
          package_value: item.packageValue,
          ...(item.refillInput ? { refill_input: item.refillInput } : {}),
        },
      ],
    },
  };
}

export function bitrefillPay(invoiceId: string): SellerRequest {
  return { endpointId: "bitrefill.invoice.pay", url: ep("bitrefill.invoice.pay").url, method: "POST", body: { invoice_id: invoiceId } };
}

export function bitrefillStatus(invoiceId: string): SellerRequest {
  return { endpointId: "bitrefill.invoice.status", url: withQuery(ep("bitrefill.invoice.status").url, { invoice_id: invoiceId }), method: "GET" };
}

export interface BitrefillProduct {
  slug: string;
  name: string;
  country?: string;
  /** Bitrefill's live search returns a list, e.g. ["NG"] (seen 5 Nov in the first real payment). */
  countries?: string[];
  recipient_type?: string;
  in_stock?: boolean;
}

/** Pick the in-stock product whose name best matches the query (e.g. "MTN"). */
export function pickProduct(body: unknown, query: string, country?: string): BitrefillProduct | null {
  const products = ((body as { products?: BitrefillProduct[] } | null)?.products ?? []).filter((p) => p && p.slug);
  const inStock = products.filter((p) => p.in_stock !== false);
  const q = query.toLowerCase();
  const inCountry = (p: BitrefillProduct) => {
    if (!country) return true;
    const c = country.toUpperCase();
    if (Array.isArray(p.countries) && p.countries.length) return p.countries.some((x) => String(x).toUpperCase() === c);
    return !p.country || p.country.toUpperCase() === c;
  };
  return (
    inStock.find((p) => inCountry(p) && p.name.toLowerCase() === q) ??
    inStock.find((p) => inCountry(p) && (p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))) ??
    inStock.find(inCountry) ??
    null
  );
}

export interface BitrefillPackage {
  package_value: string;
  package_currency?: string;
  price_usd?: number;
}

export interface ProductDetail {
  id: string;
  name: string;
  recipientType: string;
  recipientRequired: boolean;
  packages: BitrefillPackage[];
}

export function readDetail(body: unknown): ProductDetail {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    id: String(b.id ?? b.slug ?? ""),
    name: String(b.name ?? ""),
    recipientType: String(b.recipient_type ?? "none"),
    recipientRequired: Boolean(b.recipient_required),
    packages: (Array.isArray(b.packages) ? b.packages : []).map((p) => ({
      package_value: String((p as BitrefillPackage).package_value),
      package_currency: (p as BitrefillPackage).package_currency,
      price_usd: typeof (p as BitrefillPackage).price_usd === "number" ? (p as BitrefillPackage).price_usd : undefined,
    })),
  };
}

/**
 * Choose a package: the exact local denomination if the plan names one,
 * otherwise a USD package closest to (not above) the planned amount.
 * Returns null when only a person can choose (the agent then asks).
 */
export function pickPackage(detail: ProductDetail, opts: { packageValue?: string; amountUsd: number }): BitrefillPackage | null {
  if (opts.packageValue) {
    return detail.packages.find((p) => Number(p.package_value) === Number(opts.packageValue)) ?? null;
  }
  const usd = detail.packages
    .map((p) => ({ p, usd: p.price_usd ?? (p.package_currency?.toUpperCase() === "USD" ? Number(p.package_value) : NaN) }))
    .filter((x) => Number.isFinite(x.usd) && x.usd <= opts.amountUsd + 0.000001)
    .sort((a, b) => b.usd - a.usd);
  return usd[0]?.p ?? null;
}

export interface Invoice {
  invoiceId: string;
  priceUsd: number;
  expiresInMinutes: number | null;
}

export function readInvoice(body: unknown): Invoice | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const id = b.invoice_id ?? b.id;
  if (typeof id !== "string") return null;
  const price = typeof b.price_usd === "number" ? b.price_usd : typeof b.price_usdc === "string" ? usdcUnitsToUsd(b.price_usdc) : NaN;
  if (!Number.isFinite(price)) return null;
  return { invoiceId: id, priceUsd: price, expiresInMinutes: typeof b.expires_in_minutes === "number" ? b.expires_in_minutes : null };
}

export function readDelivery(body: unknown): { status: string; delivery: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  return { status: String(b.status ?? "unknown"), delivery: String(b.delivery_status ?? "unknown") };
}

// ---------- email and phone ----------

export function emailRequest(to: string, subject: string, text: string): SellerRequest {
  return { endpointId: "email.send", url: ep("email.send").url, method: "POST", body: { to: [to], subject: subject.slice(0, 200), text } };
}

export function phoneRequest(phone: string, task: string): SellerRequest {
  return {
    endpointId: "phone.call",
    url: ep("phone.call").url,
    method: "POST",
    body: { phone_number: phone, task: task.slice(0, 4000), max_duration: 3, voicemail_action: "hangup" },
  };
}

// ---------- live price check ----------

/**
 * Ask the seller for its price without paying: an unpaid request returns
 * HTTP 402 with a base64 `payment-required` header listing what it accepts.
 * We read the Base USDC amount. This lets the guard compare the seller's
 * live quote with the catalog before any money moves.
 */
export async function quoteUsd(req: SellerRequest): Promise<number | null> {
  try {
    const res = await fetch(req.url, {
      method: req.method,
      headers: req.method === "POST" ? { "content-type": "application/json" } : undefined,
      body: req.method === "POST" ? JSON.stringify(req.body ?? {}) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status !== 402) return null;
    const header = res.headers.get("payment-required");
    let accepts: { network?: string; amount?: string; maxAmountRequired?: string; scheme?: string }[] = [];
    if (header) {
      accepts = (JSON.parse(Buffer.from(header, "base64").toString("utf8")) as { accepts?: typeof accepts }).accepts ?? [];
    } else {
      accepts = ((await res.json().catch(() => ({}))) as { accepts?: typeof accepts }).accepts ?? [];
    }
    const base = accepts.find((a) => a.network === "eip155:8453" || a.network === "base") ?? accepts[0];
    if (!base || base.scheme === "upto") return null;
    const units = base.amount ?? base.maxAmountRequired;
    return units ? usdcUnitsToUsd(units) : null;
  } catch {
    return null;
  }
}

// ---------- Reppo lite evaluation (independent second opinion) ----------

export function reppoLiteRequest(input: { payload: string; context: string; criteria: string[] }): SellerRequest {
  return {
    endpointId: "reppo.lite",
    url: ep("reppo.lite").url,
    method: "POST",
    body: { type: "answer", payload: input.payload.slice(0, 45_000), criteria: input.criteria.slice(0, 10), context: input.context.slice(0, 30_000) },
  };
}

export interface LiteVerdict {
  decision: "accept" | "revise" | "reject" | null;
  score: number | null;
  confidence: number | null;
  critiques: string[];
  evaluators: number;
  evalId: string | null;
}

/** Read a lite evaluation: same shape as a Reppo read, with a settled result. */
export function readLiteVerdict(body: unknown): LiteVerdict {
  const b = (body ?? {}) as Record<string, unknown>;
  const result = (b.result ?? {}) as Record<string, unknown>;
  const d = String(result.decision ?? "").toLowerCase();
  const verdicts = Array.isArray(result.verdicts) ? (result.verdicts as Record<string, unknown>[]) : [];
  const peers = Array.isArray(b.peerAssessments) ? (b.peerAssessments as Record<string, unknown>[]) : [];
  const critiques = [...verdicts.map((v) => v.critique ?? v.reason), ...peers.map((p) => p.critique)]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.slice(0, 300))
    .slice(0, 4);
  return {
    decision: d === "accept" || d === "revise" || d === "reject" ? d : null,
    score: typeof result.score === "number" ? result.score : null,
    confidence: typeof result.confidence === "number" ? result.confidence : null,
    critiques,
    evaluators: peers.length || (typeof b.peerAssessmentCount === "number" ? b.peerAssessmentCount : 0),
    evalId: typeof b.evalId === "string" ? b.evalId : typeof b.id === "string" ? b.id : null,
  };
}
