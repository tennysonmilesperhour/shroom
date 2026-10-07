"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/utils/supabase/service";
import type { EntityResult } from "@/components/EntityForm";
import { loadStrainTiming, strainBaselines, today } from "@/lib/stage-timing-data";
import {
  AUTOMATION_CONFIDENCE,
  baselineConfidence,
  batchDepartures,
  batchTimeline,
  VALID_FACTORS,
} from "@/lib/stage-timing";
import { STAGE_ORDER, type Stage } from "@/lib/stages";

const RESPONSES = new Set(["changed", "unchanged", "dismissed"]);

/**
 * Record the operator's answer to "this step ran unusually long/short — did
 * anything change?". The departure is recomputed here so the stored numbers
 * always match what the baseline said at the time.
 */
export async function recordTimingNote(input: {
  batchId: number;
  fromStage: string;
  response: string;
  factors?: string[];
  note?: string;
}): Promise<EntityResult> {
  const { batchId, fromStage, response } = input;
  if (!Number.isSafeInteger(batchId) || batchId <= 0) return { ok: false, message: "Invalid batch." };
  if (!STAGE_ORDER.includes(fromStage as Stage)) return { ok: false, message: "Invalid stage." };
  if (!RESPONSES.has(response)) return { ok: false, message: "Invalid response." };
  const factors = response === "changed" ? [...new Set(input.factors ?? [])].filter((f) => VALID_FACTORS.has(f)) : [];
  const note = response === "changed" ? (input.note ?? "").trim().slice(0, 1000) : "";
  if (response === "changed" && factors.length === 0 && !note) {
    return { ok: false, message: "Pick what changed, or add a note." };
  }

  const supabase = createServiceClient();
  const { data: batch, error } = await supabase
    .from("batches")
    .select("id,strain_id")
    .eq("id", batchId)
    .single<{ id: number; strain_id: number }>();
  if (error || !batch) return { ok: false, message: error?.message ?? "Batch not found." };

  const data = await loadStrainTiming(supabase, [batch.strain_id]);
  const self = data.batches.find((b) => b.id === batchId);
  if (!self) return { ok: false, message: "Batch not found." };
  const baselines = strainBaselines(data, batch.strain_id, batchId);
  const timeline = batchTimeline(self, data.eventsByBatch.get(batchId) ?? [], today());
  const departure = batchDepartures(self, timeline, baselines).find((d) => d.from === fromStage);
  if (!departure) return { ok: false, message: "This stage is back within the usual range." };

  const { error: saveError } = await supabase.from("stage_timing_notes").upsert(
    {
      batch_id: batchId,
      from_stage: fromStage,
      to_stage: departure.to,
      observed_days: departure.days,
      expected_days: departure.expected.median,
      direction: departure.direction,
      response,
      factors,
      note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "batch_id,from_stage" },
  );
  if (saveError) return { ok: false, message: saveError.message };
  revalidatePath(`/batches/${batchId}`);
  revalidatePath(`/strains/${batch.strain_id}`);
  return {
    ok: true,
    message: response === "changed" ? "Saved. This run won't skew the averages." : response === "unchanged" ? "Noted. Counted as normal variation." : "Hidden",
  };
}

/** Switch automated alerts / label printing for a strain. Enabling needs enough confidence. */
export async function setStageAutomation(input: {
  strainId: number;
  alerts?: boolean;
  labels?: boolean;
}): Promise<EntityResult> {
  const { strainId } = input;
  if (!Number.isSafeInteger(strainId) || strainId <= 0) return { ok: false, message: "Invalid strain." };
  const supabase = createServiceClient();
  if (input.alerts || input.labels) {
    const data = await loadStrainTiming(supabase, [strainId]);
    const confidence = baselineConfidence(strainBaselines(data, strainId).strain);
    if (confidence < AUTOMATION_CONFIDENCE) {
      return { ok: false, message: `Needs ${AUTOMATION_CONFIDENCE}% confidence (currently ${confidence}%).` };
    }
  }
  const patch: Record<string, unknown> = { strain_id: strainId, updated_at: new Date().toISOString() };
  if (input.alerts !== undefined) patch.alerts_enabled = input.alerts;
  if (input.labels !== undefined) patch.labels_enabled = input.labels;
  const { error } = await supabase.from("stage_timing_automation").upsert(patch, { onConflict: "strain_id" });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/strains/${strainId}`);
  revalidatePath("/batches");
  return { ok: true, message: "Saved" };
}
