"use server";

import { revalidatePath } from "next/cache";
import type { EntityResult } from "@/components/EntityForm";
import { createServiceClient } from "@/utils/supabase/service";
import {
  addBatchObservationRecord,
  cloneBatchRecord,
  mergeBatchRecords,
  setBatchRoom,
  setBatchStage,
  splitBatchRecord,
} from "@/lib/batch-operations";
import { undoBatchChangeGroup } from "@/lib/batch-history";
import { STAGE_ORDER } from "@/lib/stages";

export type BulkOperation = "stage" | "room";

function revalidateBatches(ids: number[] = []) {
  revalidatePath("/batches");
  revalidatePath("/");
  for (const id of ids) revalidatePath(`/batches/${id}`);
}

export async function bulkUpdateBatches(
  batchIds: number[],
  operation: BulkOperation,
  value: string,
): Promise<EntityResult> {
  const ids = [...new Set(batchIds.filter(Number.isFinite))].slice(0, 200);
  if (ids.length === 0) return { ok: false, message: "Select at least one batch." };
  const groupId = crypto.randomUUID();
  const supabase = createServiceClient();
  let undoId: number | undefined;
  let changed = 0;

  for (const id of ids) {
    const result =
      operation === "stage"
        ? STAGE_ORDER.includes(value as (typeof STAGE_ORDER)[number])
          ? await setBatchStage(supabase, id, value, {
              groupId,
              action: `Bulk move to ${value}`,
            })
          : { ok: false, message: "Invalid stage." }
        : await setBatchRoom(supabase, id, value === "" ? null : Number(value), {
            groupId,
            action: "Bulk room assignment",
          });
    if (!result.ok) {
      return {
        ok: false,
        message: changed > 0 ? `${changed} updated before: ${result.message}` : result.message,
        undoId,
      };
    }
    if (result.message !== "No change") changed += 1;
    undoId ??= result.undoId;
  }

  revalidateBatches(ids);
  return {
    ok: true,
    message: changed === 0 ? "Everything already matched" : `Updated ${changed} batch${changed === 1 ? "" : "es"}`,
    undoId,
  };
}

export async function moveBatchRoom(
  batchId: number,
  roomId: number | null,
): Promise<EntityResult> {
  const result = await setBatchRoom(createServiceClient(), batchId, roomId);
  if (result.ok) revalidateBatches([batchId]);
  return result;
}

export async function undoBatchChange(changeId: number): Promise<EntityResult> {
  if (!Number.isFinite(changeId)) return { ok: false, message: "Invalid change." };
  const result = await undoBatchChangeGroup(createServiceClient(), changeId);
  if (result.ok) revalidateBatches(result.batchIds);
  return { ok: result.ok, message: result.message };
}

export async function cloneBatch(
  sourceId: number,
  lotCode: string,
  containerId: string,
): Promise<EntityResult & { batchId?: number }> {
  const result = await cloneBatchRecord(createServiceClient(), sourceId, lotCode, containerId);
  if (result.ok) revalidateBatches(result.batchId ? [result.batchId] : []);
  return result;
}

export async function splitBatch(
  sourceId: number,
  lotCode: string,
  containerId: string,
  units: number,
): Promise<EntityResult & { batchId?: number }> {
  const result = await splitBatchRecord(createServiceClient(), sourceId, lotCode, containerId, units);
  if (result.ok) revalidateBatches([sourceId, ...(result.batchId ? [result.batchId] : [])]);
  return result;
}

export async function mergeBatches(
  destinationId: number,
  sourceIds: number[],
): Promise<EntityResult> {
  const result = await mergeBatchRecords(createServiceClient(), destinationId, sourceIds);
  if (result.ok) revalidateBatches([destinationId]);
  return result;
}

export async function addBatchObservation(
  batchId: number,
  transcript: string,
  tags: string[],
  kind: "note" | "voice" | "room_round" | "exception" = "note",
): Promise<EntityResult> {
  const result = await addBatchObservationRecord(
    createServiceClient(),
    batchId,
    transcript,
    tags,
    kind,
  );
  if (result.ok) revalidatePath(`/batches/${batchId}`);
  return result;
}

export async function saveBatchView(
  name: string,
  filters: { stage?: string; roomId?: number | null; attention?: boolean },
): Promise<EntityResult> {
  const clean = name.trim().slice(0, 80);
  if (!clean) return { ok: false, message: "Name this view." };
  const { error } = await createServiceClient().from("saved_batch_views").upsert(
    { name: clean, filters, is_favorite: true },
    { onConflict: "name" },
  );
  if (error) return { ok: false, message: error.message };
  revalidatePath("/batches");
  return { ok: true, message: `Saved “${clean}”` };
}

export async function deleteBatchView(id: number): Promise<EntityResult> {
  const { error } = await createServiceClient().from("saved_batch_views").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/batches");
  return { ok: true, message: "View removed" };
}
