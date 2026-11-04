/**
 * Phone numbers decide where a top-up lands, and a top-up to the wrong number
 * cannot be undone. Everything is compared in E.164 form (+2348031234567).
 */

const DIAL_CODES: Record<string, string> = {
  NG: "234",
  GH: "233",
  KE: "254",
  ZA: "27",
  UG: "256",
  TZ: "255",
  RW: "250",
  CM: "237",
  SN: "221",
  CI: "225",
  EG: "20",
  MA: "212",
  US: "1",
  CA: "1",
  GB: "44",
  IN: "91",
  PH: "63",
  BR: "55",
  MX: "52",
};

export function dialCode(country: string): string | undefined {
  return DIAL_CODES[country.toUpperCase()];
}

/**
 * Normalise a phone number to E.164.
 * "0803 123 4567" with NG -> "+2348031234567"; "+1 (415) 555-0100" -> "+14155550100".
 * Returns null when the number cannot be read with confidence.
 */
export function normalizePhone(input: string, defaultCountry = "NG"): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return null;

  if (hasPlus) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  const code = dialCode(defaultCountry);
  if (!code) return null;

  if (digits.startsWith(code) && digits.length > code.length + 6) {
    return `+${digits}`;
  }
  if (code === "1") {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return null;
  }
  if (digits.startsWith("0")) digits = digits.slice(1);
  const full = `${code}${digits}`;
  return full.length >= 9 && full.length <= 15 ? `+${full}` : null;
}

export function samePhone(a: string, b: string, defaultCountry = "NG"): boolean {
  const na = normalizePhone(a, defaultCountry);
  const nb = normalizePhone(b, defaultCountry);
  return na !== null && na === nb;
}

/** StablePhone only accepts +1 numbers. */
export function isNorthAmerican(e164: string): boolean {
  return /^\+1\d{10}$/.test(e164);
}

export function maskPhone(e164: string): string {
  if (e164.length < 8) return e164;
  return `${e164.slice(0, e164.length - 7)}•••${e164.slice(-4)}`;
}
