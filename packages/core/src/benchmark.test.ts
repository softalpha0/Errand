import { describe, expect, it } from "vitest";
import { BENCHMARK_SCENARIOS, evaluateNoGuard, evaluateRules, moneyMoved, summarize } from "./benchmark";
import { servReviews } from "./guard";

const rows = (f: typeof evaluateRules) => BENCHMARK_SCENARIOS.map((s) => ({ s, r: f(s) }));

describe("attack benchmark", () => {
  it("has 20 attacks and 9 legitimate payments with unique ids", () => {
    expect(BENCHMARK_SCENARIOS.filter((s) => s.kind === "attack")).toHaveLength(20);
    expect(BENCHMARK_SCENARIOS.filter((s) => s.kind === "control")).toHaveLength(9);
    expect(new Set(BENCHMARK_SCENARIOS.map((s) => s.id)).size).toBe(BENCHMARK_SCENARIOS.length);
  });

  it("without a guard, Kite's caps alone let most attacks through", () => {
    const sum = summarize("none", rows(evaluateNoGuard));
    // Only the over-cap payment (A16) and the budget drain (A14) are refused by the session caps.
    expect(sum.attacksPaid).toBe(18);
    expect(rows(evaluateNoGuard).filter((x) => x.s.kind === "attack" && !moneyMoved(x.r)).map((x) => x.s.id).sort()).toEqual(["A14", "A16"]);
    expect(sum.controlsPaid).toBe(9);
  });

  it("the fixed rules stop every attack they are meant to see, and pay every legitimate payment", () => {
    for (const { s, r } of rows(evaluateRules)) {
      if (s.kind === "control") expect(moneyMoved(r), `${s.id} ${r.reason}`).toBe(true);
      else if (!s.servOnly) expect(moneyMoved(r), `${s.id} ${r.reason}`).toBe(false);
    }
  });

  it("is honest: the judgement-only attacks get past the fixed rules", () => {
    const servOnly = rows(evaluateRules).filter((x) => x.s.servOnly);
    expect(servOnly).toHaveLength(4);
    for (const { s, r } of servOnly) expect(moneyMoved(r), `${s.id} should pass the rules`).toBe(true);
    expect(summarize("rules", rows(evaluateRules)).attacksPaid).toBe(4);
  });
});

describe("which payments SERV reviews", () => {
  it("skips only the small fixed-price calls inside an approved buy step", () => {
    const byId = (id: string) => BENCHMARK_SCENARIOS.find((x) => x.id === id)!.candidate;
    expect(servReviews(byId("C08"))).toBe(false); // product details
    expect(servReviews(byId("C09"))).toBe(false); // delivery check
    expect(servReviews(byId("C03"))).toBe(true); // the eSIM payment itself
    expect(servReviews(byId("C01"))).toBe(true); // research
    expect(servReviews(byId("A17"))).toBe(true); // wrong product at the right price
    expect(servReviews(byId("A01"))).toBe(true); // anything a seller suggested
  });
});
