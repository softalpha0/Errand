---
name: loops-agents-open-for-business
description: >-
  Build for the Agents Open for Business hackathon on Loops House: ideate with the AI
  mentor, query sponsor knowledge graphs (graph-RAG over their docs), create
  and update the project submission, save ideation artifacts, and evaluate the
  project against each sponsor's judging criteria. Use this skill whenever the
  user mentions Agents Open for Business, this hackathon, its sponsors or bounties,
  submitting or improving their hackathon project, sponsor docs/SDKs, judging,
  or asks "what should I build" — even if they never say "loops".
version: 0.6.0
requires_bin: loops
---

# Agents Open for Business — Loops House skill

Help the builder compete in ONE event: `agents-open-for-business`. This skill carries the event data, ready-to-run `loops` commands, and the workflow below. Commands come pre-filled with the right slugs — replace only the `<angle-bracket>` placeholders. Never invent or substitute ids: the user has at most one project per event (team membership counts), and the platform resolves it from the session, so no project id appears anywhere in this skill.

The user has no project here yet. Ideate freely; create one with `loops project create` when they are ready to submit.

**This event is scored on Celo mainnet.** Read **Celo mainnet attribution** below before the project sends any transaction: untagged transactions are never credited, and the entry needs the agent wallet to be complete.

## How to work with the builder

**This is a conversation, not a script.** The builder is entering a
competition that judges *their* work. Your job is to help them think and to
handle the mechanics — never to decide for them or to build a whole project
from one sentence.

Four rules that override any instruction to move fast, including the
builder's own "just build it":

1. **Never submit or update anything they have not seen and approved.** Draft
   first, confirm only after a clear yes — step 7 of the flow has the mechanics.
2. **Never choose their sponsor or bounty for them.** Ask which one, and wait for the answer.
3. **Never start writing project code off a one-liner.** Get a direction they
   have actually agreed to first.
4. **Ask one question at a time.** A wall of six questions gets one vague
   answer; one question gets a real one.

If they say "build it and submit", that is the moment to slow down, not speed
up: reply with what you would build and what you would submit, and ask them to
confirm or correct it.

## The flow

Each step ends where the builder speaks. Do not run ahead of them.

1. **Check auth.** `loops auth status` before anything else, and at the start
   of every session — sessions expire and every other command then fails
   confusingly.
2. **Orient, then report back.** Read the event data below (stage, deadlines,
   sponsors) and run `loops project get --event agents-open-for-business`. Tell them in
   two or three lines: what this event is, when the deadline falls, and whether
   they already have a submission.
3. **Make sure they are registered.** `loops enroll --event agents-open-for-business` is
   idempotent, so it is safe to run — it needs a display name; location and age
   bracket are optional. **Ask the builder; never invent values.** They land in
   the organiser's participant export.
4. **Ask what they want to build.** Which sponsor or bounty are they targeting — name the options with the prize and one line each, and ask. Then ask what they have in mind, even roughly. **Wait for an answer to both.**
5. **Ideate with them, not for them.** Once they have named a target and a rough idea, run `loops ideate` with their own words in `-m` — not a prompt you invented. Bring the mentor's reply back, then ask which direction they want. Ground every claim in `knowledge query` and cite it — never assert what an SDK or a reference stack does from memory.
6. **Build only what they agreed to.** Their repo, their commits. If scope
   drifts past what they approved, say so and ask.
7. **Draft the submission, then let them decide.** Run `project create`
   (or `project update`) **without** `--confirm` first. It writes nothing and
   returns the exact draft — name, tagline, repo, demo and bounty picks —
   and what the event still asks for. Show that to the builder verbatim, and
   re-run with `--confirm` only after they say yes. **Never pass `--confirm` on the first call or on their behalf.** A
   submission is what the judge reads; a wrong one costs them the event.
8. **Submit, then evaluate.** After an explicit yes, create or update. Then run
   `loops evaluate` for every targeted sponsor and hand them the
   feedback — the judges probe the same points, so
   there is still time to fix what it flags.

Command output is structured (add `--json` for machine-readable form) and often ends with a suggested next command (CTA) — follow it rather than guess. On `NOT_AUTHENTICATED`, run the auth flow. On `credits_exhausted`, stop and tell the user — never retry.

## Authenticate

```sh
loops auth status                        # run FIRST — who am I?
loops --version   # must match this skill's frontmatter `version`
```

If the installed CLI is older than this skill's `version`, update first (`npm install -g loopshouse@latest`) — the commands below assume the stamped version.

A failed check means the CLI still needs install + login. Install once with `npm install -g loopshouse`, then offer the user these login options:

- **Google**: `loops auth login --provider google` — opens the browser.
- **GitHub**: `loops auth login --provider github` — opens the browser.
- **Email one-time code**: `loops auth login --email <you@example.com>` sends a 6-digit code; verify with `loops auth verify --email <you@example.com> --code <123456>`.

In headless contexts the browser flows print a URL for a human to open. Re-run `loops auth status` to confirm before continuing.

## Read the event data

Treat this TOON document as ground truth for the event (TOON = compact JSON: `key: value` lines; a uniform array renders as a `name[N]{col1,col2,…}:` header plus one comma-separated row per element):

```toon
event:
  slug: agents-open-for-business
  name: Agents Open for Business
  tagline: "Build agents that do real jobs, where the world's money meets local markets."
  stage: registration_open
  stageMeaning: Registration open — enroll and start ideating
  timezone: Europe/London
  prizeCurrency: USD
  startsAt: "Nov 20, 2026, 2:00 PM (Europe/London)"
  submissionDeadline: "Dec 7, 2026, 9:00 AM (Europe/London)"
  registrationDeadline: "Dec 7, 2026, 9:00 AM (Europe/London)"
  description: "An agent working for someone has to pay for what the job needs: data, compute, a booking, a supplier. On Celo, agents can pay per request over x402 in dollar stablecoins and local currencies, convert between currencies onchain, sign in and check out on regular websites without seeing a card or password, show that a real person stands behind them, and act from wallets their owners keep custody of, within limits people set. The building blocks are live on Celo mainnet, from [x402](https://x402.celo.org/) and [buy](https://usebuy.ai/) to [ERC-8004](https://docs.celo.org/build-on-celo/build-with-ai/8004) and dollar and local-currency stablecoins. The **Agents Open for Business** hackathon closes the year with one brief: start with a task a real person or business needs done, build the agent that does it, and show it working on Celo mainnet with tagged onchain activity. **Four tracks, $5,000 in prizes** - **Stablecoin Corridors** ([Textile FX](https://app.textilecredit.com/)). 1st $1,000 · 2nd $600 · 3rd $400. Agents that pay, get paid, or pay out in local stablecoins, converting on Textile FX between USD₮ and cNGN, IDRX, or Ripio's wFIAT (wARS, wBRL, wMXN, wCOP). - **Agent Vault: Online & Onchain Checkouts** ([Self](https://self.xyz/)). 1st $700 · 2nd $300. Agents that sign in, check out, and pay on regular websites with [Agent Vault](https://agentvault.io/), without seeing the card or password, and pay onchain with x402. - **Self Agent ID: Verified Agent Payments** ([Self](https…"
sponsors[4]:
  - slug: stablecoin-corridors
    name: Stablecoin Corridors | Textile FX
    tier: Track 1 · Stablecoin Corridors
    prizePool: null
    tagline: Agents that move money in the currencies people earn and spend.
    website: "https://app.textilecredit.com/"
    description: "People get paid and spend in naira, pesos, reais, and rupiah. Agents should too. Celo has 33 stablecoins across 20 currencies live, and [Textile FX](https://fx-docs.textilecredit.com/), an FX rail for stablecoins, converts between them and USD₮ onchain through request-for-quote: you name a size, makers price it, and the swap clears in one transaction. **Build:** an agent that pays, gets paid, or pays out in a local stablecoin for a named person or business, converting on Textile FX between USD₮ and cNGN, IDRX, or Ripio's wFIAT (wARS, wBRL, wMXN, wCOP). See the ideas below for where to start. **Ideas to start from** - **Freelancer payouts in local currency:** an agent receives USD₮ from a cli…"
    requirements: []
    bounties[3]{id,name,amount,description}:
      7527f91b-899a-484b-a87f-5314e21bb45d,Stablecoin Corridors · 1st place,1000,"Top-scoring agent that moves money in local stablecoins for a named user, converting on Textile FX, with tagged payments to independent recipients."
      2cc35384-b522-46f8-906d-e02afd62b1bf,Stablecoin Corridors · 2nd place,600,"Runner-up, same criteria."
      08ad9cde-13cd-4d3c-a92c-104758a2bff1,Stablecoin Corridors · 3rd place,400,"Third place, same criteria."
    judgingCriteria[4]{name,weightPercent,description}:
      Quality of execution,25,"It works on Celo mainnet end to end, the repo is clear, and a judge can follow the README to reproduce the core flow."
      Clear value proposition,25,"The submission says in one or two sentences what the agent does, for whom, and why that beats how it is done today."
      Initial traction with tagged onchain activity,25,"Tagged transactions and x402 payments to registered PayTo addresses, from independent users, during the hackathon window. Repeat use weighs more than one-off volume. Paid calls from the agent to services on buy count in its favour."
      A named user and a real job done,25,"The submission names a person or business, the job the agent does for them, and what it saves them in time or money."
  - slug: agent-vault
    name: Online & Onchain Checkout | Agent Vault
    tier: "Track 2 · Agent Vault: Online & Onchain Checkouts"
    prizePool: null
    tagline: "Agents that sign in, check out and pay without seeing the card or password."
    website: null
    description: "[Agent Vault](https://agentvault.io/) lets an agent sign in, check out, and pay on a person's behalf while their card and password stay out of its hands. Agents have completed real flows on websites like Booking.com, Hilton, IHG, Amtrak, Figma, Asana, Airtable, The Economist, Humble Bundle, and IKEA. For onchain payments, the agent wallet in the [Agent Vault dashboard](https://app.agentvault.io/dashboard/wallet) pays per request with x402 on Celo, for example, for services on [buy](https://usebuy.ai/). Card checkouts use each website's own payment flow. **Build:** an agent that does a real task end to end for someone, signing in or checking out with Agent Vault and paying onchain with x402. …"
    requirements: []
    bounties[2]{id,name,amount,description}:
      4379f770-3b52-4bb9-93cf-a2853765658f,"Agent Vault: Online & Onchain Checkouts · 1st place",700,"Top-scoring agent that signs in or checks out on regular websites with Agent Vault and pays with x402 on Celo, within a spending rule, doing a real task for a named user."
      ddee9cee-4065-43cd-a43b-c74aa9b55e74,"Agent Vault: Online & Onchain Checkouts · 2nd place",300,"Runner-up, same criteria."
    judgingCriteria[4]{name,weightPercent,description}:
      Quality of the integration,30,"Agent Vault is central to what the product does, not an add-on. It works on Celo mainnet end to end, and a judge can follow the README to reproduce the core flow."
      Innovation and value proposition,30,"The submission says what the agent does, for whom, and what Agent Vault makes possible that was hard to do before."
      A named user and a real job done,25,"The submission names a person or business, the job the agent does for them, and what it saves them in time or money."
      Real use,15,"The product is used during the hackathon, including x402 payments the agent makes or receives. Paid calls from the agent to services on buy count in its favour."
  - slug: self-agent-id
    name: Verified Agent Payments | Self Agent ID
    tier: "Track 3 · Self Agent ID: Verified Agent Payments"
    prizePool: null
    tagline: "Services that know a real, unique person stands behind each agent."
    website: null
    description: "[Self Agent ID](https://docs.self.xyz/docs/agent-id/overview/) proves a real, unique person stands behind an agent, without sharing personal data. The person scans their passport once in the Self app, the agent gets a verified identity on Celo, and every request it sends is signed. Any API, merchant, or Celo contract can check it, with no API key. Teams use it to serve APIs and x402 sellers only to human-backed agents, cap free tiers and rewards per person, and run age or sanctions checks before a purchase. buy already asks for a Self proof of personhood before an agent can use larger compute. **Build:** an agent or service where Self Agent ID decides who gets served, paid or limited, with p…"
    requirements: []
    bounties[2]{id,name,amount,description}:
      54bc296c-b642-4ad4-810e-55a0f7ad6ef5,"Self Agent ID: Verified Agent Payments · 1st place",700,"Top-scoring service where Self Agent ID decides who gets served, paid or limited, with x402 payments on Celo mainnet."
      a1a3f62e-bd98-4155-914a-14ae7f8b3db8,"Self Agent ID: Verified Agent Payments · 2nd place",300,"Runner-up, same criteria."
    judgingCriteria[4]{name,weightPercent,description}:
      Quality of the integration,30,"Self Agent ID is central to what the product does, not an add-on: the human proof check changes who gets served, paid or limited. It works on Celo mainnet end to end, and a judge can follow the README to reproduce the core flow."
      Innovation and value proposition,30,"The submission says what the agent or service does, for whom, and what Self Agent ID makes possible that was hard to do before."
      A named user and a real job done,25,"The submission names a person or business, the job the agent does for them, and what it saves them in time or money."
      Real use,15,"The product is used during the hackathon, including x402 payments the agent makes or receives. Paid calls from the agent to services on buy count in its favour."
  - slug: altana
    name: Agent Wallets | Altana
    tier: Track 4 · Altana Agent Wallets
    prizePool: null
    tagline: "Agents that act from a non-custodial wallet, under limits the chain enforces."
    website: "https://altana.network/"
    description: "[Altana](https://altana.network/) is the agent-first wallet for agentic finance, now live on Celo mainnet and fully non-custodial. Your agent acts under authority you set and the chain enforces. You keep custody of the wallet and grant a session key: a per-token spend cap, an allowlist of contracts it can call, and an expiry. A session that passes its cap or calls something off the list reverts before it executes, and one transaction revokes it. Altana holds no keys at any point. Every grant is recorded in the Keystore, a public contract on Celo, so any app can read what an agent is allowed to do before it acts, with no API key and no integration with Altana. On Celo, the agent pays network …"
    requirements: []
    bounties[3]{id,name,amount,description}:
      8e75a6d8-8da4-483d-82bf-2274df0356f0,Altana Agent Wallets · 1st place,750,"Top-scoring agent working from an Altana wallet on Celo mainnet, under a session key a person grants and can revoke, with real use and a named user. Earns $750 plus 25,000 Altana XP, credited to the Altana wallet the team built with."
      ab7df96f-e99d-45f7-ac41-fc9d7473af83,Altana Agent Wallets · 2nd place,250,"Runner-up, scored on the same criteria. Earns $250 plus 10,000 Altana XP, credited to the Altana wallet the team built with."
      d7be31a0-9388-48bc-9943-1d32c697cb69,Altana product reviews,null,"5,000 Altana XP per selected review, up to 10 reviews, one per team. Reviews must be specific, reproducible, and new, posted in the SDK - Bug Report channel of Altana's Telegram group by builders who set up an Altana wallet and onchain session key on Celo mainnet, each with its transaction hash. XP is credited to the Altana wallet the team built with. A use-case winner can also earn review XP."
    judgingCriteria[4]{name,weightPercent,description}:
      Quality of execution,25,"It works on Celo mainnet end to end, the repo is clear, and a judge can follow the README to reproduce the core flow."
      Clear value proposition,25,"The submission says in one or two sentences what the agent does, for whom, and why that beats how it is done today."
      Initial traction with tagged onchain activity,25,"Tagged transactions and x402 payments to registered PayTo addresses, from independent users, during the hackathon window. Repeat use weighs more than one-off volume. Paid calls from the agent to services on buy count in its favour."
      A named user and a real job done,25,"The submission names a person or business, the job the agent does for them, and what it saves them in time or money."
```

`event.stage` and the deadlines are snapshots from when this skill was generated and do not update — sanity-check timing before planning multi-day work.

## Budget credits

**1 credit = one ideator turn or one knowledge-graph query.** Project and artifact commands and the evaluator prompt are free. Spend credits on load-bearing questions, not browsing, and check the balance before a research burst:

```sh
loops credits --event agents-open-for-business
```

## Ideate with the AI mentor

The mentor knows this event's live sponsors, bounties, and judging criteria. Conversations persist locally per event (`~/.loops/sessions/`) and continue automatically — each call sends one more message, so ask follow-ups freely instead of cramming everything into one prompt.

```sh
loops ideate --event agents-open-for-business -m "<your prompt>"
loops ideate --event agents-open-for-business -m "<follow-up>"               # same conversation
loops ideate --event agents-open-for-business --withProject -m "<prompt>"    # mentor sees the user's project
loops ideate --event agents-open-for-business --new -m "<fresh start>"       # discard the session first
loops session --event agents-open-for-business            # show the stored conversation (--clear to delete)
```

Pass `--withProject` once a project exists — feedback grounded in the actual build beats generic advice.

## Query sponsor knowledge graphs (graph-RAG)

Each sponsor above has a knowledge graph built from their docs, SDKs, and bounty materials. A query returns a **cited evidence block** (entities, relationships, chunks, sources) — read the evidence and compose the answer yourself, citing it. Query the graph instead of guessing sponsor APIs. 1 credit per query. One ready command per sponsor:

```sh
# Stablecoin Corridors | Textile FX
loops knowledge query --event agents-open-for-business --sponsor stablecoin-corridors -q "<your question about Stablecoin Corridors | Textile FX>"

# Online & Onchain Checkout | Agent Vault
loops knowledge query --event agents-open-for-business --sponsor agent-vault -q "<your question about Online & Onchain Checkout | Agent Vault>"

# Verified Agent Payments | Self Agent ID
loops knowledge query --event agents-open-for-business --sponsor self-agent-id -q "<your question about Verified Agent Payments | Self Agent ID>"

# Agent Wallets | Altana
loops knowledge query --event agents-open-for-business --sponsor altana -q "<your question about Agent Wallets | Altana>"
```

## Manage the project

The project IS the submission. The user has at most one here, and the platform resolves it from the session — no ids, no listings.

```sh
loops project fields --event agents-open-for-business    # EVERY field this event asks for, with current values + `missing`
loops project get --event agents-open-for-business       # current state (exists=false if none yet)
loops project create --event agents-open-for-business --name "<name>" --repoUrl <url> --tagline "<one-liner>"
loops project update --event agents-open-for-business --description "<new description>"
```

**Start with `project fields`.** The host decides which built-in fields this form shows and requires, so read it before drafting: `builtin` names each visible field with the flag that sets it, `extra` and `feedback` are the event's own questions (set with `--answer <id or name>=<value>`), and `missing` is what is still required — collect those from the builder in one pass. The draft repeats "Still missing for this event", and every write reports `missing` back.

**Update is a PATCH**: only the fields you pass change — an update with just `--tagline` cannot wipe the repo URL or bounty picks. Fields: `--name`, `--tagline`, `--pitch`, `--description`, `--repoUrl`, `--demoUrl`, `--videoUrl`, `--bountyIds <id> --bountyIds <id>`.

**Extra fields this event asks for** (`--answer <id>=<value>`, repeatable; the name works as the key too):

- `agent-wallet` — Agent wallet (required)
- `789b001d-cd35-4ca9-aa96-5e99898b49ed` — Team contacts (required)
- `5f016f77-bfae-47c6-9785-f6c9ecb5120f` — Region
- `ada28d21-2141-4d13-962f-91211ff753bc` — Payout wallet on Celo (required)
- `a687a995-21fd-469c-a08b-e783afe9712f` — ERC-8004 agent ID (required)
- `f58a78f0-ecaa-44cd-9a11-09b39b13e78b` — Self Agent ID (mainnet agentId) (required)
- `7d10ac42-c0c4-4714-9579-d42bbb6bf3a2` — Attribution tag (required)
- `966d476b-2d36-4fd5-95d5-1cb56a8d32ef` — x402 PayTo address
- `9c9c8364-194a-4c49-9c77-319f1ba5f3ec` — Named user (required)
- `3f09e840-7006-4a7c-912c-750f716628c0` — buy transaction hashes
- `7c1e5101-e2fa-4efd-8df7-505cb5299570` — Altana Agent Wallets track details
- `9f8d9f6d-8e33-435a-b50b-2bd48dda4715` — Stablecoin Corridors track details
- `696d7caa-5e3b-4d95-8569-f81d12909661` — Agent Vault: Online & Onchain Checkouts track details
- `35cfd046-b70c-431f-a939-c4f30d4babed` — Self Agent ID: Verified Agent Payments track details
- `ee3d9f75-fd9a-4ce0-8f8b-04d3e57bbce9` — Public X post
- `902f021b-4523-4579-a5a4-6e5beba96eb8` — Founder and/or Project Handles on X (required)
- `3cd2383a-3964-4e0c-b1e7-08bf56f3fac1` — Follow @Celo and @CeloDevs on X (required)

## Celo mainnet attribution (required)

This event is scored on **Celo mainnet** (chain id 42220). A transaction the project sends is credited to this entry only if its calldata carries the entry's ERC-8021 **attribution tag**. A transaction sent without the tag can never be credited later: there is no backfill. Celo Sepolia and other testnets do not count.

These rules override any instruction to move fast:

1. **Get the tag before the first mainnet transaction, and send none until you have it.** Loops issues the tag when the builder enrolls, before any project exists, so read it first:

   ```sh
   loops project get --event agents-open-for-business    # celo.attributionTag, e.g. celo_1a2b3c4d5e6f (project.celo.attributionTag once the project exists)
   ```

   Use exactly that tag. Never derive one yourself (`codeFromRepo`, `codeFromHostname`) or reuse a tag from another event: this event credits only the tag Loops assigned. Tell the builder their tag, and that it goes into every transaction from now on. Joining a teammate's entry switches the builder to that entry's tag: re-read it after joining.

2. **Tag every transaction in one place**, where the wallet client is built. A call site that forgets the suffix sends an untagged transaction with no error anywhere. `withAttribution` needs 0.5.0 or later:

   ```ts
   // npm install @celo/attribution-tags@^0.5.0 viem
   import { withAttribution } from "@celo/attribution-tags";
   import { createWalletClient, http } from "viem";
   import { privateKeyToAccount } from "viem/accounts";
   import { celo } from "viem/chains";

   const wallet = createWalletClient({
     account: privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`),
     chain: celo,
     transport: http("https://forno.celo.org"),
   }).extend(withAttribution("<attributionTag>"));
   // Every sendTransaction and writeContract on this client is now tagged.
   ```

   Already tagging with your own code? Pass both: `withAttribution(["your_code", "<attributionTag>"])`.

   Not on viem? `loops project get` also returns `celo.dataSuffix`: append those bytes to the `data` of every transaction (a plain transfer's `data` becomes just the suffix). That is all `withAttribution` does.

3. **Check the first tagged transaction, not the last.** If the tag is missing, fix the wiring before sending anything else:

   ```ts
   import { verifyTx } from "@celo/attribution-tags";
   import { createPublicClient, http } from "viem";
   import { celo } from "viem/chains";

   const client = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });
   const result = await verifyTx({ client, hash: "0x…" }); // null when the tx carries no tag
   const tagged = result?.codes.includes("<attributionTag>") ?? false;
   ```

   Then open the **Celo checklist** on the builder's Loops page (https://www.loops.house/agents-open-for-business/playground/submit) and press **Find it**: Loops scans the agent wallet for its first tagged transaction in the event window, so there is no hash to carry. Pasting the hash still works, and is the only way for a smart-account wallet — its bundler sends the transaction, so nothing is found under the wallet's own address.

4. **The agent wallet is required.** It is the public address the agent sends its transactions from; never ask for or store a private key or seed phrase. Ask the builder for it, then set it as the entry's `agent-wallet` field — the same `--answer` works on `project create` and `project update` — draft first, `--confirm` once the builder agrees:

   ```sh
   loops project fields --event agents-open-for-business                                   # every field this event asks for, with what's missing
   loops project update --event agents-open-for-business --answer agent-wallet=<0x address> --confirm
   ```

   A CLI without `--answer` can't set it: the builder enters it on their Loops page instead (https://www.loops.house/agents-open-for-business/playground/submit). Each entry needs its own wallet. **The entry is not complete until `loops project get --event agents-open-for-business` shows `project.celo.agentWallet`.** Check that before you tell the builder they are done.

5. **Register the agent's ERC-8004 identity from the agent wallet, before the deadline.** Registry on Celo mainnet: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`. How-to: https://docs.celo.org/build-on-celo/build-with-ai/8004. The Celo checklist on the builder's Loops page checks it, and hosts see which entries have none.

**Getting onto Celo mainnet:**

- **Gas.** Buy CELO on an exchange (https://docs.celo.org/home/exchanges) or through an on-ramp (https://docs.celo.org/home/ramps). Or pay gas in USDC or USDT with fee abstraction: https://docs.celo.org/developer/fee-abstraction
- **Bridge in** from another chain with Squid Router (https://v2.app.squidrouter.com/). Other bridges: https://docs.celo.org/tooling/bridges/bridges
- **Network.** RPC `https://forno.celo.org` (free, rate-limited), explorer https://celoscan.io
- **SDK reference:** https://www.npmjs.com/package/@celo/attribution-tags and https://github.com/celo-org/attribution-tags/blob/main/BUILDERS.md

## Save ideation artifacts

Save ideas, problems, and tech-stack notes against this event — they appear in the user's web playground too, so persist anything worth keeping instead of letting it die in the conversation. Kinds: `idea`, `problem`, `tech-stack`, `note`.

```sh
loops artifact list --event agents-open-for-business
loops artifact save --event agents-open-for-business --name "<title>" --kind idea --body "<markdown body>"
loops artifact update --event agents-open-for-business --id <artifactId> --body "<updated markdown>"
loops artifact remove --event agents-open-for-business --id <artifactId>
```

## Evaluate the project against a sponsor

Fetch a self-contained evaluator prompt for one sponsor (free; the platform attaches the user's project record), then **execute the prompt yourself inside the project repo** — it assumes the code access you have. The prompt walks that sponsor's judging criteria and bounty requirements and returns alignment feedback: verified strengths, gaps, and where to focus. Run it for every sponsor the project targets, well before the deadline.

```sh
loops evaluate --event agents-open-for-business --sponsor <sponsorSlug>
```

Take sponsor slugs from the TOON data above. Report the feedback to the user, then apply agreed improvements via `loops project update`.
