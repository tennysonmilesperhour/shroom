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

export const ease = (n: number | null | undefined) =>
  n == null ? "—" : `${n}/10`;

export const DRY_FLOOR = 7.5;
