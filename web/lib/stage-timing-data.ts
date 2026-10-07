import type { SupabaseClient } from "@supabase/supabase-js";
import { soft } from "@/lib/query";
import {
  baselineConfidence,
  baselineFor,
  cohortBaselines,
  daysBetween,
  predictNext,
  type CohortBaselines,
  type Prediction,
  type TimingBatch,
  type TimingEvent,
  type TimingNote,
} from "@/lib/stage-timing";

const BATCH_COLUMNS =
  "id,lot_code,strain_id,container_type,stage,contamination_flag,inoculated_on,colonized_on,fruiting_on,spent_on,created_at,spawn_type,substrate_type,tub_size,room_id";

export interface StrainTimingBatch extends TimingBatch {
  lot_code: string;
  spawn_type: string | null;
  substrate_type: string | null;
  tub_size: string | null;
  room_id: number | null;
}

export interface StrainTimingData {
  batches: StrainTimingBatch[];
  eventsByBatch: Map<number, TimingEvent[]>;
  notes: (TimingNote & { id: number; created_at: string })[];
}

export interface AutomationRow {
  strain_id: number;
  alerts_enabled: boolean;
  labels_enabled: boolean;
}

/** All batches, stage history and recorded explanations for the given strains. */
export async function loadStrainTiming(
  supabase: SupabaseClient,
  strainIds: number[],
): Promise<StrainTimingData> {
  if (strainIds.length === 0) return { batches: [], eventsByBatch: new Map(), notes: [] };
  const batches = await soft<StrainTimingBatch>(
    supabase.from("batches").select(BATCH_COLUMNS).in("strain_id", strainIds),
  );
  const ids = batches.map((b) => b.id);
  const eventsByBatch = new Map<number, TimingEvent[]>();
  const notes: StrainTimingData["notes"] = [];
  // Chunk so the id list stays well inside URL limits.
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const [events, chunkNotes] = await Promise.all([
      soft<TimingEvent>(
        supabase.from("stage_events").select("batch_id,stage,note,occurred_at").in("batch_id", chunk),
      ),
      soft<StrainTimingData["notes"][number]>(
        supabase
          .from("stage_timing_notes")
          .select("id,batch_id,from_stage,to_stage,observed_days,expected_days,direction,response,factors,note,created_at")
          .in("batch_id", chunk),
      ),
    ]);
    for (const event of events) eventsByBatch.set(event.batch_id, [...(eventsByBatch.get(event.batch_id) ?? []), event]);
    notes.push(...chunkNotes);
  }
  return { batches, eventsByBatch, notes };
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Baselines for one strain, optionally leaving one batch out (so it isn't judged against itself). */
export function strainBaselines(
  data: StrainTimingData,
  strainId: number,
  excludeBatchId?: number,
): CohortBaselines {
  const batches = data.batches.filter((b) => b.strain_id === strainId && b.id !== excludeBatchId);
  return cohortBaselines(batches, data.eventsByBatch, data.notes, today()).baselines;
}

export async function loadAutomation(supabase: SupabaseClient, strainIds?: number[]): Promise<AutomationRow[]> {
  const query = supabase.from("stage_timing_automation").select("strain_id,alerts_enabled,labels_enabled");
  return soft<AutomationRow>(strainIds ? query.in("strain_id", strainIds) : query);
}

const STALE_AFTER_DAYS = 7;

export interface UpcomingStage extends Prediction {
  lotCode: string;
  strainId: number;
  labels: boolean;
}

/**
 * Active batches of strains with automation switched on, whose next stage is
 * expected within `horizonDays` (or already overdue). Automation only counts
 * while the strain's confidence still clears the bar.
 */
export async function loadUpcomingStages(
  supabase: SupabaseClient,
  strainIds: number[],
  horizonDays = 2,
  minConfidence = 0,
): Promise<UpcomingStage[]> {
  const automation = (await loadAutomation(supabase, strainIds)).filter((a) => a.alerts_enabled || a.labels_enabled);
  if (automation.length === 0) return [];
  const data = await loadStrainTiming(supabase, automation.map((a) => a.strain_id));
  const now = today();
  const upcoming: UpcomingStage[] = [];
  for (const auto of automation) {
    const batches = data.batches.filter((b) => b.strain_id === auto.strain_id);
    const { baselines, timelines } = cohortBaselines(batches, data.eventsByBatch, data.notes, now);
    if (baselineConfidence(baselines.strain) < minConfidence) continue;
    for (const batch of batches) {
      const open = timelines.get(batch.id)?.open ?? null;
      if (!open) continue;
      const { baseline } = baselineFor(baselines, batch.container_type, open.from);
      const prediction = predictNext(open, baseline, now);
      // Long past the usual window means the stage change probably went unrecorded;
      // the batch page prompt handles that, so keep the alert list current.
      if (prediction && prediction.daysUntil <= horizonDays && daysBetween(prediction.latestOn, now) <= STALE_AFTER_DAYS) {
        upcoming.push({ ...prediction, lotCode: batch.lot_code, strainId: batch.strain_id, labels: auto.labels_enabled });
      }
    }
  }
  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
}

