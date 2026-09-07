import type { SupabaseClient } from "@supabase/supabase-js";

export interface BatchChangeInput {
  batchId: number;
  lotCode: string;
  action: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  groupId?: string;
}

export async function recordBatchChange(
  supabase: SupabaseClient,
  input: BatchChangeInput,
): Promise<{ id: number; groupId: string }> {
  const groupId = input.groupId ?? crypto.randomUUID();
  const { data, error } = await supabase
    .from("batch_change_events")
    .insert({
      group_id: groupId,
      batch_id: input.batchId,
      batch_lot_code: input.lotCode,
      action: input.action,
      before_state: input.before,
      after_state: input.after,
    })
    .select("id")
    .single<{ id: number }>();
  if (error || !data) throw new Error(error?.message ?? "Could not record batch history.");
  return { id: data.id, groupId };
}

export async function undoBatchChangeGroup(
  supabase: SupabaseClient,
  changeId: number,
): Promise<{ ok: boolean; message: string; batchIds: number[] }> {
  if (!Number.isSafeInteger(changeId) || changeId <= 0) {
    return { ok: false, message: "Invalid change.", batchIds: [] };
  }
  const { data, error } = await supabase.rpc("undo_batch_change_group", { p_change_id: changeId });
  return error ? { ok: false, message: error.message, batchIds: [] } : data;
}
