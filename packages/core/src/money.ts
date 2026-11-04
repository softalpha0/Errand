/** Money is handled in USD with micro-dollar rounding to avoid float drift. */

export function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

export function sumUsd(values: number[]): number {
  return round6(values.reduce((a, b) => a + b, 0));
}

/** Format for display. Sub-cent amounts keep their precision ($0.002). */
export function formatUsd(n: number): string {
  if (n === 0) return "$0.00";
  if (Math.abs(n) < 0.01) {
    return `$${round6(n).toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}`;
  }
  return `$${n.toFixed(2)}`;
}

/** USDC has 6 decimals on every chain Errand pays on. */
export function usdcUnitsToUsd(units: string | number): number {
  return round6(Number(units) / 1_000_000);
}
