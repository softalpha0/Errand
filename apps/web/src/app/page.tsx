import Link from "next/link";
import { LiveRates } from "@/components/live-rates";
import { Card, CardHeader, Eyebrow, LinkButton, Pill } from "@/components/ui";
import { CELO, REPO_CELO_URL, REPO_URL, addressUrl, short, txUrl } from "@/lib/celo";

const STEPS = [
  {
    title: "You keep the wallet",
    body: "Create a non-custodial Altana wallet with a passkey and fund it with your own USD₮. Errand never holds your keys or your money.",
  },
  {
    title: "You grant a session, with limits the chain enforces",
    body: "A daily spend cap, a list of the only contracts Errand may call, and an expiry. You can revoke it in one transaction, and the next attempt is refused.",
  },
  {
    title: "You give the errand in plain words",
    body: "For example: send ₦5,000 to my supplier. Errand writes a plan with a price on every step and checks it against your limits before anything moves.",
  },
  {
    title: "Every payment is checked, then converted and paid",
    body: "Errand's guard checks each payment first. Then it converts USD₮ to the local stablecoin on Textile FX (cNGN, IDRX, wARS, wBRL…) and pays it to the named recipient, from your wallet, under your session.",
  },
  {
    title: "You get a receipt for every transaction",
    body: "The amount in local money and what it cost in USD₮, the rate, why it was approved, and a Celoscan link for each transaction.",
  },
];

type Fact = { label: string; value: string; href?: string; note: string };

const FACTS: Fact[] = [
  {
    label: "Agent wallet",
    value: short(CELO.agentWallet),
    href: addressUrl(CELO.agentWallet),
    note: "The one address Errand's agent acts from, for the whole event.",
  },
  {
    label: "ERC-8004 identity",
    value: `agentId ${CELO.erc8004.agentId}`,
    href: txUrl(CELO.erc8004.registerTx),
    note: "Registered from the agent wallet on the Identity Registry. The transaction carries Errand's attribution tag.",
  },
  {
    label: "Self Agent ID",
    value: `agentId ${CELO.selfAgentId.agentId}`,
    href: txUrl(CELO.selfAgentId.registerTx),
    note: "A real person stands behind this agent, proved with a passport in the Self app. Only “18 or older” is disclosed.",
  },
  {
    label: "Errand Guard",
    value: "errand-guard-celo.onrender.com",
    href: CELO.guardUrl,
    note: "An x402 service on Celo: other agents pay $0.01 USD₮ to have a payment checked first. Agents with a Self Agent ID get 100 checks a day, others 3.",
  },
  {
    label: "Attribution tag",
    value: CELO.attributionTag,
    note: "Added to the end of every transaction Errand sends, so each one can be traced to Errand.",
  },
  {
    label: "Textile FX conversion",
    value: `1 USD₮ → ₦${CELO.textileSwap.naira} cNGN`,
    href: txUrl(CELO.textileSwap.tx),
    note: "A real USD₮ to cNGN swap on Textile FX from Errand's test wallet, 24 Nov 2026. The transaction carries Errand's attribution tag.",
  },
  {
    label: "First real errand",
    value: "₦2,000 cNGN paid, from MiniPay",
    href: txUrl(CELO.firstErrand.payoutTx),
    note: "25 Nov 2026: a person outside the team sent exactly ₦2,000 to someone else from their own MiniPay wallet. Approval, conversion and payment all carry Errand's tag; a second Celo node, paid by Errand on buy, confirmed them.",
  },
  {
    label: "Textile FX price check",
    value: `≈ ₦${CELO.textilePreview.nairaPerUsdt.toLocaleString("en-NG")} per USD₮`,
    note: `Indicative USD₮→cNGN price for $1–$20 on Celo mainnet, ${CELO.textilePreview.date}. Not a live quote.`,
  },
];

type StatusRow = { item: string; state: "live" | "try" | "building" | "next" };

const STATUS: StatusRow[] = [
  { item: "Buy for me: airtime and data through Kite Passport (USDC on Base), SERV checks on every payment", state: "live" },
  { item: "Buy for me: eSIMs, gift cards, Amazon shopping and research", state: "try" },
  { item: "Book for me: table bookings by AI phone call (US and Canada)", state: "try" },
  { item: "Book for me: flights and hotels", state: "next" },
  { item: "Agent identity on Celo mainnet (ERC-8004 and Self Agent ID)", state: "live" },
  { item: "Attribution tag on every Errand transaction", state: "live" },
  { item: "Your own Altana wallet, created with a passkey (free, no transaction)", state: "try" },
  { item: "Session with spend cap, contract allowlist, expiry and one-tap revoke", state: "building" },
  { item: "USD₮ → cNGN conversion on Textile FX, tagged", state: "live" },
  { item: "Errands on the site: an exact amount in ₦, Rp, AR$ or R$ to the person you name, from your own wallet", state: "live" },
  { item: "Shareable receipts that re-check every transaction on Celo when opened", state: "live" },
  { item: "Works inside MiniPay: no connect button, network fees paid in USD₮", state: "live" },
  { item: "Errand pays for its own tools on buy: $0.01 for an independent Celo node to check each receipt", state: "live" },
  { item: "Errand Guard: other agents pay $0.01 over x402; Self Agent ID decides who is served", state: "live" },
];

const STATE_LABEL = { live: "Live on mainnet", try: "Ready to try", building: "Building now", next: "Next" } as const;
const STATE_TONE = { live: "approve", try: "approve", building: "ask", next: "neutral" } as const;

type ErrandType = { name: string; href?: string; state: string; tone: "approve" | "ask" | "neutral"; body: string; items: string[]; color: string; where: string };

const TYPES: ErrandType[] = [
  {
    name: "Pay someone",
    href: "/errand",
    state: "Live on Celo",
    tone: "approve",
    body: "Send an exact amount of local money to anyone. Errand converts your USD₮ on Textile FX and pays them from your own wallet, even inside MiniPay.",
    items: ["cNGN (naira), IDRX (rupiah), wARS, wBRL", "First real errand: 25 Nov 2026"],
    color: "var(--ngn)",
    where: "Celo · Textile FX · MiniPay",
  },
  {
    name: "Buy for me",
    href: "/new",
    state: "Live for airtime",
    tone: "approve",
    body: "Ask Errand to buy something. It plans the errand with a price on every step, checks each payment with SERV Reasoning, and pays sellers through your Kite Passport.",
    items: ["Airtime and data in 180+ countries: live (₦100 MTN, 5 Nov 2026)", "eSIMs, gift cards, Amazon shopping, research: built, not yet run on mainnet"],
    color: "var(--ars)",
    where: "Kite Agent Passport · USDC on Base",
  },
  {
    name: "Book for me",
    href: "/new?example=6",
    state: "Partly built",
    tone: "ask",
    body: "Reservations with the same limits, checks and receipts. Errand can already find a restaurant and phone it to book a table, through an AI call it pays for.",
    items: ["Table bookings by AI phone call (US and Canada numbers): built, not yet run on mainnet", "Flights and hotels: next, not built"],
    color: "var(--brl)",
    where: "StablePhone via Kite Passport · roadmap",
  },
];

const STORY = [
  { date: "4 Nov 2026", title: "Errand starts", body: "Built for SERV Hackathon 02: an agent that buys things for you through your Kite Agent Passport, with SERV Reasoning checking every payment." },
  { date: "5 Nov 2026", title: "First real errand", body: "₦100 of MTN airtime bought on mainnet through Kite Passport: 6 payments, $0.11 in total, confirmed by MTN." },
  { date: "Nov 2026", title: "Attack benchmark", body: "20 attacks against the same errand: Kite caps alone let 18 through, Errand's rules 4, rules plus SERV 1." },
  { date: "20 Nov 2026", title: "Errand comes to Celo", body: "Agents Open for Business begins: Errand gets an on-chain identity, pays in local stablecoins and sells payment checks to other agents." },
  { date: "25 Nov 2026", title: "First Celo errand", body: "A user outside the team sends exactly 2,000 cNGN to a friend from their own MiniPay wallet. Every transaction tagged on Celo." },
];

const LOG: { t: string; text: string; tag: string; tone: "approve" | "ask" | "neutral" }[] = [
  { t: "09:12", text: "Checked the errand: Ada's wallet, and your balance covers it", tag: "Checked", tone: "neutral" },
  { t: "09:12", text: "Firm price on Textile FX: 13.89 USD₮, within 2% of the preview", tag: "Priced", tone: "neutral" },
  { t: "09:13", text: "Asked you to confirm the USD₮ approval", tag: "Asked you", tone: "ask" },
  { t: "09:13", text: "Converted USD₮ to 20,000 cNGN · tagged", tag: "Converted", tone: "approve" },
  { t: "09:14", text: "Paid 20,000 cNGN to Ada · tagged", tag: "Paid", tone: "approve" },
  { t: "09:14", text: "A second Celo node confirmed the receipt ($0.01 on buy)", tag: "Verified", tone: "approve" },
];

const RULES: { rule: string; detail: string; tag: string }[] = [
  { rule: "Pays only the person you named", detail: "The payment goes to the address you entered, in the currency you chose, for exactly the amount you asked.", tag: "always" },
  { rule: "Never more than your limit", detail: "Pay someone: $1.10–$35 per errand while in testing. Buy for me: your budget and your most-per-payment.", tag: "you set it" },
  { rule: "Talks to three contracts, nothing else", detail: "The USD₮ approval for Textile, Textile's reactor, and a transfer of the chosen stablecoin. Any other call is refused.", tag: "always" },
  { rule: "Refuses a worse price", detail: "A firm quote more than 2% above the preview is refused before anything is signed.", tag: "always" },
  { rule: "Never pays the same thing twice", detail: "Each purchase has one idempotency key, so a retry can't charge you again.", tag: "always" },
  { rule: "Asks you when it isn't sure", detail: "Judgement calls, such as which package to buy, come back to you as a question.", tag: "always" },
  { rule: "Writes every step down", detail: "Every Errand transaction carries its tag and a receipt anyone can re-check on Celo.", tag: "always" },
  { rule: "Stop it in one tap", detail: "With an Altana session you can revoke Errand's access in one transaction. Built; switched on once Altana confirms tagging.", tag: "coming" },
];

const LIMITS = [
  ["It isn't a bank.", "Errand never holds your money. It acts from your own wallet, and you confirm each step."],
  ["Recipients get stablecoins, not bank money (yet).", "They receive cNGN, IDRX, wARS or wBRL in their wallet. Bank payouts are next."],
  ["Payments can't be undone.", "Check the recipient's address with them first. Errand checks that it's valid, not that it's theirs."],
  ["Altana sessions aren't on yet.", "Until they are, there's no spending allowance: every errand needs your confirmation."],
  ["Buy-for-me errands pay on Base.", "They go through your Kite Passport in USDC on Base, not on Celo."],
  ["Checks lower the risk; they don't remove it.", "Rules catch the wrong contract, price or recipient. They can't know a seller will deliver."],
];

const DOES = [
  {
    title: "Pays people for you",
    body: "Tell it who gets what: ₦20,000 to Ada, R$50 to João. Errand converts your USD₮ on Textile FX and pays the exact local amount.",
    color: "var(--ngn)",
  },
  {
    title: "Only inside your rules",
    body: "A daily cap, the only contracts it may call, an expiry. Every payment is checked against them before anything moves.",
    color: "var(--ars)",
  },
  {
    title: "Checks payments for other agents",
    body: "Errand Guard is a paid service on Celo: any AI agent pays $0.01 to have a payment checked first. Agents with a real human behind them get more.",
    color: "var(--brl)",
  },
];

export default function Home() {
  return (
    <div className="overflow-x-clip">
      {/* Hero */}
      <section className="relative">
        <div aria-hidden className="glow glow-green -top-48 left-1/2 h-[620px] w-[920px] -translate-x-1/2" />
        <div aria-hidden className="glow glow-blue top-64 -right-48 h-[420px] w-[520px]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[13px] text-muted">
              <span className="pulse-dot size-1.5 rounded-full bg-accent" /> Live on Celo mainnet
            </span>
            <h1 className="mt-6 text-[48px] leading-[0.95] font-bold tracking-[-0.045em] sm:text-7xl lg:text-[84px]">
              Runs your money errands.
              <br />
              <span className="text-spectrum">Never breaks your limits.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Errand pays people in their local money and buys things like airtime, data and eSIMs, from your own wallet. It checks every payment before it moves,
              and writes every step down.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="/errand" size="lg">
                Send your first errand <span aria-hidden>→</span>
              </LinkButton>
              <LinkButton href="#rules" size="lg" variant="secondary">
                See the rules it can&apos;t break
              </LinkButton>
            </div>
            <p className="mt-6 text-sm text-faint">You keep your keys. Errand never holds your money.</p>
          </div>

          {/* Example errand log */}
          <div className="w-full rounded-[28px] border border-white/10 bg-white/[0.04] p-2 shadow-[0_40px_120px_-30px_rgba(53,208,127,0.45)]">
            <div className="rounded-[22px] bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Today&apos;s errand</p>
                <span className="text-[12px] text-faint">Example</span>
              </div>
              <p className="mt-1 text-[13px] text-muted">&ldquo;Send ₦20,000 to Ada.&rdquo;</p>
              <ol className="mt-4 space-y-3">
                {LOG.map((l) => (
                  <li key={l.t + l.text} className="flex gap-3 text-[13px]">
                    <span className="num w-11 shrink-0 text-faint">{l.t}</span>
                    <span className="min-w-0 flex-1 leading-snug">{l.text}</span>
                    <span className="shrink-0">
                      <Pill tone={l.tone}>{l.tag}</Pill>
                    </span>
                  </li>
                ))}
              </ol>
              <a href={txUrl(CELO.firstErrand.payoutTx)} className="mt-5 flex items-center justify-between rounded-2xl bg-sunken px-4 py-3 text-sm hover:bg-line" rel="noreferrer">
                <span>See the first real errand</span>
                <span className="text-accent">Celoscan ↗</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Live rates */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <LiveRates />
      </section>

      {/* What Errand does */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <Eyebrow>What Errand does</Eyebrow>
        <h2 className="mt-3 max-w-3xl text-4xl leading-[1.02] font-bold tracking-[-0.035em] sm:text-6xl">Your wallet. Your limits. Your agent.</h2>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {DOES.map((d) => (
            <div key={d.title} className="relative overflow-hidden rounded-3xl border border-line bg-card p-6 sm:p-7">
              <div aria-hidden className="absolute -top-24 -right-24 size-56 rounded-full opacity-40" style={{ background: `radial-gradient(closest-side, ${d.color}, transparent)` }} />
              <span aria-hidden className="relative block h-1.5 w-10 rounded-full" style={{ background: d.color }} />
              <h3 className="relative mt-6 text-2xl font-semibold tracking-tight">{d.title}</h3>
              <p className="relative mt-3 leading-relaxed text-muted">{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Errand types */}
      <section id="types" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-24 sm:px-6">
        <Eyebrow>Errands it runs</Eyebrow>
        <h2 className="mt-3 max-w-3xl text-4xl leading-[1.02] font-bold tracking-[-0.035em] sm:text-6xl">One agent, more kinds of errands.</h2>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {TYPES.map((t) => {
            const inner = (
              <>
                <div aria-hidden className="absolute -top-24 -right-24 size-56 rounded-full opacity-40" style={{ background: `radial-gradient(closest-side, ${t.color}, transparent)` }} />
                <div className="relative flex items-center justify-between gap-3">
                  <h3 className="text-2xl font-semibold tracking-tight">{t.name}</h3>
                  <Pill tone={t.tone}>{t.state}</Pill>
                </div>
                <p className="relative mt-3 leading-relaxed text-muted">{t.body}</p>
                <ul className="relative mt-4 space-y-1.5 text-sm">
                  {t.items.map((i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full" style={{ background: t.color }} />
                      {i}
                    </li>
                  ))}
                </ul>
                <p className="num relative mt-5 text-[12px] text-faint">{t.where}</p>
                {t.href ? <p className="relative mt-4 text-sm font-semibold text-accent">Open {t.name.toLowerCase()} →</p> : null}
              </>
            );
            return t.href ? (
              <Link key={t.name} href={t.href} className="relative overflow-hidden rounded-3xl border border-line bg-card p-6 hover:border-line-strong sm:p-7">
                {inner}
              </Link>
            ) : (
              <div key={t.name} className="relative overflow-hidden rounded-3xl border border-dashed border-line-strong bg-card/50 p-6 sm:p-7">
                {inner}
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 border-y border-white/[0.06] bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-3 text-4xl font-bold tracking-[-0.035em] sm:text-6xl">Five steps, all on chain.</h2>
          <ol className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <span className="num text-6xl font-bold tracking-tight text-line-strong">0{i + 1}</span>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Rules */}
      <section id="rules" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <Eyebrow>Rules it can&apos;t break</Eyebrow>
        <h2 className="mt-3 max-w-3xl text-4xl leading-[1.02] font-bold tracking-[-0.035em] sm:text-6xl">Checked in code, before money moves.</h2>
        <ul className="mt-12 grid gap-3 md:grid-cols-2">
          {RULES.map((r) => (
            <li key={r.rule} className="flex items-start justify-between gap-4 rounded-3xl border border-line bg-card p-5 sm:p-6">
              <div>
                <p className="text-lg font-semibold tracking-tight">{r.rule}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{r.detail}</p>
              </div>
              <span className="shrink-0">
                <Pill tone={r.tag === "always" ? "approve" : r.tag === "coming" ? "neutral" : "ask"}>{r.tag}</Pill>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-faint">
          Pay someone: rules R14–R17 and the errand checks in{" "}
          <a href={`${REPO_URL}/blob/celo/packages/celo/src/rules.ts`} className="text-accent underline decoration-accent/30 underline-offset-4" rel="noreferrer">
            packages/celo
          </a>
          . Buy for me: rules R1–R13 plus a SERV guard in{" "}
          <a href={`${REPO_URL}/blob/celo/packages/core/src/guard.ts`} className="text-accent underline decoration-accent/30 underline-offset-4" rel="noreferrer">
            packages/core
          </a>
          .
        </p>
      </section>

      {/* For agents */}
      <section id="agents" className="relative scroll-mt-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
          <div>
            <Eyebrow>For other agents</Eyebrow>
            <h2 className="mt-3 text-4xl leading-[1.02] font-bold tracking-[-0.035em] sm:text-6xl">Check a payment before you send it.</h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
              Errand Guard runs the same checks Errand uses on itself, as a paid API on Celo. Pay $0.01 USD₮ over x402 per check. Agents with a Self Agent ID (a real
              person behind them) get 100 checks a day; others get 3.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href={CELO.guardUrl} variant="secondary">
                Open Errand Guard ↗
              </LinkButton>
            </div>
          </div>
          <div className="overflow-hidden rounded-3xl border border-line bg-card">
            <div className="flex items-center gap-1.5 border-b border-line px-4 py-3">
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="ml-3 text-[12px] text-faint">errand-guard-celo.onrender.com</span>
            </div>
            <pre className="num overflow-x-auto p-5 text-[13px] leading-relaxed text-muted">
              <span className="text-accent">POST</span> /check{"\n"}
              <span className="text-faint">{"// 402 Payment Required → pay $0.01 USD₮ on Celo"}</span>
              {"\n\n"}
              {"{"}
              {"\n"}
              {"  "}
              <span className="text-ink">&quot;decision&quot;</span>: <span className="text-accent">&quot;approve&quot;</span>,{"\n"}
              {"  "}
              <span className="text-ink">&quot;tier&quot;</span>: <span style={{ color: "var(--brl)" }}>&quot;verified&quot;</span>,{"\n"}
              {"  "}
              <span className="text-ink">&quot;remainingToday&quot;</span>: <span style={{ color: "var(--ars)" }}>99</span>
              {"\n"}
              {"}"}
            </pre>
          </div>
        </div>
      </section>

      {/* Story */}
      <section id="story" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-24 sm:px-6">
        <Eyebrow>Errand&apos;s story</Eyebrow>
        <h2 className="mt-3 max-w-3xl text-4xl leading-[1.02] font-bold tracking-[-0.035em] sm:text-6xl">Built before Celo. Growing on Celo.</h2>
        <ol className="relative mt-12 border-l border-line-strong pl-6 sm:pl-8">
          {STORY.map((e) => (
            <li key={e.title} className="relative pb-10 last:pb-0">
              <span aria-hidden className="absolute top-1.5 -left-[31px] size-3 rounded-full bg-accent sm:-left-[39px]" />
              <p className="num text-sm text-accent">{e.date}</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight">{e.title}</h3>
              <p className="mt-1.5 max-w-2xl leading-relaxed text-muted">{e.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
          <LinkButton href="/stats" variant="secondary" size="sm">
            See the attack benchmark
          </LinkButton>
          <LinkButton href="/r/e_My979K17" variant="secondary" size="sm">
            The first receipt (airtime, 5 Nov)
          </LinkButton>
        </div>
      </section>

      {/* On chain */}
      <section id="onchain" className="mx-auto max-w-6xl scroll-mt-20 px-4 sm:px-6">
        <Eyebrow>On Celo mainnet today</Eyebrow>
        <h2 className="mt-3 text-4xl font-bold tracking-[-0.035em] sm:text-6xl">Don’t trust us. Check.</h2>
        <div className="mt-12 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { v: `#${CELO.erc8004.agentId}`, l: "ERC-8004 agent", href: txUrl(CELO.erc8004.registerTx) },
            { v: `#${CELO.selfAgentId.agentId}`, l: "Self Agent ID", href: txUrl(CELO.selfAgentId.registerTx) },
            { v: "$0.01", l: "per Guard check", href: CELO.guardUrl },
            { v: "tagged", l: CELO.attributionTag },
          ].map((x) => {
            const inner = (
              <>
                <p className="num text-4xl font-bold tracking-tight sm:text-5xl">{x.v}</p>
                <p className="num mt-2 truncate text-sm text-muted">{x.l}</p>
              </>
            );
            return x.href ? (
              <a key={x.l} href={x.href} className="rounded-3xl border border-line bg-card p-5 hover:border-line-strong sm:p-6" rel="noreferrer">
                {inner}
              </a>
            ) : (
              <div key={x.l} className="rounded-3xl border border-line bg-card p-5 sm:p-6">
                {inner}
              </div>
            );
          })}
        </div>
        <Card className="mt-4">
          <CardHeader title="Errand's agent" sub="Celo mainnet, chain 42220. Every line links to the chain." />
          <dl className="divide-y divide-line">
            {FACTS.map((fact) => (
              <div key={fact.label} className="grid gap-1 px-5 py-4 sm:grid-cols-[200px_1fr] sm:gap-6">
                <dt className="text-sm font-medium">{fact.label}</dt>
                <dd>
                  {fact.href ? (
                    <a href={fact.href} className="num text-[15px] text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent" rel="noreferrer">
                      {fact.value}
                    </a>
                  ) : (
                    <span className="num text-[15px]">{fact.value}</span>
                  )}
                  <p className="mt-1 text-sm leading-snug text-muted">{fact.note}</p>
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </section>

      {/* Status */}
      <section id="status" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24 sm:px-6">
        <Eyebrow>Build status</Eyebrow>
        <h2 className="mt-3 text-4xl font-bold tracking-[-0.035em] sm:text-6xl">What runs today.</h2>
        <p className="mt-4 max-w-2xl text-muted">Only what has run on mainnet (Celo, or Base for Kite errands) is marked live. “Ready to try” is built and tested but hasn’t made a mainnet payment yet.</p>
        <ul className="mt-10 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-card">
          {STATUS.map((row) => (
            <li key={row.item} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <span className="text-[15px]">{row.item}</span>
              <span className="self-start sm:self-auto">
                <Pill tone={STATE_TONE[row.state]}>{STATE_LABEL[row.state]}</Pill>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">
          Built in the open:{" "}
          <a href={REPO_CELO_URL} className="text-accent underline decoration-accent/30 underline-offset-4" rel="noreferrer">
            follow the code on GitHub
          </a>
          .
        </p>
      </section>

      {/* Limits */}
      <section id="limits" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24 sm:px-6">
        <Eyebrow>Know the limits</Eyebrow>
        <h2 className="mt-3 text-4xl font-bold tracking-[-0.035em] sm:text-6xl">Better you hear it here.</h2>
        <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {LIMITS.map(([t, d]) => (
            <div key={t} className="rounded-3xl border border-line bg-card p-5 sm:p-6">
              <p className="font-semibold tracking-tight">{t}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <div className="relative overflow-hidden rounded-[32px] px-6 py-14 sm:px-12 sm:py-16" style={{ background: "linear-gradient(135deg, #35d07f, #2bb59a 50%, #3d8fd6)", color: "#03140b" }}>
          <h2 className="max-w-xl text-5xl leading-[0.95] font-bold tracking-[-0.04em] sm:text-7xl">Send your first errand.</h2>
          <p className="mt-4 max-w-md text-lg opacity-75">Open it in MiniPay or any Celo wallet, add a little USD₮, and pay someone in their own money. Start small.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/errand" className="inline-flex h-13 items-center rounded-full bg-[#03140b] px-7 font-semibold text-white hover:opacity-90">
              Send money →
            </Link>
            <Link href="/wallet" className="inline-flex h-13 items-center rounded-full border border-black/20 px-7 font-semibold hover:bg-black/5">
              Create your wallet
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
