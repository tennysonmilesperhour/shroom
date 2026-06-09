// Display helpers. The operator works in °F / grams, so we localize here while
// the database stays normalized in °C / kg.

export const cToF = (c: number | null | undefined) =>
  c == null ? null : Math.round((c * 9) / 5 + 32);

export const kgToG = (kg: number | null | undefined) =>
  kg == null ? 0 : Math.round(kg * 1000);

export const kgToLb = (kg: number | null | undefined) =>
  kg == null ? 0 : Math.round(kg * 2.20462 * 10) / 10;

export const money = (n: number | null | undefined) =>
  `$${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export const stars = (n: number | null | undefined) =>
  "★".repeat(n ?? 0) + "☆".repeat(Math.max(0, 5 - (n ?? 0)));

// Map a free-text potency label to a 0..1 strength for the quality bars.
// Recognized tiers map to fixed levels; any other non-empty text lands
// mid-scale; a blank or em-dash means "unrated" (null → empty bar).
export function potencyLevel(p: string | null | undefined): number | null {
  if (!p) return null;
  const s = p.trim().toLowerCase();
  if (!s || s === "—" || s === "-" || s === "n/a") return null;
  const map: Record<string, number> = {
    none: 0.1,
    low: 0.3,
    mild: 0.35,
    nootropic: 0.5,
    medium: 0.55,
    moderate: 0.55,
    "above average": 0.65,
    high: 0.78,
    "very high": 0.92,
    extreme: 1,
  };
  return map[s] ?? 0.55;
}

export const ease = (n: number | null | undefined) =>
  n == null ? "-" : `${n}/10`;

export const DRY_FLOOR = 7.5;
