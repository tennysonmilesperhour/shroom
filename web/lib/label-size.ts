import type { CSSProperties } from "react";

export interface LabelSize {
  key: string;
  label: string;
  w: number;
  h: number;
  // Type, spacing and QR scale relative to the original small-stock design.
  scale: number;
}

export const LABEL_SIZES: LabelSize[] = [
  { key: "sm", label: '2.0 × 1.0"', w: 2.0, h: 1.0, scale: 1 },
  { key: "md", label: '2.25 × 1.25"', w: 2.25, h: 1.25, scale: 1 },
  { key: "lg", label: '4.0 × 2.0"', w: 4.0, h: 2.0, scale: 1 },
  { key: "xl", label: '6.0 × 4.0"', w: 6.0, h: 4.0, scale: 2.5 },
];

export const DEFAULT_LABEL_SIZE: LabelSize = LABEL_SIZES.find((size) => size.key === "xl")!;

export function sizeFor(key: string | undefined): LabelSize {
  return LABEL_SIZES.find((size) => size.key === key) ?? DEFAULT_LABEL_SIZE;
}

// Custom properties the label stylesheet (globals.css §22) sizes a sheet from:
// the physical stock for print, plus the sheet's width and height in scaled
// px so the on-screen preview can shrink to fit a phone without reflowing.
export function labelSheetStyle(size: LabelSize): CSSProperties {
  return {
    "--label-w": `${size.w}in`,
    "--label-h": `${size.h}in`,
    "--label-scale": size.scale,
    "--label-wu": (size.w * 96) / size.scale,
    "--label-hu": (size.h * 96) / size.scale,
  } as CSSProperties;
}
