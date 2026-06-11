// Strain "spectrum" math + types. Powers the color-wheel on the Strains pages.
//
// Honest encoding (see migration 14 + the research brief):
//   radius (center -> edge) = measured total tryptamine % dry weight  [lab-grounded]
//   angle / hue             = reported experiential character          [anecdotal]
// Hues are oklch degrees so dots sit on the matching color of the ring.

import type { BadgeTone } from "@/components/ui";

export interface SpectrumStrain {
  id: number;
  name: string;
  totalPct: number | null;
  lowPct: number | null;
  highPct: number | null;
  hue: number; // oklch degrees, 0-360
  potencyTier: string | null;
  evidenceGrade: string | null;
  tags: string[];
}

// Potency window the radius is normalized against (% dry weight total tryptamine).
// ~0.4% = a weak cube; ~2.6% = exceptional (Enigma-class), short of the 3.82%
// all-time Psilocybin Cup record so the wheel keeps headroom.
export const POTENCY_MIN = 0.4;
export const POTENCY_MAX = 2.6;

/** oklch color for a given wheel hue. */
export function hueColor(hue: number, lightnessPct = 72, chroma = 0.17): string {
  return `oklch(${lightnessPct}% ${chroma} ${hue})`;
}

/** Map total tryptamine % to a 0..1 radial fraction (clamped). */
export function potencyRadius(totalPct: number | null): number {
  if (totalPct == null) return 0.18;
  const t = (totalPct - POTENCY_MIN) / (POTENCY_MAX - POTENCY_MIN);
  return Math.min(1, Math.max(0, t));
}

/** Geometric point for a hue (deg) + radial fraction inside a ring [innerR, outerR]. */
export function polarPoint(
  hueDeg: number,
  radiusFrac: number,
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
): { x: number; y: number } {
  const r = innerR + radiusFrac * (outerR - innerR);
  const theta = (hueDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(theta), y: cy - r * Math.sin(theta) };
}

export function evidenceTone(grade: string | null | undefined): BadgeTone {
  switch (grade) {
    case "established":
      return "green";
    case "mixed":
      return "blue";
    default:
      return "muted";
  }
}

export function evidenceLabel(grade: string | null | undefined): string {
  switch (grade) {
    case "established":
      return "Established";
    case "mixed":
      return "Some lab support";
    case "anecdotal":
      return "Anecdotal";
    default:
      return "Unrated";
  }
}

/** Split a representative total into psilocybin / psilocin grams-per-100g using
 *  the typical psilocin:psilocybin ratio (handling-dependent). Returns percents. */
export function alkaloidSplit(
  totalPct: number | null,
  ratio: number | null,
): { psilocybin: number; psilocin: number } | null {
  if (totalPct == null) return null;
  const r = ratio ?? 0.1;
  const psilocybin = totalPct / (1 + r);
  const psilocin = totalPct - psilocybin;
  return { psilocybin, psilocin };
}
