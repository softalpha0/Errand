import type { Errand, PassportPublic, StandingErrand } from "@errand/core";
import { readPassportToken } from "./passport";

export const AGENT_URL = (process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8787").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    // The person's own Kite Passport connection, if they made one on /connect.
    const token = readPassportToken();
    res = await fetch(`${AGENT_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(token ? { "x-passport-token": token } : {}), ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("We couldn't reach the Errand agent. Check your connection and try again.", 0);
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(body.error ?? `The agent returned ${res.status}.`, res.status);
  return body as T;
}

export interface AgentConfig {
  mode: "live" | "demo";
  maxBudgetUsd: number;
  accessCodeRequired: boolean;
  guardVersion: string;
  telegram?: boolean;
}

export type Privacy = "public" | "private";

export interface ErrandSummary {
  id: string;
  task: string;
  status: Errand["status"];
  mode: Errand["mode"];
  createdAt: string;
  budgetUsd: number;
  metrics: { spentUsd: number; paid: number; blocked: number; wasteRate: number; reppoScore: number | null };
  evaluation: { status: string; score: number | null; decision: string | null } | null;
}

export interface StatsResponse {
  byVersion: {
    guardVersion: string;
    errands: number;
    graded: number;
    avgReppoScore: number | null;
    acceptRate: number | null;
    avgWasteRate: number;
    costPerAcceptedUsd: number | null;
  }[];
  series: { id: string; at: string; guardVersion: string; mode: string; spentUsd: number; wasteRate: number; reppoScore: number | null; blocked: number; paid: number }[];
}

export const api = {
  config: () => request<AgentConfig>("/config"),
  create: (
    input: { task: string; budgetUsd: number; maxPerPaymentUsd: number; email?: string; validFor?: "1h" | "24h" | "7d"; askAboveUsd?: number | null; privacy?: Privacy; country?: string },
    accessCode?: string,
  ) =>
    request<{ id: string }>("/errands", { method: "POST", body: JSON.stringify(input), headers: accessCode ? { "x-access-code": accessCode } : {} }),
  get: (id: string) => request<Errand>(`/errands/${encodeURIComponent(id)}`),
  list: (limit = 20) => request<ErrandSummary[]>(`/errands?limit=${limit}`),
  answer: (id: string, questionId: string, answer: string) =>
    request<{ ok: true }>(`/errands/${encodeURIComponent(id)}/answer`, { method: "POST", body: JSON.stringify({ questionId, answer }) }),
  approveDemo: (id: string) => request<{ ok: true }>(`/errands/${encodeURIComponent(id)}/approve`, { method: "POST" }),
  cancel: (id: string) => request<{ ok: true }>(`/errands/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
  stats: () => request<StatsResponse>("/stats"),
  streamUrl: (id: string) => `${AGENT_URL}/errands/${encodeURIComponent(id)}/stream`,

  // Each person's own Kite Passport
  passportLogin: (email: string) => request<{ passportId: string; expiresAt: string | null; simulated: boolean }>("/passport/login", { method: "POST", body: JSON.stringify({ email }) }),
  passportVerify: (passportId: string, code: string) => request<{ token: string; passport: PassportPublic }>("/passport/verify", { method: "POST", body: JSON.stringify({ passportId, code }) }),
  passportMe: () => request<PassportPublic>("/passport/me"),
  passportShipping: (s: ShippingForm) => request<{ complete: boolean; missing: string[] }>("/passport/shipping", { method: "POST", body: JSON.stringify(s) }),
  passportLogout: () => request<{ ok: boolean }>("/passport/logout", { method: "POST" }),

  // Standing errands, paid from the Kite allowance
  standingCreate: (
    input: { task: string; every: "day" | "week"; capPerRunUsd: number; maxPerPaymentUsd: number; email?: string; privacy?: Privacy; country?: string },
    accessCode?: string,
  ) => request<{ id: string; errandId: string }>("/standing", { method: "POST", body: JSON.stringify(input), headers: accessCode ? { "x-access-code": accessCode } : {} }),
  standingList: () => request<StandingErrand[]>("/standing"),
  standingRun: (id: string, accessCode?: string) =>
    request<{ errandId: string }>(`/standing/${encodeURIComponent(id)}/run`, { method: "POST", headers: accessCode ? { "x-access-code": accessCode } : {} }),
  standingState: (id: string, state: "active" | "paused" | "stopped") =>
    request<StandingErrand>(`/standing/${encodeURIComponent(id)}/state`, { method: "POST", body: JSON.stringify({ state }) }),
};

export interface ShippingForm {
  name: string;
  email: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal: string;
  country: string;
  phone: string;
}
