# Submission checklist: Errand on Celo

Submit on Loops House by **Sun 6 Dec, 18:00 Lagos** (hard close Mon 7 Dec, 09:00 GMT / 10:00 Lagos). Platforms usually allow edits after submitting, so submit early and improve.

## 1. Hard requirements (miss one and the track doesn't score)

- [ ] Every counted tx is on **Celo mainnet** and carries `celo_511bb691f2f0` (checked with `verifyTx`, outputs in `evidence/celo/`).
- [ ] Agent registered on **ERC-8004** (`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`) from the agent wallet. `agentId` and tx hash in the README.
- [ ] **Self Agent ID** registered for the agent (required for the Self track). `agentId` in the README.
- [ ] Agent wallet entered on Loops (same one all event). x402 **PayTo** registered.
- [ ] Public GitHub repo, `celo` branch, still resolves at judging.
- [ ] Corridors: at least one tagged **Textile FX** conversion in a listed corridor, **in the product flow** (RFQ id + tx hash).
- [ ] Corridors: cNGN payments **reached recipients outside the team** (tx hashes; recipient consent to be listed).
- [ ] No arbitrage, no self-trading, not acting as a Textile maker.
- [ ] Altana: Errand acts from a non-custodial Altana wallet under a session key with cap + allowlist + expiry, and revoke works in one tx (grant tx, execute txs, revoke tx).
- [ ] Self: Errand Guard decides who gets served/limited with Self Agent ID, payments through x402. Show one accepted and one rejected/limited agent.
- [ ] All tracks selected that we enter (Altana, Corridors, Self; Agent Vault only if the stretch works).
- [ ] **Public post from Benjamin on X** with the demo clip and the repo link, tagging **@selfxyz** and **@Celo** (stated as a requirement on the Self livestream, 24 Nov). Do it for the Self track too, to be safe.

## 2. Description (lead with the problem, plain words)

Answer these five fast, at the top (playbook):
1. What problem? (people pay in Naira; agents with keys are a risk; caps alone aren't enough)
2. Who has it? (the **named** real users, with permission, and how we reached them)
3. Does it work? (live link, mainnet tx links, `verifyTx` proof)
4. Why better/different? (onchain cap + allowlist + revoke **and** a guard on every payment; Self-gated guard for other agents)
5. Would someone use it? (real runs, counts from `evidence/celo/runs.md`)

Also include, because the FAQ asks:
- Where users and volume came from.
- **Gas architecture:** the Altana relay sends the txs and charges its fee from the user's own wallet (CELO or a stablecoin). Say whether any gas was sponsored by us (sponsored gas is not a builder contribution).
- That Errand existed before 20 Nov (SERV Hackathon 02) and exactly what was built during this event: compare tag `pre-celo-hackathon` with the `celo` branch.

## 3. Judging map (put evidence where judges look)

| Criterion | Weight | Evidence |
|---|---|---|
| Quality of execution / integration | 25% / 30% | Live app, tests in CI, guarantees table, `verifyTx` outputs |
| Value proposition / innovation | 25% / 30% | Problem + one-line pitch; benchmark (caps alone vs Errand) |
| Traction with tagged onchain activity / real use | 25% / 15% | Tagged tx count, independent wallets, buy calls, paid guard calls |
| Named user, real job done | 25% / 25% | Named users (with consent), the errand they ran, recipient confirmation |

## 4. README (cadence structure)

One-line pitch · demo video + live links up top · contents · problem · what it does · try it (judges start here) · how it works (Mermaid architecture, errand flow, state diagram) · guarantees table · verified onchain evidence (ERC-8004 agentId, Self agentId, grant/execute/revoke txs, Textile RFQ + swap, cNGN payouts, guard payments) · tech stack · run it yourself (tested in a fresh folder, PowerShell commands) · testing · project layout · known limitations (honest, including any spike that failed) · build log · credits.
Mark only what ran for real as **Live**.

## 5. Demo video (under 3:00 unless the form says otherwise)

| Part | Time | Content |
|---|---|---|
| Problem | 20–30 s | Open with the named user and a real moment (e.g. paying a supplier in Naira) |
| Solution | 15 s | One sentence: the pitch |
| Demo | ~90 s | One real journey on mainnet: grant session → errand → Textile quote → swap → cNGN arrives → receipt with Celoscan → revoke → next attempt refused |
| Self moment | 15–20 s | A verified agent pays Errand Guard and gets served; an unverified one gets limited |
| How it works | 20–30 s | Diagram: Altana session, guard, Textile, tags |
| What's next | 10–15 s | From the parking lot |

Script at ~130 words/min, captions, notifications off, browser zoom ~125%, finish 10 s under the limit, unlisted link tested in a private window.

## 6. Final checks (Sun 6 Dec)

- [ ] Main journey works on desktop and phone, on mobile data.
- [ ] No secrets in the repo or visible in the browser (`git log -p | Select-String "PRIVATE_KEY"` returns nothing meaningful; keys only in host dashboards).
- [ ] Every link opened from another device / private window.
- [ ] Self-evaluation with the Loops skill done; biggest gap fixed.
- [ ] Every public link points at https://errand-thgw.vercel.app (errand-pearl.vercel.app only redirects there).
