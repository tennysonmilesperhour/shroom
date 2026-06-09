// Helpers for enqueueing changes to the sheet sync queue.
//
// Every successful website-originated write should call `enqueueSync` so the
// change can be pushed to the Google Sheet. The enqueue is a single insert -
// if it fails we log and continue, so a Sheet outage never blocks the write
// that the operator just made.

import type { SupabaseClient } from "@supabase/supabase-js";

export type SyncEntity =
  | "vendor"
  | "supply"
  | "equipment"
  | "customer"
  | "strain"
  | "batch"
  | "preset"
  | "harvest"
  | "order"
  | "purchase_order"
  | "contamination_log";

export type SyncOp = "insert" | "update" | "delete";

export async function enqueueSync(
  supabase: SupabaseClient,
  entity: SyncEntity,
  entityId: number,
  op: SyncOp,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase.from("sheet_sync_queue").insert({
    entity,
    entity_id: entityId,
    op,
    payload,
  });
  if (error) {
    console.error("[sheet-sync] enqueue failed", { entity, entityId, op, error });
  }
}
