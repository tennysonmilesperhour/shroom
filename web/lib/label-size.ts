export interface LabelSize {
  key: string;
  label: string;
  w: number;
  h: number;
}

export const LABEL_SIZES: LabelSize[] = [
  { key: "sm", label: '2.0 × 1.0"', w: 2.0, h: 1.0 },
  { key: "md", label: '2.25 × 1.25"', w: 2.25, h: 1.25 },
  { key: "lg", label: '4.0 × 2.0"', w: 4.0, h: 2.0 },
];

export function sizeFor(key: string | undefined): LabelSize {
  return LABEL_SIZES.find((size) => size.key === key) ?? LABEL_SIZES[1];
}
