import Link from "next/link";
import { REPO_CELO_URL } from "@/lib/celo";
import { LinkButton } from "./ui";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight" aria-label="Errand home">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
        <path d="M4 2.5h14v16.2l-2.33-1.4-2.34 1.4-2.33-1.4-2.33 1.4-2.34-1.4L4 18.7z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M7.5 7h7M7.5 10h7M7.5 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="text-[17px]">Errand</span>
    </Link>
  );
}

export function Header() {
  return (
    <header className="no-print sticky top-0 z-20 border-b border-line/70 bg-paper/95 backdrop-blur-[2px]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-sm" aria-label="Main">
          <Link href="/#how" className="hidden rounded-full px-3 py-2 text-muted hover:text-ink sm:block">
            How it works
          </Link>
          <Link href="/errand" className="rounded-full px-3 py-2 text-muted hover:text-ink">
            New errand
          </Link>
          <Link href="/#onchain" className="hidden rounded-full px-3 py-2 text-muted hover:text-ink sm:block">
            On Celo
          </Link>
          <Link href="/#status" className="hidden rounded-full px-3 py-2 text-muted hover:text-ink sm:block">
            Status
          </Link>
          <a href={REPO_CELO_URL} className="hidden rounded-full px-3 py-2 text-muted hover:text-ink sm:block" rel="noreferrer">
            Source
          </a>
          <LinkButton href="/wallet" size="sm" className="ml-2">
            Your wallet
          </LinkButton>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="no-print mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-muted sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 leading-relaxed">
            Built for Agents Open for Business on Celo (Loops House). Wallets by Altana, currency conversion by Textile FX, agent identity by Self Agent ID and ERC-8004.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-2">
          <Link href="/wallet" className="hover:text-ink">
            Your wallet
          </Link>
          <Link href="/errand" className="hover:text-ink">
            New errand
          </Link>
          <Link href="/#onchain" className="hover:text-ink">
            On Celo mainnet
          </Link>
          <Link href="/#status" className="hover:text-ink">
            Build status
          </Link>
          <a href={REPO_CELO_URL} className="hover:text-ink" rel="noreferrer">
            Source code
          </a>
          <a href="https://celo.org" className="hover:text-ink" rel="noreferrer">
            Celo
          </a>
          <a href="/.well-known/errand-agent.json" className="hover:text-ink">
            Agent card (ERC-8004)
          </a>
        </div>
      </div>
    </footer>
  );
}
