import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 select-none";
const sizes = { md: "h-11 px-5 text-[15px]", sm: "h-9 px-4 text-sm", lg: "h-12 px-6 text-base" };
const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink/85",
  secondary: "border border-line-strong bg-card text-ink hover:border-ink/40",
  ghost: "text-muted hover:text-ink hover:bg-sunken",
  danger: "border border-block/30 text-block hover:bg-block-soft",
};

export function Button({ variant = "primary", size = "md", className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <button className={cx(base, sizes[size], variants[variant], className)} {...props} />;
}

export function LinkButton({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <Link className={cx(base, sizes[size], variants[variant], className)} {...props} />;
}

export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section className={cx("rounded-[var(--radius-card)] border border-line bg-card", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({ title, aside, sub }: { title: ReactNode; aside?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {sub ? <p className="mt-0.5 text-sm text-muted">{sub}</p> : null}
      </div>
      {aside}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[13px] font-medium tracking-wide text-muted uppercase">{children}</p>;
}

type Tone = "neutral" | "approve" | "block" | "ask" | "live";
const tones: Record<Tone, string> = {
  neutral: "bg-sunken text-muted",
  approve: "bg-accent-soft text-accent",
  block: "bg-block-soft text-block",
  ask: "bg-ask-soft text-ask",
  live: "bg-ink text-paper",
};

export function Pill({ tone = "neutral", children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cx("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap", tones[tone])}>
      {dot ? <span className="pulse-dot size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function Money({ usd, className }: { usd: number; className?: string }) {
  const text = usd === 0 ? "$0.00" : Math.abs(usd) < 0.01 ? `$${usd.toFixed(4).replace(/0+$/, "")}` : `$${usd.toFixed(2)}`;
  return <span className={cx("num", className)}>{text}</span>;
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[13px] leading-snug text-muted">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  "h-11 w-full rounded-xl border border-line-strong bg-card px-3.5 text-[15px] text-ink placeholder:text-faint focus:border-ink/50 focus:outline-none focus-visible:outline-2";

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-block/25 bg-block-soft px-4 py-3 text-sm text-block">
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-sunken motion-reduce:animate-none", className)} />;
}
