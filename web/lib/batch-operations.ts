import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntityResult } from "@/components/EntityForm";
import { enqueueSync } from "@/lib/sync";
import { nextStage, normalizeStage, VALID_STAGES } from "@/lib/stages";
import { recordBatchChange } from "@/lib/batch-history";

interface BatchState {
  id: number;
  lot_code: string;
  stage: string;
  room_id: number | null;
  colonized_on: string | null;
  fruiting_on: string | null;
  spent_on: string | null;
}

function stagePatch(current: BatchState, toStage: string): Record<string, unknown> {
  const today = new Date().toISOString().slice(0, 10);
  const patch: Record<string, unknown> = { stage: toStage };
  if (toStage === "colonization" && !current.colonized_on) patch.colonized_on = today;
  else if (toStage === "fruiting" && !current.fruiting_on) patch.fruiting_on = today;
  else if (toStage === "spent" && !current.spent_on) patch.spent_on = today;
  return patch;
}

export async function setBatchStage(
  supabase: SupabaseClient,
  batchId: number,
  requestedStage: string,
  options: { action?: string; groupId?: string } = {},
): Promise<EntityResult> {
  const toStage = normalizeStage(requestedStage);
  if (!Number.isFinite(batchId)) return { ok: false, message: "Invalid batch." };
  if (!VALID_STAGES.has(toStage) || toStage === "contaminated") {
    return { ok: false, message: "Invalid lifecycle stage." };
  }

  const { data: current, error: readError } = await supabase
    .from("batches")
    .select("id,lot_code,stage,room_id,colonized_on,fruiting_on,spent_on")
    .eq("id", batchId)
    .single<BatchState>();
  if (readError || !current) return { ok: false, message: readError?.message ?? "Batch not found." };
  if (normalizeStage(current.stage) === toStage) return { ok: true, message: "No change" };

  const patch = stagePatch(current, toStage);
  const before: Record<string, unknown> = { stage: current.stage };
  for (const key of ["colonized_on", "fruiting_on", "spent_on"] as const) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) before[key] = current[key];
  }

  const { error } = await supabase.from("batches").update(patch).eq("id", batchId);
  if (error) return { ok: false, message: error.message };

  const action = options.action ?? `Moved to ${toStage}`;
  let undoId: number;
  try {
    ({ id: undoId } = await recordBatchChange(supabase, {
      batchId,
      lotCode: current.lot_code,
      action,
      before,
      after: patch,
      groupId: options.groupId,
    }));
  } catch (historyError) {
    const { error: rollbackError } = await supabase.from("batches").update(before).eq("id", batchId);
    const message = historyError instanceof Error ? historyError.message : "Could not record change history.";
    if (!rollbackError) return { ok: false, message };
    await supabase.from("stage_events").insert({
      batch_id: batchId,
      stage: toStage,
      room_id: current.room_id,
      note: `${action} (undo unavailable)`,
    });
    await enqueueSync(supabase, "batch", batchId, "update", patch);
    return { ok: true, message: `${action} · undo is unavailable (${message})` };
  }
  await supabase.from("stage_events").insert({
    batch_id: batchId,
    stage: toStage,
    room_id: current.room_id,
    note: action,
  });
  await enqueueSync(supabase, "batch", batchId, "update", patch);
  return { ok: true, message: action, undoId };
}

export async function advanceBatch(
  supabase: SupabaseClient,
  batchId: number,
  options: { action?: string; groupId?: string } = {},
): Promise<EntityResult> {
  const { data, error } = await supabase
    .from("batches")
    .select("stage")
    .eq("id", batchId)
    .single<{ stage: string }>();
  if (error || !data) return { ok: false, message: error?.message ?? "Batch not found." };
  const next = nextStage(data.stage);
  if (!next) return { ok: false, message: "Batch is already at its final stage." };
  return setBatchStage(supabase, batchId, next, {
    ...options,
    action: options.action ?? `Advanced to ${next}`,
  });
}

export async function setBatchRoom(
  supabase: SupabaseClient,
  batchId: number,
  roomId: number | null,
  options: { action?: string; groupId?: string } = {},
): Promise<EntityResult> {
  if (!Number.isFinite(batchId) || (roomId !== null && !Number.isFinite(roomId))) {
    return { ok: false, message: "Invalid batch or room." };
  }
  const { data: current, error: readError } = await supabase
    .from("batches")
    .select("id,lot_code,stage,room_id")
    .eq("id", batchId)
    .single<{ id: number; lot_code: string; stage: string; room_id: number | null }>();
  if (readError || !current) return { ok: false, message: readError?.message ?? "Batch not found." };
  if (current.room_id === roomId) return { ok: true, message: "No change" };

  const { error } = await supabase.from("batches").update({ room_id: roomId }).eq("id", batchId);
  if (error) return { ok: false, message: error.message };
  const action = options.action ?? (roomId === null ? "Removed room assignment" : "Changed room");
  const before = { room_id: current.room_id };
  let undoId: number;
  try {
    ({ id: undoId } = await recordBatchChange(supabase, {
      batchId,
      lotCode: current.lot_code,
      action,
      before,
      after: { room_id: roomId },
      groupId: options.groupId,
    }));
  } catch (historyError) {
    const { error: rollbackError } = await supabase.from("batches").update(before).eq("id", batchId);
    const message = historyError instanceof Error ? historyError.message : "Could not record change history.";
    if (!rollbackError) return { ok: false, message };
    await supabase.from("stage_events").insert({
      batch_id: batchId,
      stage: "moved",
      room_id: roomId,
      note: `${action} (undo unavailable)`,
    });
    await enqueueSync(supabase, "batch", batchId, "update", { room_id: roomId });
    return { ok: true, message: `${action} · undo is unavailable (${message})` };
  }
  await supabase.from("stage_events").insert({
    batch_id: batchId,
    stage: "moved",
    room_id: roomId,
    note: action,
  });
  await enqueueSync(supabase, "batch", batchId, "update", { room_id: roomId });
  return { ok: true, message: action, undoId };
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
