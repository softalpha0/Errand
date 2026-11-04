import type { Errand } from "@errand/core";

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
    res = await fetch(`${AGENT_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
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
}

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
    input: { task: string; budgetUsd: number; maxPerPaymentUsd: number; email?: string; validFor?: "1h" | "24h" | "7d"; askAboveUsd?: number | null },
    accessCode?: string,
  ) =>
    request<{ id: string }>("/errands", { method: "POST", body: JSON.stringify(input), headers: accessCode ? { "x-access-code": accessCode } : {} }),
  get: (id: string) => request<Errand>(`/errands/${encodeURIComponent(id)}`),
  list: (limit = 20) => request<ErrandSummary[]>(`/errands?limit=${limit}`),
  answer: (id: string, questionId: string, answer: string) =>
    request<{ ok: true }>(`/errands/${encodeURIComponent(id)}/answer`, { method: "POST", body: JSON.stringify({ questionId, answer }) }),
  approveDemo: (id: string) => request<{ ok: true }>(`/errands/${encodeURIComponent(id)}/demo-approve`, { method: "POST" }),
  cancel: (id: string) => request<{ ok: true }>(`/errands/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
  stats: () => request<StatsResponse>("/stats"),
  streamUrl: (id: string) => `${AGENT_URL}/errands/${encodeURIComponent(id)}/stream`,
};
