// Stage-timing baselines: how many days each strain (and strain + container)
// takes to move between lifecycle stages, how confident we are in that, and
// whether a given batch departed from it.
//
// Pure functions only, so the same math runs on the batch page, the strain
// page, the batch list alerts and the node tests.

import { normalizeStage, STAGE_LABEL, STAGE_ORDER, type Stage } from "./stages.ts";

export interface TimingBatch {
  id: number;
  strain_id: number;
  container_type: string | null;
  stage: string;
  contamination_flag: boolean;
  inoculated_on: string | null;
  colonized_on: string | null;
  fruiting_on: string | null;
  spent_on: string | null;
  created_at?: string | null;
}

export interface TimingEvent {
  batch_id: number;
  stage: string;
  note?: string | null;
  occurred_at?: string | null;
  created_at?: string | null;
}

/** One measured step: the batch entered `from`, then entered `to` `days` later. */
export interface Transition {
  batchId: number;
  from: Stage;
  to: Stage;
  days: number;
  startedOn: string;
  endedOn: string;
}

/** The stage a batch is still in, with days elapsed so far. */
export interface OpenSegment {
  batchId: number;
  from: Stage;
  startedOn: string;
  days: number;
}

export interface TimingStats {
  n: number;
  mean: number;
  median: number;
  stdev: number;
  min: number;
  max: number;
  /** Typical range: 10th–90th percentile once there are 5+ runs, else min–max. */
  low: number;
  high: number;
  /** 0–100: grows with sample count (full at 10) and shrinks with spread. */
  confidence: number;
}

/** A batch needs this many comparable runs before we call anything unusual. */
export const MIN_SAMPLES = 3;
/** Confidence needed before automated alerts / label printing can be switched on. */
export const AUTOMATION_CONFIDENCE = 70;
const FULL_CONFIDENCE_SAMPLES = 10;

const DAY_MS = 86_400_000;

function dayOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  return Number.isFinite(Date.parse(`${day}T00:00:00Z`)) ? day : null;
}

export function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS);
}

function stageIndex(stage: string): number {
  return STAGE_ORDER.indexOf(normalizeStage(stage) as Stage);
}

/**
 * The day each lifecycle stage was entered. Stage events give the history;
 * the operator-entered date columns win where present because they are the
 * deliberate record (an advance clicked late is often back-dated).
 */
export function stageEntries(batch: TimingBatch, events: TimingEvent[]): Map<Stage, string> {
  const entries = new Map<Stage, string>();
  const ordered = events
    .map((event) => ({ ...event, day: dayOf(event.occurred_at ?? event.created_at) }))
    .filter((event): event is typeof event & { day: string } => event.day !== null)
    .sort((a, b) => String(a.occurred_at ?? a.created_at).localeCompare(String(b.occurred_at ?? b.created_at)));
  let last: Stage | null = null;
  for (const event of ordered) {
    if (event.stage === "undo") {
      // "Undid: Advanced to fruiting" reverts the matching mistaken entry.
      const undone = /to ([a-z_]+)\s*$/.exec(event.note ?? "")?.[1];
      if (last && undone && normalizeStage(undone) === last) {
        entries.delete(last);
        last = [...entries.keys()].sort((a, b) => stageIndex(a) - stageIndex(b)).at(-1) ?? null;
      }
      continue;
    }
    const idx = stageIndex(event.stage);
    if (idx < 0) continue;
    const stage = STAGE_ORDER[idx];
    // Moving backwards means the later entries were mistakes.
    for (const later of STAGE_ORDER.slice(idx + 1)) entries.delete(later);
    entries.set(stage, event.day);
    last = stage;
  }

  const start = dayOf(batch.inoculated_on) ?? dayOf(batch.colonized_on) ?? dayOf(batch.created_at);
  if (start) entries.set("colonization", start);
  const fruiting = dayOf(batch.fruiting_on);
  if (fruiting) entries.set("fruiting", fruiting);
  const spent = dayOf(batch.spent_on);
  if (spent) entries.set("spent", spent);

  // Anything past the batch's current stage was edited away.
  const current = stageIndex(batch.stage);
  if (current >= 0) for (const later of STAGE_ORDER.slice(current + 1)) entries.delete(later);
  return entries;
}

/** Completed steps plus the still-open one (if the batch is mid-cycle). */
export function batchTimeline(
  batch: TimingBatch,
  events: TimingEvent[],
  today: string = new Date().toISOString().slice(0, 10),
): { transitions: Transition[]; open: OpenSegment | null } {
  const entries = stageEntries(batch, events);
  const reached = STAGE_ORDER.filter((stage) => entries.has(stage));
  const transitions: Transition[] = [];
  for (let i = 1; i < reached.length; i++) {
    const from = reached[i - 1];
    const to = reached[i];
    const startedOn = entries.get(from)!;
    const endedOn = entries.get(to)!;
    const days = daysBetween(startedOn, endedOn);
    if (days >= 0) transitions.push({ batchId: batch.id, from, to, days, startedOn, endedOn });
  }
  const lastStage = reached.at(-1);
  const open =
    lastStage && lastStage !== "spent" && !batch.contamination_flag
      ? { batchId: batch.id, from: lastStage, startedOn: entries.get(lastStage)!, days: Math.max(0, daysBetween(entries.get(lastStage)!, today)) }
      : null;
  return { transitions, open };
}

function percentile(sorted: number[], p: number): number {
  const rank = (sorted.length - 1) * p;
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function summarize(samples: number[]): TimingStats | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((sum, d) => sum + d, 0) / n;
  const stdev = n > 1 ? Math.sqrt(sorted.reduce((sum, d) => sum + (d - mean) ** 2, 0) / (n - 1)) : 0;
  const cv = mean > 0 ? stdev / mean : 0;
  const sampleScore = Math.min(n, FULL_CONFIDENCE_SAMPLES) / FULL_CONFIDENCE_SAMPLES;
  const spreadScore = Math.max(0, Math.min(1, 1 - cv));
  return {
    n,
    mean: round1(mean),
    median: round1(percentile(sorted, 0.5)),
    stdev: round1(stdev),
    min: sorted[0],
    max: sorted[n - 1],
    low: n >= 5 ? Math.round(percentile(sorted, 0.1)) : sorted[0],
    high: n >= 5 ? Math.round(percentile(sorted, 0.9)) : sorted[n - 1],
    confidence: Math.round(100 * sampleScore * spreadScore),
  };
}

/** How far from the median counts as a real departure (days). */
export function tolerance(stats: TimingStats): number {
  return Math.max(2 * stats.stdev, 0.25 * stats.median, 2);
}

export type Direction = "slow" | "fast";

export function classify(days: number, stats: TimingStats | null): Direction | null {
  if (!stats || stats.n < MIN_SAMPLES) return null;
  const limit = tolerance(stats);
  if (days > stats.median + limit) return "slow";
  if (days < stats.median - limit) return "fast";
  return null;
}

export const transitionKey = (from: string, to: string) => `${from}>${to}`;

export function transitionLabel(from: Stage, to: Stage): string {
  return `${STAGE_LABEL[from]} → ${STAGE_LABEL[to]}`;
}

/** Everything known about one cohort of batches (a strain, or strain + container). */
export interface Baseline {
  /** Per (from>to) step. */
  transitions: Map<string, { from: Stage; to: Stage; stats: TimingStats; samples: Transition[] }>;
  /** Per from-stage: how long the stage lasts before the batch moves on, whatever comes next. */
  byFrom: Map<Stage, TimingStats>;
  /** The most-taken next stage for each from-stage. */
  usualNext: Map<Stage, Stage>;
}

export function buildBaseline(transitions: Transition[], exclude: Set<string> = new Set()): Baseline {
  const usable = transitions.filter((t) => !exclude.has(`${t.batchId}:${t.from}`));
  const grouped = new Map<string, Transition[]>();
  const fromGrouped = new Map<Stage, number[]>();
  for (const t of usable) {
    const key = transitionKey(t.from, t.to);
    grouped.set(key, [...(grouped.get(key) ?? []), t]);
    fromGrouped.set(t.from, [...(fromGrouped.get(t.from) ?? []), t.days]);
  }
  const out: Baseline["transitions"] = new Map();
  for (const [key, samples] of grouped) {
    out.set(key, { from: samples[0].from, to: samples[0].to, stats: summarize(samples.map((s) => s.days))!, samples });
  }
  const byFrom = new Map<Stage, TimingStats>();
  for (const [from, days] of fromGrouped) byFrom.set(from, summarize(days)!);
  const usualNext = new Map<Stage, Stage>();
  for (const from of fromGrouped.keys()) {
    const best = [...out.values()].filter((t) => t.from === from).sort((a, b) => b.stats.n - a.stats.n)[0];
    if (best) usualNext.set(from, best.to);
  }
  return { transitions: out, byFrom, usualNext };
}

/** The cohort's overall confidence: its weakest well-sampled step. */
export function baselineConfidence(baseline: Baseline): number {
  const scores = [...baseline.transitions.values()]
    .filter((t) => t.stats.n >= MIN_SAMPLES)
    .map((t) => t.stats.confidence);
  return scores.length ? Math.min(...scores) : 0;
}

export interface Departure {
  batchId: number;
  from: Stage;
  /** null while the batch is still in `from` and running long. */
  to: Stage | null;
  days: number;
  direction: Direction;
  expected: TimingStats;
}

/**
 * Steps where this batch was meaningfully slower or faster than its cohort.
 * Completed steps compare like-for-like (same from → to); a still-open stage is
 * only flagged once it has run past the usual upper limit.
 */
export function departures(
  timeline: { transitions: Transition[]; open: OpenSegment | null },
  baseline: Baseline,
): Departure[] {
  const found: Departure[] = [];
  for (const t of timeline.transitions) {
    const expected = baseline.transitions.get(transitionKey(t.from, t.to))?.stats ?? null;
    const direction = classify(t.days, expected);
    if (direction && expected) found.push({ batchId: t.batchId, from: t.from, to: t.to, days: t.days, direction, expected });
  }
  const open = timeline.open;
  if (open) {
    const expected = baseline.byFrom.get(open.from) ?? null;
    if (classify(open.days, expected) === "slow" && expected) {
      found.push({ batchId: open.batchId, from: open.from, to: null, days: open.days, direction: "slow", expected });
    }
  }
  return found;
}

export interface Prediction {
  batchId: number;
  from: Stage;
  next: Stage;
  startedOn: string;
  expectedOn: string;
  earliestOn: string;
  latestOn: string;
  /** Negative once the expected day has passed. */
  daysUntil: number;
  confidence: number;
}

function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + Math.round(n) * DAY_MS).toISOString().slice(0, 10);
}

export function predictNext(open: OpenSegment | null, baseline: Baseline, today: string): Prediction | null {
  if (!open) return null;
  const next = baseline.usualNext.get(open.from);
  const stats = next ? baseline.transitions.get(transitionKey(open.from, next))?.stats : undefined;
  if (!next || !stats || stats.n < MIN_SAMPLES) return null;
  const expectedOn = addDays(open.startedOn, stats.median);
  return {
    batchId: open.batchId,
    from: open.from,
    next,
    startedOn: open.startedOn,
    expectedOn,
    earliestOn: addDays(open.startedOn, stats.low),
    latestOn: addDays(open.startedOn, stats.high),
    daysUntil: daysBetween(today, expectedOn),
    confidence: stats.confidence,
  };
}

// ── Recorded explanations ──────────────────────────────────────────────────

export const TIMING_FACTORS = [
  { key: "temperature", label: "Temperature" },
  { key: "humidity", label: "Humidity" },
  { key: "fresh_air", label: "Fresh air / CO₂" },
  { key: "light", label: "Light" },
  { key: "substrate", label: "Substrate recipe" },
  { key: "spawn", label: "Spawn type / ratio" },
  { key: "container", label: "Container / tub size" },
  { key: "genetics", label: "Culture / genetics" },
  { key: "sterilization", label: "Sterilization / pasteurization" },
  { key: "contamination", label: "Contamination" },
  { key: "handling", label: "Handling / disturbance" },
  { key: "room", label: "Room / location" },
  { key: "other", label: "Other" },
] as const;

export type TimingFactor = (typeof TIMING_FACTORS)[number]["key"];
export const FACTOR_LABEL: Record<string, string> = Object.fromEntries(TIMING_FACTORS.map((f) => [f.key, f.label]));
export const VALID_FACTORS = new Set<string>(TIMING_FACTORS.map((f) => f.key));

export interface TimingNote {
  batch_id: number;
  from_stage: string;
  to_stage: string | null;
  observed_days: number;
  expected_days: number;
  direction: Direction;
  response: "changed" | "unchanged" | "dismissed";
  factors: string[];
  note: string;
}

/** Runs where the operator said parameters changed don't define "normal". */
export function explainedSegments(notes: TimingNote[]): Set<string> {
  return new Set(notes.filter((n) => n.response === "changed").map((n) => `${n.batch_id}:${n.from_stage}`));
}

export interface FactorSummary {
  factor: string;
  label: string;
  runs: number;
  slow: number;
  fast: number;
  /** Mean (observed − expected) days across those runs. */
  avgShift: number;
}

/** Tally of recorded reasons, so a new departure can show likely causes. */
export function factorSummary(notes: TimingNote[], direction?: Direction): FactorSummary[] {
  const rows = new Map<string, { runs: number; slow: number; fast: number; shift: number }>();
  for (const note of notes) {
    if (note.response !== "changed") continue;
    if (direction && note.direction !== direction) continue;
    for (const factor of note.factors) {
      const row = rows.get(factor) ?? { runs: 0, slow: 0, fast: 0, shift: 0 };
      row.runs += 1;
      row[note.direction] += 1;
      row.shift += note.observed_days - note.expected_days;
      rows.set(factor, row);
    }
  }
  return [...rows.entries()]
    .map(([factor, row]) => ({
      factor,
      label: FACTOR_LABEL[factor] ?? factor,
      runs: row.runs,
      slow: row.slow,
      fast: row.fast,
      avgShift: round1(row.shift / row.runs),
    }))
    .sort((a, b) => b.runs - a.runs || Math.abs(b.avgShift) - Math.abs(a.avgShift));
}

// ── Cohorts ────────────────────────────────────────────────────────────────

export interface CohortBaselines {
  strain: Baseline;
  container: Map<string, Baseline>;
}

export function cohortBaselines(
  batches: TimingBatch[],
  eventsByBatch: Map<number, TimingEvent[]>,
  notes: TimingNote[],
  today: string,
): { baselines: CohortBaselines; timelines: Map<number, ReturnType<typeof batchTimeline>> } {
  const exclude = explainedSegments(notes);
  const timelines = new Map<number, ReturnType<typeof batchTimeline>>();
  const all: Transition[] = [];
  const byContainer = new Map<string, Transition[]>();
  for (const batch of batches) {
    const timeline = batchTimeline(batch, eventsByBatch.get(batch.id) ?? [], today);
    timelines.set(batch.id, timeline);
    // Contaminated runs don't describe how the strain normally grows.
    if (batch.contamination_flag) continue;
    all.push(...timeline.transitions);
    const container = batch.container_type ?? "";
    byContainer.set(container, [...(byContainer.get(container) ?? []), ...timeline.transitions]);
  }
  const container = new Map<string, Baseline>();
  for (const [key, transitions] of byContainer) container.set(key, buildBaseline(transitions, exclude));
  return { baselines: { strain: buildBaseline(all, exclude), container }, timelines };
}

/**
 * The most specific baseline with enough data: strain + container when that
 * cohort has MIN_SAMPLES for the step in question, otherwise the whole strain.
 */
export function baselineFor(
  baselines: CohortBaselines,
  containerType: string | null,
  from: Stage,
): { baseline: Baseline; scope: "container" | "strain" } {
  const specific = baselines.container.get(containerType ?? "");
  if (specific && (specific.byFrom.get(from)?.n ?? 0) >= MIN_SAMPLES) return { baseline: specific, scope: "container" };
  return { baseline: baselines.strain, scope: "strain" };
}

/** Departures for one batch, each judged against its most specific usable cohort. */
export function batchDepartures(
  batch: TimingBatch,
  timeline: ReturnType<typeof batchTimeline>,
  baselines: CohortBaselines,
): (Departure & { scope: "container" | "strain" })[] {
  const out: (Departure & { scope: "container" | "strain" })[] = [];
  for (const from of STAGE_ORDER) {
    const { baseline, scope } = baselineFor(baselines, batch.container_type, from);
    const slice = {
      transitions: timeline.transitions.filter((t) => t.from === from),
      open: timeline.open?.from === from ? timeline.open : null,
    };
    for (const d of departures(slice, baseline)) out.push({ ...d, scope });
  }
  return out;
}
