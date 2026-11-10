/** Countries for the "Your country" picker: phone numbers written without +code are read as this country's. */
export const COUNTRIES: { code: string; name: string }[] = [
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "KE", name: "Kenya" },
  { code: "ZA", name: "South Africa" },
  { code: "EG", name: "Egypt" },
  { code: "CM", name: "Cameroon" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "SN", name: "Senegal" },
  { code: "UG", name: "Uganda" },
  { code: "TZ", name: "Tanzania" },
  { code: "RW", name: "Rwanda" },
  { code: "ET", name: "Ethiopia" },
  { code: "MA", name: "Morocco" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "IN", name: "India" },
  { code: "PK", name: "Pakistan" },
  { code: "BD", name: "Bangladesh" },
  { code: "PH", name: "Philippines" },
  { code: "ID", name: "Indonesia" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "AU", name: "Australia" },
];

/** Time zone → country. The time zone follows where the computer is; the language often says en-US anywhere. */
const ZONES: Record<string, string> = {
  "Africa/Lagos": "NG", "Africa/Accra": "GH", "Africa/Nairobi": "KE", "Africa/Johannesburg": "ZA", "Africa/Cairo": "EG",
  "Africa/Douala": "CM", "Africa/Abidjan": "CI", "Africa/Dakar": "SN", "Africa/Kampala": "UG", "Africa/Dar_es_Salaam": "TZ",
  "Africa/Kigali": "RW", "Africa/Addis_Ababa": "ET", "Africa/Casablanca": "MA", "Europe/London": "GB", "Europe/Dublin": "IE",
  "Europe/Berlin": "DE", "Europe/Paris": "FR", "Europe/Amsterdam": "NL", "Europe/Madrid": "ES", "Europe/Rome": "IT",
  "Asia/Dubai": "AE", "Asia/Riyadh": "SA", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Karachi": "PK", "Asia/Dhaka": "BD", "Asia/Manila": "PH",
  "Asia/Jakarta": "ID", "America/Sao_Paulo": "BR", "America/Mexico_City": "MX", "America/Toronto": "CA", "America/Vancouver": "CA",
  "Australia/Sydney": "AU", "Australia/Melbourne": "AU",
};

/** This visitor's country from their time zone, then their browser language; null when we can't tell. */
export function detectCountry(): string | null {
  if (typeof navigator === "undefined") return null;
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (ZONES[zone]) return ZONES[zone]!;
    if (zone?.startsWith("America/") && !zone.includes("Sao_Paulo")) return "US";
  } catch {
    /* no Intl time zone: fall through to the language */
  }
  for (const lang of navigator.languages ?? [navigator.language]) {
    const region = lang.split("-")[1]?.toUpperCase();
    if (region && region !== "US" && COUNTRIES.some((c) => c.code === region)) return region;
  }
  return null;
}

/** Best guess for the country picker: the detected country, else Nigeria. */
export function guessCountry(): string {
  return detectCountry() ?? "NG";
}

/**
 * An example errand for the composer, in the visitor's own currency, carrier and number format.
 * Numbers are samples in each country's format (US and UK use their reserved fictional ranges).
 */
const EXAMPLE_TOPUPS: Record<string, string> = {
  NG: "Send NGN 1,000 MTN airtime to my mum on 0803 123 4567",
  GH: "Send GHS 20 of MTN airtime to my mum on 024 123 4567",
  KE: "Send KES 200 of Safaricom airtime to my mum on 0712 345 678",
  ZA: "Send R50 of Vodacom airtime to my mum on 082 123 4567",
  EG: "Send EGP 100 of Vodafone credit to my mum on 010 1234 5678",
  UG: "Send UGX 10,000 of MTN airtime to my mum on 0772 123 456",
  TZ: "Send TZS 5,000 of Vodacom airtime to my mum on 0754 123 456",
  IN: "Recharge my mum's Jio number 98765 43210 with ₹199",
  PK: "Send PKR 500 of Jazz load to my mum on 0300 1234567",
  BD: "Send BDT 100 of Grameenphone recharge to my mum on 01712 345678",
  PH: "Send ₱100 of Globe load to my mum on 0917 123 4567",
  ID: "Send Rp50.000 of Telkomsel credit to my mum on 0812 3456 7890",
  BR: "Send R$20 of Vivo credit to my mum on (11) 91234-5678",
  MX: "Send $100 MXN of Telcel airtime to my mum on 55 1234 5678",
  US: "Send $10 of prepaid airtime to my mum on (415) 555-0100",
  CA: "Send $10 of prepaid airtime to my mum on (416) 555-0100",
  GB: "Send a £10 top-up to my mum on 07700 900123",
};

export function taskPlaceholder(country: string | null): string {
  const topup = country ? EXAMPLE_TOPUPS[country] : undefined;
  return topup
    ? `${topup} and email me the receipt at me@example.com.`
    : "Find a 7-day eSIM for my trip to Lisbon, buy the cheapest one under $8, and email me the QR details at me@example.com.";
}
