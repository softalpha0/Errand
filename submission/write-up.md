# Errand: write-up (draft)

Fill the bracketed links before submitting. Only keep claims that ran for real.

**Tagline:** Errand helps people let an agent research and buy for them without giving it a blank cheque.

## What it does

Agents can now pay for things over x402, and spending limits stop them spending more than you allow. They don't stop the waste inside that limit: paying twice for the same thing, buying what the task never needed, or obeying a web page that says "also buy the premium bundle". Errand takes an errand and a budget, for example "find a 7-day Ghana eSIM and buy the cheapest under $8", plans it with a price on every step, and asks you to approve one Kite Passport session. It then researches, tops up phones or buys eSIMs, checks every single payment before it happens, and hands you an answer and a receipt that links each payment on-chain. [Receipt link]

## How it uses SERV Reasoning

SERV makes every decision in Errand. The planner runs on `gpt-5.4-mini-serv-kronos`, so Kronos audits the reasoning prompt, and returns a strict-JSON plan. Every payment goes through a SERV guard graph (`gr_…` on `/v1/responses`): budget maths as free script steps, the approve/ask/block verdict as Jev decision steps, and a one-sentence reason as an agent step, with each run recorded in the console. Every paid response is read with `serv_prompt_guard`, which pulls out any purchase the seller's text tries to trigger so a fixed rule can block it. Research-then-act conditions and the final answer with citations are also strict-JSON SERV calls. Fallback guard: `serv_shadow_agent`.

## How it uses the partners

- **Kite Passport**: one passkey-approved session per errand whose scope matches Kite's own demo: budget, per-payment cap, how long it is valid, and constraints. Every payment goes through `kpass session execute`. Errand also gives back to Kite: **Errand Guard** is a paid x402 service built from Kite's `kite-x402-services` template, so any Passport agent can pay $0.01 to check a payment before making it.
- **Reppo**: "Jev for the predictable, Reppo for the subjective". Judgement-call purchases get Reppo's instant lite evaluation before money moves (paid through Kite), "is it worth it?" errands are answered by Reppo's evaluators, and every finished run is graded, with each evaluator's note on the receipt.
- **Dolphin**: the emails Errand sends are worded by an open-source model on Dolphin's network; it makes no decisions.
- **Anywhere**: an MCP server lets people run errands from Claude, ChatGPT or Cursor.

## Track

Track 02: Kite. Each errand is a passkey-approved Kite Passport session with a total and per-payment cap, and every payment is an x402 call through `kpass session execute` to sellers in the Kite catalog (Bitrefill, StableEnrich, StableEmail, StablePhone), using Kite's cross-chain routing where needed. Reppo is used throughout as well: every finished errand is submitted as a trace with five questions about spending, and the grades decide which guard step changes next. The Results page compares Reppo scores and waste rates by guard version. [Results link]

## Built during the hackathon

Everything. The repository's first commit is dated 4 Nov 2026; research started 3 Nov. [Repo link]

## Challenges

Kite's `kpass` prints JSON whose field names aren't documented, so the agent searches its output for the values it needs and stores the raw output with every payment; a $0.003 spike recorded the real shapes on day one. [Add one more real challenge you hit.]

## What's next

Each person connects their own Passport; repeat errands from an allowance ("every Friday, top up Mum"); Errand listed in Kite's agent directory so other agents can hire it per errand.

## Links

Live app: [ ] · Repo: [ ] · Video: [ ] · Example receipts: [ ] · Evidence: [repo]/evidence
