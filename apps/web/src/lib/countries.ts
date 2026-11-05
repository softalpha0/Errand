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

/** Best guess from the browser's language setting (en-NG → NG), else Nigeria. */
export function guessCountry(): string {
  if (typeof navigator === "undefined") return "NG";
  for (const lang of navigator.languages ?? [navigator.language]) {
    const region = lang.split("-")[1]?.toUpperCase();
    if (region && COUNTRIES.some((c) => c.code === region)) return region;
  }
  return "NG";
}
