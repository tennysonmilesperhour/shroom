// Single source of truth for the batch lifecycle.
//
// The lifecycle begins at "colonization": creating a batch *is* the
// inoculation event (the `inoculated_on` date still records when), so there
// is no separate "inoculation" stage in the cycle. Legacy rows that still
// carry "inoculation" are normalized to "colonization" everywhere.

export const STAGE_ORDER = [
  "colonization",
  "spawn_to_bulk",
  "fruiting",
  "harvesting",
  "spent",
] as const;

export type Stage = (typeof STAGE_ORDER)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  colonization: "Colonization",
  spawn_to_bulk: "Spawn to bulk",
  fruiting: "Fruiting",
  harvesting: "Harvesting",
  spent: "Spent",
};

/** Stages accepted on write, including the terminal "contaminated" flag. */
export const VALID_STAGES = new Set<string>([...STAGE_ORDER, "contaminated"]);

/** Map any stored stage to a current one (legacy "inoculation" → colonization). */
export function normalizeStage(stage: string): string {
  return stage === "inoculation" ? "colonization" : stage;
}

/** The next stage in the cycle, or null at the end / off-cycle. */
export function nextStage(stage: string): Stage | null {
  const idx = STAGE_ORDER.indexOf(normalizeStage(stage) as Stage);
  if (idx < 0 || idx === STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}
