import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueSync } from "@/lib/sync";

export interface BatchChangeInput {
  batchId: number;
  lotCode: string;
  action: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  groupId?: string;
}

const UNDOABLE_FIELDS = new Set([
  "stage",
  "room_id",
  "strain_id",
  "container_type",
  "container_id",
  "tub_size",
  "spawn_type",
  "substrate_type",
  "bag_type",
  "block_count",
  "substrate_weight_kg",
  "inoculated_on",
  "colonized_on",
  "fruiting_on",
  "spent_on",
  "rating",
  "contamination_flag",
  "issues",
  "notes",
]);

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
  const { data: anchor, error: anchorError } = await supabase
    .from("batch_change_events")
    .select("group_id,undo_expires_at,undone_at")
    .eq("id", changeId)
    .single<{ group_id: string; undo_expires_at: string; undone_at: string | null }>();
  if (anchorError || !anchor) {
    return { ok: false, message: anchorError?.message ?? "Change not found.", batchIds: [] };
  }
  if (anchor.undone_at) return { ok: false, message: "That change was already undone.", batchIds: [] };
  if (new Date(anchor.undo_expires_at).getTime() < Date.now()) {
    return { ok: false, message: "The 10-minute undo window has expired.", batchIds: [] };
  }

  const { data: events, error } = await supabase
    .from("batch_change_events")
    .select("id,batch_id,batch_lot_code,action,before_state,after_state,undone_at")
    .eq("group_id", anchor.group_id)
    .order("id", { ascending: false })
    .returns<{
      id: number;
      batch_id: number | null;
      batch_lot_code: string;
      action: string;
      before_state: Record<string, unknown>;
      after_state: Record<string, unknown>;
      undone_at: string | null;
    }[]>();
  if (error || !events) return { ok: false, message: error?.message ?? "Could not load change.", batchIds: [] };

  // Validate the whole group before writing anything. Undo must never clobber
  // a newer field edit made after the toast appeared.
  for (const event of events) {
    if (!event.batch_id || event.undone_at) continue;
    const expected = Object.fromEntries(
      Object.entries(event.after_state ?? {}).filter(([key]) => UNDOABLE_FIELDS.has(key)),
    );
    const fields = Object.keys(expected);
    if (fields.length === 0) continue;
    const { data: current, error: currentError } = await supabase
      .from("batches")
      .select(fields.join(","))
      .eq("id", event.batch_id)
      .single<Record<string, unknown>>();
    if (currentError || !current) {
      return { ok: false, message: currentError?.message ?? "Batch no longer exists.", batchIds: [] };
    }
    const changedAgain = fields.some((field) =>
      JSON.stringify(current[field] ?? null) !== JSON.stringify(expected[field] ?? null),
    );
    if (changedAgain) {
      return {
        ok: false,
        message: `${event.batch_lot_code} changed again after this action, so it was not overwritten.`,
        batchIds: [],
      };
    }
  }

  const restored: number[] = [];
  for (const event of events) {
    if (!event.batch_id || event.undone_at) continue;
    const patch = Object.fromEntries(
      Object.entries(event.before_state ?? {}).filter(([key]) => UNDOABLE_FIELDS.has(key)),
    );
    if (Object.keys(patch).length === 0) continue;

    const { error: updateError } = await supabase
      .from("batches")
      .update(patch)
      .eq("id", event.batch_id);
    if (updateError) return { ok: false, message: updateError.message, batchIds: restored };

    await supabase.from("stage_events").insert({
      batch_id: event.batch_id,
      stage: "undo",
      note: `Undid: ${event.action}`,
    });
    await enqueueSync(supabase, "batch", event.batch_id, "update", patch);
    restored.push(event.batch_id);
  }

  const { error: markError } = await supabase
    .from("batch_change_events")
    .update({ undone_at: new Date().toISOString() })
    .eq("group_id", anchor.group_id)
    .is("undone_at", null);
  if (markError) return { ok: false, message: markError.message, batchIds: restored };

  return {
    ok: true,
    message: restored.length === 1 ? "Change undone" : `${restored.length} batch changes undone`,
    batchIds: restored,
  };
}
