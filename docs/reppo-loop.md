# Reppo feedback loop

Facts from `https://eval.reppo.xyz/agents.md` (read 10 Nov 2026; Reppo replaced its earlier API that month):

- `POST /api/v1/agents/evals` with `{ taskType, input }`. Errand uses `taskType: "action"` (an agent action, including what the user asked for). `input` is text, at most 50 KB.
- `GET /api/v1/agents/evals/{id}`: `QUEUED`, `PROCESSING`, then `COMPLETED` or `FAILED`. A panel of independent evaluators scores it, usually within 30-90 seconds.
- A completed result has `score` (0-100), `decision` (accept / reject), `confidence` (low / medium / high), `route` (ship / review / block), a one-paragraph `reason`, `rubric_scores`, and a `trace` with each evaluator's scores and reasoning.
- 440 credits per text evaluation, charged only when it completes. `402` = out of credits. Several can be in flight at once.
- The old endpoints (`eval-requests/submit`, `x402/evals/lite`, the `Sandbox` header) now return 404.

## Two uses

1. **Second opinions, before money moves.** A buy or call step with `secondOpinion: "yes"` (a gift, "the best", "worth it", which restaurant) sends the proposed action to Reppo and waits up to about 2.5 minutes. `ship` goes ahead; `review` or `block` comes back to the user with Reppo's reasoning and a Go ahead / Stop here question. If Reppo can't answer (no key, out of credits, timeout), Errand asks the user instead of guessing. `reppo.opinion` steps ask Reppo to judge a researched answer to a subjective question.
2. **Grading every finished errand.** When an errand finishes it is marked `QUEUED`. The worker (`apps/agent/src/reppo.ts`) sends the trace (task, plan, every payment decision with its reason, every payment, the answer) with five questions about how the money was spent, polls every 10 seconds, and puts the score, route, reasoning, rubric and each evaluator's note on the receipt.

Errand pays Reppo from its own credits (`REPPO_API_KEY`), so neither use costs the user anything, and second opinions no longer go through Kite.

## Privacy

Every errand (web, repeat, Telegram, MCP) goes to Reppo; there is no opt-out since 10 Nov. Traces never include keys, raw kpass output, full phone numbers or emails (`redact()`). Errands made before 10 Nov as "private" keep their old behaviour.

## How the grades change Errand

Reppo's grades decide what changes in the SERV guard graph (see `docs/serv-guard-graph.md`):

| Low score on | Likely guard step | Change to test |
|---|---|---|
| 1. necessary | step 5 "already answered" | tighten the hint; compare facts before research calls |
| 2. used | planner + step 2 | fewer, more targeted research steps |
| 4. refused | step 4 "steered by seller text" | broaden what counts as steering |
| 3. cost | step 6 ask threshold | ask earlier on large shares of the budget |

Each change gets a new `SERV_GUARD_VERSION`, and the Results page groups average Reppo score, accept rate, waste rate and cost per accepted answer by version. That is the "measurable improvement" for the write-up.

## Budget

- 22,000 sign-up credits = about 50 evaluations. An evidence batch of 10 errands on guard-v1 and 10 on guard-v2 is 20 x 440 = 8,800 credits, and with 30-90 second settlement it finishes in well under an hour.
- `402` pauses the grading worker; buy more credits at eval.reppo.xyz/billing.

## Check it once

`pnpm spike:reppo` grades a hand-written errand trace for real (440 credits), polls until it completes, saves the raw answer to `evidence/raw/reppo-sample-verdict.json` and prints what Errand reads from it. Run it once after setting `REPPO_API_KEY`, and adjust `readEvaluators()` in `reppo.ts` if the trace has a different shape.
