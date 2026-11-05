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
  "Asia/Dubai": "AE", "Asia/Riyadh": "SA", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Karachi": "PK", "Asia/Manila": "PH",
  "Asia/Jakarta": "ID", "America/Sao_Paulo": "BR", "America/Mexico_City": "MX", "America/Toronto": "CA", "America/Vancouver": "CA",
  "Australia/Sydney": "AU", "Australia/Melbourne": "AU",
};

/** Best guess for this visitor: their time zone first, then the browser language, else Nigeria. */
export function guessCountry(): string {
  if (typeof navigator === "undefined") return "NG";
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
  return "NG";
}
