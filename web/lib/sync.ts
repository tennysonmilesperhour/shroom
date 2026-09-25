// Helpers for enqueueing changes to the sheet sync queue.
//
// Every successful website-originated write should call `enqueueSync` so the
// change can be pushed to the Google Sheet. The enqueue is a single insert -
// if it fails we log and continue, so a Sheet outage never blocks the write
// that the operator just made.

import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { MAPPED_ENTITIES, scheduleRecentWrite, writebackConfigured } from "@/lib/sheet-writeback";

export type SyncEntity =
  | "vendor"
  | "supply"
  | "equipment"
  | "customer"
  | "strain"
  | "culture"
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
    return;
  }
  // Write the change into the reference sheet once the response has been
  // sent, so a slow or unreachable Google API never delays the save.
  if (MAPPED_ENTITIES.has(entity) && writebackConfigured()) {
    try {
      after(async () => {
        try {
          const outcomes = await scheduleRecentWrite(supabase);
          for (const o of outcomes) {
            if (o.status === "error" || o.status === "skipped") console.warn("[sheet-writeback]", o);
          }
        } catch (e) {
          console.error("[sheet-writeback] failed", e);
        }
      });
    } catch {
      // Outside a request scope (scripts/tests): the queue entry stays pending.
    }
  }
}
