import { z } from "zod";
import { PLANNABLE_STEP_TYPES } from "./catalog";

export const StepTypeSchema = z.enum(PLANNABLE_STEP_TYPES);

/** A key/value input. Kept as a list so SERV's strict JSON schema can describe it. */
export const StepInputSchema = z.object({ key: z.string(), value: z.string() });

export const PlanStepSchema = z.object({
  id: z.string(),
  type: StepTypeSchema,
  purpose: z.string(),
  inputs: z.array(StepInputSchema),
  /** Most this step may spend in USD, including fees. */
  maxUsd: z.number().nonnegative(),
  /** Research-then-act: run this step only if this is true given earlier results. Empty = always. */
  condition: z.string(),
});

export const RecipientSchema = z.object({
  label: z.string(),
  phone: z.string(),
  email: z.string(),
});

export const PlanSchema = z.object({
  summary: z.string(),
  steps: z.array(PlanStepSchema).min(1).max(12),
  /** The user's scope in plain words: brand, colour, country, carrier, who it is for, deadline... */
  constraints: z.array(z.string()),
  recipients: z.array(RecipientSchema),
  /** Questions to ask the user before anything is paid. Empty = none. */
  questions: z.array(z.string()),
});

export type PlanStep = z.infer<typeof PlanStepSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type Recipient = z.infer<typeof RecipientSchema>;

export function stepInput(step: PlanStep, key: string): string | undefined {
  const v = step.inputs.find((i) => i.key === key)?.value;
  return v === undefined || v === "" ? undefined : v;
}

export const ErrandStatusSchema = z.enum([
  "planning",
  "needs_input",
  "awaiting_approval",
  "running",
  "done",
  "failed",
  "cancelled",
]);
export type ErrandStatus = z.infer<typeof ErrandStatusSchema>;

export type DecisionOutcome = "approve" | "block" | "ask";

export interface PaymentCandidate {
  stepId: string | null;
  endpointId: string | null;
  url: string;
  method: "GET" | "POST";
  body?: unknown;
  priceUsd: number;
  /** "plan" when the step came from the approved plan, "seller_content" when a seller's response suggested it. */
  origin: "plan" | "seller_content";
  recipient?: string;
  /** Planned product amount for invoice payments, in USD. */
  plannedProductUsd?: number;
  note?: string;
}

export interface GuardDecision {
  id: string;
  at: string;
  candidate: PaymentCandidate;
  decision: DecisionOutcome;
  rule: string;
  reason: string;
  source: "rules" | "serv";
  servRequestId?: string | null;
  servModel?: string | null;
}

export interface PaymentRecord {
  id: string;
  at: string;
  decisionId: string;
  stepId: string | null;
  endpointId: string | null;
  url: string;
  method: string;
  amountUsd: number;
  requestHash: string;
  txHash: string | null;
  explorerUrl: string | null;
  chain: string | null;
  simulated: boolean;
  /** Did the final answer use this result? Set by the summarizer. */
  used: boolean | null;
  raw?: unknown;
}

export interface StepResult {
  stepId: string;
  status: "pending" | "running" | "done" | "skipped" | "blocked" | "failed";
  note: string;
  /** Clean facts extracted from paid responses (after PromptGuard). */
  facts: string[];
  sources: { title: string; url: string }[];
  /** Purchases a seller's response tried to suggest. Every one is sent to the guard. */
  suggestions: string[];
  output?: Record<string, unknown>;
}

export interface Question {
  id: string;
  at: string;
  text: string;
  options: string[];
  answer: string | null;
  context: string;
}

export interface Assessment {
  agentName: string;
  modelName: string | null;
  score: number | null;
  decision: string | null;
  critique: string | null;
}

export interface Evaluation {
  evalId: string;
  status: "PENDING" | "SETTLED" | "DENIED" | "FAILED" | "QUEUED";
  submittedAt: string | null;
  minSettleAt: string | null;
  settledAt: string | null;
  score: number | null;
  decision: "accept" | "revise" | "reject" | null;
  confidence: number | null;
  verdicts: { criterion: string; verdict?: string; critique?: string; score?: number }[];
  /** The independent evaluators who graded this run (Reppo peer assessments). */
  assessments: Assessment[];
  sandbox: boolean;
  raw?: unknown;
}

export interface ErrandEvent {
  at: string;
  type:
    | "status"
    | "plan_ready"
    | "question"
    | "awaiting_approval"
    | "step"
    | "decision"
    | "payment"
    | "answer"
    | "evaluation"
    | "error"
    | "log";
  message: string;
  data?: unknown;
}

export interface Errand {
  id: string;
  createdAt: string;
  updatedAt: string;
  mode: "live" | "demo";
  task: string;
  budgetUsd: number;
  maxPerPaymentUsd: number;
  /** How long the Kite Passport session may be used. */
  validFor: ValidFor;
  /** Ask the user before any single payment above this amount. Null = only when the guard is unsure. */
  askAboveUsd: number | null;
  status: ErrandStatus;
  plan: Plan | null;
  guardVersion: string;
  kite: {
    requestId: string | null;
    sessionId: string | null;
    approvalUrl: string | null;
    approvedAt: string | null;
  };
  steps: StepResult[];
  decisions: GuardDecision[];
  payments: PaymentRecord[];
  questions: Question[];
  answer: { text: string; citations: { label: string; url: string }[] } | null;
  evaluation: Evaluation | null;
  events: ErrandEvent[];
  error: string | null;
}

export const VALID_FOR = ["1h", "24h", "7d"] as const;
export type ValidFor = (typeof VALID_FOR)[number];
export const VALID_FOR_LABEL: Record<ValidFor, string> = { "1h": "1 hour", "24h": "1 day", "7d": "7 days" };

export const CreateErrandSchema = z.object({
  task: z.string().trim().min(8, "Describe the errand in a sentence or two.").max(2000),
  budgetUsd: z.number().positive().max(50),
  maxPerPaymentUsd: z.number().min(0.01, "The per-payment limit must be at least $0.01: the cheapest paid call (a cited web answer) costs $0.01.").max(50),
  email: z.string().email().optional(),
  validFor: z.enum(VALID_FOR).default("1h"),
  askAboveUsd: z.number().positive().max(50).nullable().optional(),
});
export type CreateErrandInput = z.infer<typeof CreateErrandSchema>;

/** JSON schema handed to SERV structured outputs for the planner. Mirrors PlanSchema. */
export const PLAN_JSON_SCHEMA = {
  name: "errand_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "steps", "constraints", "recipients", "questions"],
    properties: {
      summary: { type: "string" },
      steps: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "type", "purpose", "inputs", "maxUsd", "condition"],
          properties: {
            id: { type: "string" },
            type: { type: "string", enum: [...PLANNABLE_STEP_TYPES] },
            purpose: { type: "string" },
            inputs: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["key", "value"],
                properties: { key: { type: "string" }, value: { type: "string" } },
              },
            },
            maxUsd: { type: "number" },
            condition: { type: "string" },
          },
        },
      },
      constraints: { type: "array", items: { type: "string" } },
      recipients: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "phone", "email"],
          properties: { label: { type: "string" }, phone: { type: "string" }, email: { type: "string" } },
        },
      },
      questions: { type: "array", items: { type: "string" } },
    },
  },
} as const;
