// Shared vocabularies for the Cultures & Spores register. Kept in one place so
// the page, the add form, and the server actions can never drift apart.

import type { BadgeTone } from "@/components/ui";

// The form / medium a culture or spore unit takes. Roughly ordered from raw
// genetics toward ready-to-spawn material.
export const CULTURE_TYPES = [
  ["spore_print", "Spore print"],
  ["spore_swab", "Spore swab"],
  ["spore_syringe", "Spore syringe"],
  ["agar_plate", "Agar plate"],
  ["liquid_culture", "Liquid culture"],
  ["grain_spawn", "Grain spawn"],
  ["slant", "Slant (long-term)"],
] as const;

export type CultureType = (typeof CULTURE_TYPES)[number][0];
export const CULTURE_TYPE_VALUES = CULTURE_TYPES.map(([v]) => v) as readonly string[];
const TYPE_LABELS = new Map<string, string>(CULTURE_TYPES);
export const cultureTypeLabel = (v: string) => TYPE_LABELS.get(v) ?? v;

// Lifecycle pipeline, in order. Each unit moves left -> right as it goes from
// "ordered" all the way to "ready to use" (and eventually consumed). The label
// is what the operator sees; the tone drives the status badge colour.
export const CULTURE_STATUSES: readonly (readonly [
  value: string,
  label: string,
  tone: BadgeTone,
])[] = [
  ["ordered", "Ordered", "amber"],
  ["in_transit", "In transit", "amber"],
  ["stored", "In the fridge", "blue"], // received, ready to inoculate
  ["inoculating", "Inoculating", "violet"],
  ["colonizing", "Colonizing", "violet"],
  ["ready", "Ready to use", "green"],
  ["consumed", "Used up", "muted"],
  ["contaminated", "Contaminated", "red"],
];

export const CULTURE_STATUS_VALUES = CULTURE_STATUSES.map(([v]) => v) as readonly string[];
const STATUS_META = new Map(CULTURE_STATUSES.map(([v, label, tone]) => [v, { label, tone }]));
export const cultureStatusLabel = (v: string) => STATUS_META.get(v)?.label ?? v;
export const cultureStatusTone = (v: string): BadgeTone => STATUS_META.get(v)?.tone ?? "muted";
export const cultureStatusOrder = (v: string) => {
  const i = CULTURE_STATUS_VALUES.indexOf(v);
  return i === -1 ? CULTURE_STATUS_VALUES.length : i;
};
