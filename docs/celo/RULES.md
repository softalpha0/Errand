# Hackathon rules: Agents Open for Business (Celo · Loops House)

Source of truth: https://www.loops.house/agents-open-for-business (read 20 Nov and 23 Nov 2026) and the organiser email of 24 Nov 2026.
If the event page changes, the page wins. Update this file and note it in AGENTS.md → Decisions.

## The brief

Start with a task a real person or business needs done, build the agent that does it, and show it working on **Celo mainnet** with **tagged onchain activity**.

## Dates (GMT; Lagos is GMT+1)

| When | What |
|---|---|
| Fri 20 Nov, 14:00 | Build opens, kickoff livestream |
| Mon 24 Nov, 14:00 | Self livestream (Agent Vault and Self Agent ID tracks). https://www.youtube.com/watch?v=ccos5Dak-Pk *(moved from 1 Dec, organiser email 24 Nov)* |
| Tue 25 Nov, 14:00 | Altana livestream (Altana track). https://www.youtube.com/watch?v=MYMouKWtOQM *(moved from 24 Nov)* |
| Thu 26 Nov | **AskBots review round 1** (first batch; register the project on the hackathon page before it) *(moved from 24 Nov)* |
| Thursdays, 12:00 | Office hours with Celo DevRel. Sign up: https://luma.com/1zx5u8ga |
| Thu 3 Dec, 14:00 | Stablecoin Corridors livestream |
| Fri 4 Dec | **AskBots review round 2** (snapshot of submitted projects) |
| **Mon 7 Dec, 09:00 GMT (10:00 Lagos)** | **Submissions close** |
| Fri 11 Dec | Winners announced |

The organisers said on the kickoff stream that livestream dates may be updated. Follow @Celo and @CeloDevs on X.

## Rules (verbatim intent from the page)

1. Celo mainnet only (testnet references in the repo are fine).
2. Every entry registers its agent on **ERC-8004** (required). **Self Agent ID** is recommended, and **required for the Self Agent ID track**.
3. Public GitHub repo at registration that still resolves at judging.
4. An **attribution tag in every transaction** you want counted. x402 sellers also register their **PayTo address**.
5. Code is written during the hackathon, from 20 Nov. **Confirmed for Errand:** existing projects are allowed as long as the new work is written during the hackathon (kickoff stream + Benjamin's check with the organisers). Keep all Celo work in dated commits on the `celo` branch. The tag `pre-celo-hackathon` marks the starting point.
6. Enter as many tracks as you want; a project can win in **up to two** tracks, one placement per track.
7. Sponsored gas is not a builder contribution.
8. Paying for services on **buy** is optional; paid calls on buy from your agent count in your favour as real use.

## Errand's entry facts

| Item | Value |
|---|---|
| Builder | Benjamin Ugochukwu, solo (a team would change the tag) |
| Attribution tag | `celo_511bb691f2f0` (issued by Loops House on enrol, 20 Nov 2026) |
| Repo | https://github.com/softalpha0/Errand · branch `celo` · start tag `pre-celo-hackathon` |
| Agent wallet | **Not chosen yet.** Entered later (at submission, or with the Celo button in the Loops playground). Keep the **same one for the whole event**: the score is tied to it. Register its ERC-8004 identity from that wallet. |
| SERV hackathon constraint | `main`, the live app `errand-pearl.vercel.app`, and the existing Render services stay untouched (organiser asked not to interfere with the submission build). |

## Tracks

| Track | Sponsor / judge | Prizes | What to build |
|---|---|---|---|
| Stablecoin Corridors | Textile FX · judged by Textile and Celo Core Co. | 1st $1,000 · 2nd $600 · 3rd $400 | Agents that pay, get paid, or pay out in local stablecoins, converting on Textile FX between USD₮ and cNGN, IDRX, or Ripio's wFIAT (wARS, wBRL, wMXN, wCOP) |
| Agent Vault: Online & Onchain Checkouts | Self · judged by Self | 1st $700 · 2nd $300 | Agents that sign in, check out, and pay on regular websites with Agent Vault, without seeing the card or password, and pay onchain with x402 |
| Self Agent ID: Verified Agent Payments | Self · judged by Self | 1st $700 · 2nd $300 | Services where Self Agent ID decides which agents get served, paid, or limited, with payments through x402 |
| Altana Agent Wallets | Altana · judged by Altana | 1st $750 + 25,000 XP · 2nd $250 + 10,000 XP · product reviews earn 5,000 XP each, up to 10, one per team | Agents that act from a non-custodial Altana wallet under a session key a person grants: a spend cap, an allowlist of contracts it can call, and an expiry, enforced onchain and revocable in one transaction |

Prizes are set in USD and paid in **CELO** to the registered payout wallet. Altana XP goes to the Altana wallet.

### Stablecoin Corridors: requirements (a project that misses one is not scored in the track)

1. At least one **tagged Textile FX conversion on Celo mainnet** in a listed corridor, **used in the product flow**.
2. Payments in a local stablecoin **reach a recipient outside the team**.
3. ERC-8004 identity.
4. Arbitrage, self-trading, and acting as a Textile maker do not count.

The other three tracks list no extra written requirements beyond their description. Self Agent ID is required for the Self Agent ID track.

## How winners are decided

| Tracks | Criteria |
|---|---|
| Stablecoin Corridors, Altana Agent Wallets | Quality of execution · a clear value proposition · initial traction with tagged onchain activity · a named user with a real job done (**25% each**) |
| Agent Vault, Self Agent ID | Quality of the integration (**30%**) · innovation and value proposition (**30%**) · a named user and a real job done (**25%**) · real use (**15%**) |

- Celo DevRel shortlists from onchain data and the Loops judge's reading of the repo.
- Judges test the live product ("not for demos… we test it all… we're breaking it", kickoff stream).

## FAQ answers that change how we build

| Topic | Answer from the page |
|---|---|
| Independent user | A wallet outside your team that isn't funded by you or your main funder. New and existing Celo users both count. An agent wallet with its own ERC-8004 identity, registered by a different team, also counts when it pays you. Liquidity pools, routers, Textile makers and exchange wallets don't count. Arbitrage and self-trading score zero. Activity is reviewed before judging. |
| Sponsored gas | Users still count: signers and authorisers are counted, not only gas payers. Gas your relayer pays doesn't count as your own contribution, so describe the architecture in the submission. |
| New users | Welcome. Say who they are and how you reached them. |
| Attribution tag | Short ERC-8021 code appended to the calldata of every transaction, in the code that builds/sends transactions (frontend or agent backend), **not** the smart contract. Can't be added later. For Textile FX: request quotes with your wallet and append the tag to `transactions.swap.data` before sending; with a Textile API key leave `includeAttribution` off. **x402 payments don't carry tags yet**, so register the PayTo address at sign-up. Guide: github.com/celo-org/attribution-tags |
| Something looks wrong | Raised privately first; 48 hours to reply. No one is disqualified from a dashboard. Explain where users and volume came from. |
| Stablecoins to build with | Celopedia (celopedia.celo.org). Ripio wFIAT ramps at ramp.ripio.com. cNGN at cngn.co. Textile FX converts between USD₮ and cNGN, IDRX, wFIAT. |
| buy | Celo Core Co.'s agent service marketplace. `npm install -g @celo/buy` (Node 22+). |
| x402 facilitator | Celo-hosted at x402.celo.org. Free settlement credits for new accounts, then gas plus 0.3% of the amount settled. |
| Support | Telegram https://t.me/celoagenthackathons · office hours Thursdays 12:00 GMT · Self's and Altana's own channels |
| After | Prezenti Grants Frontier pool: $45,000 for AI and agent infrastructure on Celo, grants up to $15,000, applications until 29 Dec |

## Self livestream notes (Mon 24 Nov, Self team + Celo DevRel)

Track requirements as stated on the stream (the event page still wins if it differs):

**Agent Vault track:** the agent signs in or checks out on at least one regular website through Agent Vault · at least one x402 payment on Celo · a spending limit or rule in Agent Vault, and **the demo shows what happens when the agent hits it** · the agent never sees the card number or password in the demo · ERC-8004 identity · **a public post from a team member** with a demo clip (YouTube or X) and the open-source repo link, **tagging Self and Celo**. Quick checkout works on Amazon in the US and 7 countries in North/South America (Nigeria not mentioned).

**Self Agent ID track:** Self Agent ID proves a unique real person stands behind an agent without sharing personal data; every request the agent sends is signed, so an API, merchant or Celo contract can check it **with no API key**. Build a service where Self Agent ID decides who gets served, paid or limited, with payments through x402 on Celo. Ideas named: know-your-agent (KYA) gateway, age check, agent checkout, dispute kit, fair cashback on MiniPay, agent passport. Judging: quality of integration, innovation and value, a named user with a real job done, real use.

Other points from the stream:
- Paid calls from your agent to services on **buy** count in your favour as real use (700+ services, Agent Vault can pay them).
- **Nigerian passports work** in the Self app now (an earlier issue was fixed). Supported documents per country: https://maps.self.xyz
- One project may enter **both Self tracks**.
- Self recommends installing the **Self MCP and Self docs MCP** in the coding agent. Support and feedback: Self's Discord.
- AskBots round 1 runs **Thursday** on submitted projects; reviews arrive as GitHub issues on the repo.
- The Altana livestream was announced as "tomorrow, same time" (the email says Tue 25 Nov, 14:00 GMT; one speaker said 9 a.m. GMT, which is likely a time-zone slip). Use the email time.

## Altana livestream notes (Tue 25 Nov, Altana co-founder + Celo DevRel; Benjamin watched the recording transcript)

- What Altana wants in its track: **outstanding UX**, "real problems with an innovative twist" (simple is fine), passkeys and mobile-friendly flows, and (moonshot) new DeFi primitives for agentic finance. Advice: "show, don't tell": the demo carries the pitch.
- **Remittances are named as an Altana use case**: a remittance that "can only be used for this, in these specific cases" through session limits. That is Errand's pitch; say it in those words in the video.
- Celo DevRel wants LatAm stablecoin ↔ USD₮ liquidity and combinations with Textile FX and Self. Errand already combines Altana + Textile + Self.
- Judging repeated: quality of execution · clear value proposition · initial traction with **tagged** onchain activity · a named user and a real job done.
- **Altana product reviews**: up to 10 per team (5,000 XP each); must be specific, reproducible, and posted new in Altana's SDK bug-report channel (Telegram). Errand's findings are candidates: no `dataSuffix`/attribution option on grant/revoke; `recoverFromPasskey` fails before the first tx; first grant needs 2 KeyStore fees (~19 CELO).
- **Altana XP page**: creating a smart agentic wallet and setting permissions earns 3K XP, open during the hackathon only. URL said aloud as "XP.network"; take the real link from the Loops track page or Altana's Telegram, don't guess it.
- Not answered on the stream: whether Altana grant/revoke txs can carry the attribution tag (Q2) or whether user-wallet session txs count (Q1). Ask in Altana's Telegram.
- Dates restated: office hours Thu 26 Nov; **AskBots round 1 reviews projects submitted by Thu 26 Nov morning**; second round next week; submissions close 7 Dec.

## Perks

**Faucets (Celo mainnet, open until 7 Dec, first come first served; also under Resources on the hackathon page):**
- CELO: https://app.faucetdrops.io/faucet/celo-agentic-hackathons-celo-3585 · code `PM2M4C` · 0.25 CELO per claim (deploys and transactions)
- USD₮: https://app.faucetdrops.io/faucet/celo-agentic-hackathons-usdt-c654 · code `QXO4ND` (third character is the letter O) · 0.10 USD₮ per claim (test x402 payments, buy calls)
- For Benjamin's own test/agent wallets only. Never point a user at them as "funding from Errand", and never count faucet-funded wallets as independent users.

**Free for 3 months:** Chainstack Growth Plan (claim the code on the hackathon page) · Agent Vault Plus (agentvault.io).


Two AskBots reviews (24 Nov, 4 Dec) · 3 months Agent Vault Plus · 3 months Chainstack Growth Plan · 700+ services on buy · weekly office hours.

## Loops House tooling

- Agent skill: `npx loopshouse add agents-open-for-business` (Node 20.12+, 22 LTS recommended). Run in the project directory. Lets the coding agent ideate, query sponsor knowledge graphs, manage the submission and self-evaluate against the judging criteria. Re-run to pick up the latest sponsors and deadlines.
- The tag is also shown on the event page, under the Celo button in the playground, and via `loops project get`.
