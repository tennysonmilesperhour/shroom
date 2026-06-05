"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";

export interface SyncActionResult {
  ok: boolean;
  message: string;
  count?: number;
}

/** Mark all currently-pending sync entries as synced.
 *
 * This is the stub for the Google Sheets bridge: once an external worker
 * actually pushes pending ops to the sheet, that worker can call this RPC
 * (or just update the rows directly with the service role) to clear them.
 * For now operators can clear the queue manually when they've reconciled.
 */
export async function markAllSynced(): Promise<SyncActionResult> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("sheet_sync_queue")
    .update({ synced_at: new Date().toISOString() })
    .is("synced_at", null)
    .select("id");
  if (error) return { ok: false, message: error.message };
  revalidatePath("/sync");
  return {
    ok: true,
    count: data?.length ?? 0,
    message: `Marked ${data?.length ?? 0} ops as synced.`,
  };
}
