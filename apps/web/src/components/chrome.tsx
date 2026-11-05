import Link from "next/link";
import { LinkButton } from "./ui";

const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/softalpha0/Errand";

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
          <Link href="/repeat" className="hidden rounded-full px-3 py-2 text-muted hover:text-ink sm:block">
            Repeat
          </Link>
          <Link href="/stats" className="hidden rounded-full px-3 py-2 text-muted hover:text-ink md:block">
            Results
          </Link>
          <Link href="/connect" className="rounded-full px-3 py-2 text-muted hover:text-ink">
            <span className="sm:hidden">Passport</span>
            <span className="hidden sm:inline">Your Passport</span>
          </Link>
          <LinkButton href="/new" size="sm" className="ml-2">
            Start an errand
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
            Built for SERV Hackathon 02, Kite track. Reasoning by SERV, payments by Kite Agent Passport, independent grading by Reppo.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-2">
          <Link href="/new" className="hover:text-ink">
            Start an errand
          </Link>
          <Link href="/stats" className="hover:text-ink">
            Results
          </Link>
          <Link href="/#guarantees" className="hover:text-ink">
            Guarantees
          </Link>
          <Link href="/trap" className="hover:text-ink">
            Guard test page
          </Link>
          <Link href="/repeat" className="hover:text-ink">
            Repeat an errand
          </Link>
          <Link href="/connect" className="hover:text-ink">
            Connect your Passport
          </Link>
          <a href={REPO_URL} className="hover:text-ink" rel="noreferrer">
            Source code
          </a>
          <a href="https://agentpassport.ai" className="hover:text-ink" rel="noreferrer">
            Kite Passport
          </a>
        </div>
      </div>
    </footer>
  );
}
