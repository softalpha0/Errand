/**
 * Masks personal details in errand text before it is shown: receipts are public links.
 * Phone numbers keep the country code, the first digits and the last 4 (+234706•••0352);
 * emails keep the first letter and the domain (s•••@gmail.com). The owner still recognises them;
 * a stranger can't use them. Display only: the agent keeps the real values to run the errand.
 */
const EMAIL = /\b([A-Za-z0-9])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
const PHONE = /(\+?\d[\d\s-]{8,}\d)/g;

export function redactText(s: string): string {
  return s
    .replace(EMAIL, (_m, first: string, domain: string) => `${first}•••@${domain}`)
    .replace(PHONE, (m) => {
      const digits = m.replace(/[\s-]/g, "");
      if (digits.replace("+", "").length < 10) return m; // amounts, years, ids
      // Phone-shaped only: +country code, a local number starting with 0, or digits split by spaces/dashes.
      const phoneLike = m.startsWith("+") || /^0\d{9,10}$/.test(digits) || /[\s-]/.test(m.trim());
      if (!phoneLike) return m;
      const plus = digits.startsWith("+") ? "+" : "";
      const d = digits.replace("+", "");
      return `${plus}${d.slice(0, 6)}•••${d.slice(-4)}`;
    });
}

/** Deep copy of any JSON value with every string passed through redactText (ids and hashes are left alone). */
export function redactDeep<T>(v: T): T {
  if (typeof v === "string") return (/^0x[0-9a-fA-F]+$/.test(v) || /^[a-z]_[A-Za-z0-9]+$/.test(v) ? v : redactText(v)) as T;
  if (Array.isArray(v)) return v.map((x) => redactDeep(x)) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, redactDeep(x)])) as T;
  return v;
}
