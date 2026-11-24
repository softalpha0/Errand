/**
 * Daily check limits per caller. Self Agent ID decides the tier:
 *  - verified: a real, unique human stands behind the agent (Self Agent ID) → higher limit, counted per human
 *  - unverified: no valid Self Agent ID signature → lower limit, counted per IP
 * Checked BEFORE payment, so a caller over its limit is refused with 429 and never charged.
 * In memory: resets when the service restarts (fine for the hackathon; noted in the README).
 */
export type Tier = "verified" | "unverified";

export const DAILY_LIMITS: Record<Tier, number> = { verified: 100, unverified: 3 };

export class DailyLimiter {
  private counts = new Map<string, number>();
  private day = "";
  private recent = new Map<string, { fingerprint: string; at: number }[]>();

  constructor(
    private readonly limits: Record<Tier, number> = DAILY_LIMITS,
    private readonly now: () => number = Date.now,
  ) {}

  private roll() {
    const today = new Date(this.now()).toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.counts.clear();
    }
  }

  /** How many checks this caller has used today, and its limit. Doesn't count anything. */
  peek(tier: Tier, callerId: string): { used: number; limit: number; remaining: number } {
    this.roll();
    const used = this.counts.get(`${tier}:${callerId}`) ?? 0;
    const limit = this.limits[tier];
    return { used, limit, remaining: Math.max(0, limit - used) };
  }

  /** Counts one check (call only after the check was paid and served). */
  record(tier: Tier, callerId: string): void {
    this.roll();
    const key = `${tier}:${callerId}`;
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  /** Fingerprints this caller checked in the last `windowMs` (for the duplicate rule). */
  recentFingerprints(callerId: string, windowMs = 10 * 60 * 1000): Set<string> {
    const cutoff = this.now() - windowMs;
    const list = (this.recent.get(callerId) ?? []).filter((r) => r.at >= cutoff);
    this.recent.set(callerId, list);
    return new Set(list.map((r) => r.fingerprint));
  }

  remember(callerId: string, fingerprint: string): void {
    const list = this.recent.get(callerId) ?? [];
    list.push({ fingerprint, at: this.now() });
    this.recent.set(callerId, list.slice(-50));
  }
}
