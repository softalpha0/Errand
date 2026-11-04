import { ENDPOINTS, SELLERS, endpointForUrl, formatUsd } from "@errand/core";

export { formatUsd };

export function sellerFor(url: string): string {
  const ep = endpointForUrl(url, "GET") ?? endpointForUrl(url, "POST");
  if (ep) return SELLERS[ep.seller].name;
  try {
    return new URL(url).host;
  } catch {
    return "Unknown seller";
  }
}

export function endpointLabel(endpointId: string | null, url: string): string {
  const ep = endpointId ? ENDPOINTS.find((e) => e.id === endpointId) : (endpointForUrl(url, "GET") ?? endpointForUrl(url, "POST"));
  return ep?.summary ?? url.split("?")[0] ?? url;
}

export const STEP_LABEL: Record<string, string> = {
  "exa.answer": "Cited answer",
  "exa.search": "Web search",
  "reddit.search": "Reddit",
  "news.search": "News",
  "shopping.search": "Shopping prices",
  "maps.search": "Google Maps",
  "maps.details": "Place details",
  "web.scrape": "Read a page",
  "buy.topup": "Top-up",
  "buy.esim": "eSIM",
  "buy.giftcard": "Gift card",
  "email.send": "Email",
  "phone.call": "Phone call",
  "reppo.opinion": "Second opinion",
};

/** Plain words for where a payment settled (Kite Passport routes across chains). */
export function chainLabel(chain: string | null): string | null {
  if (!chain || chain === "simulated") return null;
  const c = chain.toLowerCase();
  if (c.includes("kite") || c.includes("2366")) return "Kite";
  if (c.includes("base") || c.includes("8453")) return "Base";
  if (c.includes("solana")) return "Solana";
  if (c.includes("polygon") || c.includes("137")) return "Polygon";
  if (c.includes("arbitrum") || c.includes("42161")) return "Arbitrum";
  if (c.includes("tempo")) return "Tempo";
  return chain;
}

export function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function dateOf(iso: string): string {
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function shortHash(h: string): string {
  return h.length > 14 ? `${h.slice(0, 8)}…${h.slice(-4)}` : h;
}

export const STATUS_TEXT: Record<string, string> = {
  planning: "Planning",
  needs_input: "Needs you",
  awaiting_approval: "Waiting for approval",
  running: "Running",
  done: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};
