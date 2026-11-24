import { CardHeader, Card, Eyebrow, LinkButton, Pill } from "@/components/ui";
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
    body: "Errand's guard checks each payment first. Then it converts USD₮ to cNGN on Textile FX and pays the cNGN to the named recipient, from your wallet, under your session.",
  },
  {
    title: "You get a receipt for every transaction",
    body: "The amount in Naira and what it cost in USD₮, the rate, why it was approved, and a Celoscan link for each transaction.",
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
  { item: "USD₮ → cNGN on Textile FX, paid to a named recipient", state: "next" },
  { item: "Receipts with a Celoscan link for every transaction", state: "next" },
  { item: "Errand Guard: other agents pay $0.01 over x402; Self Agent ID decides who is served", state: "live" },
];

const STATE_LABEL = { live: "Live on mainnet", try: "Ready to try", building: "Building now", next: "Next" } as const;
const STATE_TONE = { live: "approve", try: "approve", building: "ask", next: "neutral" } as const;

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="pt-14 pb-12 sm:pt-20">
        <Eyebrow>Errand on Celo</Eyebrow>
        <h1 className="mt-3 max-w-3xl text-[34px] leading-[1.1] font-semibold tracking-tight sm:text-5xl">
          Your errands in Naira, paid from your own wallet.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
          You set the cap, Errand can only call what you allow, and you can stop it in one transaction. It converts USD₮ to cNGN and pays the person you name,
          with a receipt for every transaction.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <LinkButton href="/wallet">Create your wallet</LinkButton>
          <Pill tone="ask">In development · Agents Open for Business</Pill>
          <a href={REPO_CELO_URL} className="text-sm font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink" rel="noreferrer">
            Follow the build on GitHub
          </a>
        </div>
      </section>

      <section id="how" className="scroll-mt-20 border-t border-line py-12">
        <Eyebrow>How it works</Eyebrow>
        <ol className="mt-6 grid gap-x-10 gap-y-8 md:grid-cols-2">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="num mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-sunken text-sm text-muted">{i + 1}</span>
              <div>
                <h2 className="text-[17px] font-semibold tracking-tight">{step.title}</h2>
                <p className="mt-1.5 leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="onchain" className="scroll-mt-20 border-t border-line py-12">
        <Eyebrow>On Celo mainnet today</Eyebrow>
        <p className="mt-3 max-w-2xl text-muted">Every line below links to the chain, so you can check it yourself.</p>
        <Card className="mt-6">
          <CardHeader title="Errand's agent" sub="Celo mainnet, chain 42220" />
          <dl className="divide-y divide-line">
            {FACTS.map((fact) => (
              <div key={fact.label} className="grid gap-1 px-5 py-4 sm:grid-cols-[200px_1fr] sm:gap-6">
                <dt className="text-sm font-medium">{fact.label}</dt>
                <dd>
                  {fact.href ? (
                    <a href={fact.href} className="num text-[15px] underline decoration-line-strong underline-offset-4 hover:decoration-ink" rel="noreferrer">
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

      <section id="status" className="scroll-mt-20 border-t border-line py-12">
        <Eyebrow>Build status</Eyebrow>
        <p className="mt-3 max-w-2xl text-muted">Only what has run on Celo mainnet is marked live. “Ready to try” works today but hasn’t made a mainnet transaction yet.</p>
        <ul className="mt-6 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-card">
          {STATUS.map((row) => (
            <li key={row.item} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <span className="text-[15px]">{row.item}</span>
              <span className="self-start sm:self-auto">
                <Pill tone={STATE_TONE[row.state]}>{STATE_LABEL[row.state]}</Pill>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
