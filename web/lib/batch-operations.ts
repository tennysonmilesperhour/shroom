import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntityResult } from "@/components/EntityForm";
import { enqueueSync } from "@/lib/sync";
import { normalizeStage, VALID_STAGES } from "@/lib/stages";

async function mutateBatch(
  supabase: SupabaseClient,
  batchId: number,
  kind: "stage" | "advance" | "room",
  stage: string | null,
  roomId: number | null,
  options: { action?: string; groupId?: string },
): Promise<EntityResult> {
  if (!Number.isSafeInteger(batchId) || batchId <= 0 ||
      (roomId !== null && (!Number.isSafeInteger(roomId) || roomId <= 0))) {
    return { ok: false, message: "Invalid batch or room." };
  }
  const { data, error } = await supabase.rpc("mutate_batch", {
    p_batch_id: batchId, p_kind: kind, p_stage: stage, p_room_id: roomId,
    p_action: options.action ?? null, p_group_id: options.groupId ?? null,
  });
  return error ? { ok: false, message: error.message } : data as EntityResult;
}

export async function setBatchStage(
  supabase: SupabaseClient,
  batchId: number,
  requestedStage: string,
  options: { action?: string; groupId?: string } = {},
): Promise<EntityResult> {
  const stage = normalizeStage(requestedStage);
  if (!VALID_STAGES.has(stage) || stage === "contaminated") {
    return { ok: false, message: "Invalid lifecycle stage." };
  }
  return mutateBatch(supabase, batchId, "stage", stage, null, options);
}

export async function advanceBatch(
  supabase: SupabaseClient,
  batchId: number,
  options: { action?: string; groupId?: string } = {},
): Promise<EntityResult> {
  return mutateBatch(supabase, batchId, "advance", null, null, options);
}

export async function setBatchRoom(
  supabase: SupabaseClient,
  batchId: number,
  roomId: number | null,
  options: { action?: string; groupId?: string } = {},
): Promise<EntityResult> {
  return mutateBatch(supabase, batchId, "room", null, roomId, options);
}

export async function addBatchObservationRecord(
  supabase: SupabaseClient,
  batchId: number,
  transcript: string,
  tags: string[],
  kind: "note" | "voice" | "room_round" | "exception" = "note",
  clientMutationId?: string,
): Promise<EntityResult> {
  const clean = transcript.trim().slice(0, 4000);
  if (!Number.isFinite(batchId)) return { ok: false, message: "Invalid batch." };
  if (!clean) return { ok: false, message: "Add an observation first." };
  const { data: batch, error: batchError } = await supabase
    .from("batches")
    .select("stage")
    .eq("id", batchId)
    .single<{ stage: string }>();
  if (batchError || !batch) return { ok: false, message: batchError?.message ?? "Batch not found." };
  const normalizedTags = [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 8);
  const row = {
    batch_id: batchId,
    stage_snapshot: normalizeStage(batch.stage),
    kind,
    transcript: clean,
    tags: normalizedTags,
    client_mutation_id: clientMutationId ?? null,
  };
  const query = clientMutationId
    ? supabase.from("batch_observations").upsert(row, {
        onConflict: "client_mutation_id",
        ignoreDuplicates: true,
      })
    : supabase.from("batch_observations").insert(row);
  const { error } = await query;
  return error ? { ok: false, message: error.message } : { ok: true, message: "Observation saved" };
}

export async function cloneBatchRecord(
  supabase: SupabaseClient,
  sourceId: number,
  lotCode: string,
  containerId: string,
): Promise<EntityResult & { batchId?: number }> {
  const { data: source, error: sourceError } = await supabase
    .from("batches")
    .select(
      "id,strain_id,recipe_id,room_id,block_count,substrate_weight_kg,container_type,tub_size,spawn_type,substrate_type,bag_type,preset_id,notes",
    )
    .eq("id", sourceId)
    .single<Record<string, unknown> & { id: number }>();
  if (sourceError || !source) return { ok: false, message: sourceError?.message ?? "Batch not found." };
  const cleanLot = lotCode.trim();
  if (!cleanLot) return { ok: false, message: "New lot code is required." };
  const today = new Date().toISOString().slice(0, 10);
  const { id: _sourceKey, ...configuration } = source;
  const { data, error } = await supabase
    .from("batches")
    .insert({
      ...configuration,
      lot_code: cleanLot,
      container_id: containerId.trim(),
      stage: "colonization",
      inoculated_on: today,
      colonized_on: today,
      fruiting_on: null,
      spent_on: null,
      contamination_flag: false,
      rating: null,
      issues: "",
      lineage_parent_id: sourceId,
    })
    .select("id")
    .single<{ id: number }>();
  if (error || !data) return { ok: false, message: error?.message ?? "Could not clone batch." };
  await supabase.from("stage_events").insert({
    batch_id: data.id,
    stage: "colonization",
    note: `Cloned configuration from batch ${sourceId}`,
  });
  await enqueueSync(supabase, "batch", data.id, "insert", { lot_code: cleanLot, stage: "colonization" });
  return { ok: true, message: `Created ${cleanLot}`, batchId: data.id };
}

export async function splitBatchRecord(
  supabase: SupabaseClient,
  sourceId: number,
  lotCode: string,
  containerId: string,
  units: number,
): Promise<EntityResult & { batchId?: number }> {
  if (!Number.isInteger(units) || units <= 0) return { ok: false, message: "Enter a whole number of units." };
  const { data, error } = await supabase.rpc("split_batch", {
    p_source_id: sourceId,
    p_lot_code: lotCode.trim(),
    p_container_id: containerId.trim(),
    p_units: units,
  });
  if (error) return { ok: false, message: error.message };
  const childId = Number(data);
  await enqueueSync(supabase, "batch", sourceId, "update", { split_child_id: childId, units });
  await enqueueSync(supabase, "batch", childId, "insert", { lot_code: lotCode.trim() });
  return { ok: true, message: `Split ${units} unit${units === 1 ? "" : "s"} into ${lotCode}`, batchId: childId };
}

export async function mergeBatchRecords(
  supabase: SupabaseClient,
  destinationId: number,
  sourceIds: number[],
): Promise<EntityResult> {
  const ids = [...new Set(sourceIds.filter((id) => Number.isFinite(id) && id !== destinationId))];
  if (!Number.isFinite(destinationId) || ids.length === 0) {
    return { ok: false, message: "Choose a destination and at least one source batch." };
  }
  const { data: sourceLots } = await supabase.from("batches").select("id,lot_code").in("id", ids);
  const { error } = await supabase.rpc("merge_batches", {
    p_destination_id: destinationId,
    p_source_ids: ids,
  });
  if (error) return { ok: false, message: error.message };
  await enqueueSync(supabase, "batch", destinationId, "update", {
    merged_lots: (sourceLots ?? []).map((row) => row.lot_code),
  });
  return { ok: true, message: `Merged ${ids.length} batch${ids.length === 1 ? "" : "es"}` };
}
