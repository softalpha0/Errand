import Link from "next/link";
import { LiveRates } from "@/components/live-rates";
import { Card, CardHeader, Eyebrow, LinkButton, Pill } from "@/components/ui";
import { CELO, REPO_CELO_URL, addressUrl, short, txUrl } from "@/lib/celo";

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
    label: "Textile FX price check",
    value: `≈ ₦${CELO.textilePreview.nairaPerUsdt.toLocaleString("en-NG")} per USD₮`,
    note: `Indicative USD₮→cNGN price for $1–$20 on Celo mainnet, ${CELO.textilePreview.date}. Not a live quote.`,
  },
];

type StatusRow = { item: string; state: "live" | "try" | "building" | "next" };

const STATUS: StatusRow[] = [
  { item: "Agent identity on Celo mainnet (ERC-8004 and Self Agent ID)", state: "live" },
  { item: "Attribution tag on every Errand transaction", state: "live" },
  { item: "Your own Altana wallet, created with a passkey (free, no transaction)", state: "try" },
  { item: "Session with spend cap, contract allowlist, expiry and one-tap revoke", state: "building" },
  { item: "USD₮ → cNGN conversion on Textile FX, tagged", state: "live" },
  { item: "Errands on the site: an exact amount in ₦, Rp, AR$ or R$ to the person you name, from your own wallet", state: "try" },
  { item: "Shareable receipts that re-check every transaction on Celo when opened", state: "try" },
  { item: "Works inside MiniPay: no connect button, network fees paid in USD₮", state: "try" },
  { item: "Errand pays for its own tools on buy: $0.01 for an independent Celo node to check each receipt", state: "try" },
  { item: "Errand Guard: other agents pay $0.01 over x402; Self Agent ID decides who is served", state: "live" },
];

const STATE_LABEL = { live: "Live on mainnet", try: "Ready to try", building: "Building now", next: "Next" } as const;
const STATE_TONE = { live: "approve", try: "approve", building: "ask", next: "neutral" } as const;

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
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[13px] text-muted">
              <span className="pulse-dot size-1.5 rounded-full bg-accent" /> On Celo mainnet · in development
            </span>
            <h1 className="mt-6 text-[52px] leading-[0.95] font-bold tracking-[-0.045em] sm:text-7xl lg:text-[92px]">
              Money errands,
              <br />
              <span className="text-spectrum">done for you.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Errand is an agent that pays people in their local money (naira, rupiah, pesos, reais) from your own wallet, inside limits you set. You keep the keys.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="/errand" size="lg">
                Send money <span aria-hidden>→</span>
              </LinkButton>
              <LinkButton href="/wallet" size="lg" variant="secondary">
                Create your wallet
              </LinkButton>
            </div>
          </div>

          {/* Real conversion, shown as an app card */}
          <div className="mx-auto w-full max-w-[320px] rounded-[44px] border border-white/10 bg-white/[0.04] p-3 shadow-[0_40px_120px_-30px_rgba(53,208,127,0.45)]">
            <div className="rounded-[34px] bg-card p-5">
              <div className="flex items-center justify-between text-[12px] text-muted">
                <span>Receipt</span>
                <Pill tone="approve">Filled</Pill>
              </div>
              <div className="mt-4 rounded-3xl p-5" style={{ background: "linear-gradient(135deg, var(--ngn), var(--accent))", color: "#03140b" }}>
                <p className="text-[12px] font-medium opacity-75">Converted on Textile FX</p>
                <p className="num mt-1 text-[36px] leading-none font-bold">₦{CELO.textileSwap.naira}</p>
                <p className="num mt-3 text-[12px] opacity-75">for 1.00 USD₮ · cNGN</p>
              </div>
              <dl className="mt-4 space-y-2.5 text-[13px]">
                {[
                  ["Network", "Celo mainnet"],
                  ["Tag", CELO.attributionTag],
                  ["Date", "24 Nov 2026"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline gap-2">
                    <dt className="text-muted">{k}</dt>
                    <span className="leader" />
                    <dd className="num">{v}</dd>
                  </div>
                ))}
              </dl>
              <a href={txUrl(CELO.textileSwap.tx)} className="mt-4 flex items-center justify-between rounded-2xl bg-sunken px-4 py-3 text-sm hover:bg-line" rel="noreferrer">
                <span className="num">{short(CELO.textileSwap.tx)}</span>
                <span className="text-accent">Celoscan ↗</span>
              </a>
              <p className="mt-3 text-center text-[11px] text-faint">A real conversion from Errand’s test wallet</p>
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
        <p className="mt-4 max-w-2xl text-muted">Only what has run on Celo mainnet is marked live. “Ready to try” works today but hasn’t made a mainnet transaction yet.</p>
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

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <div className="relative overflow-hidden rounded-[32px] px-6 py-14 sm:px-12 sm:py-16" style={{ background: "linear-gradient(135deg, #35d07f, #2bb59a 50%, #3d8fd6)", color: "#03140b" }}>
          <h2 className="max-w-xl text-5xl leading-[0.95] font-bold tracking-[-0.04em] sm:text-7xl">Start sending.</h2>
          <p className="mt-4 max-w-md text-lg opacity-75">Create a wallet with a passkey, add USD₮, and pay someone in their own money.</p>
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
