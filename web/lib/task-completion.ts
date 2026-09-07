import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntityResult } from "@/components/EntityForm";

export async function completeTaskRecord(
  supabase: SupabaseClient,
  taskId: number,
): Promise<EntityResult> {
  if (!Number.isSafeInteger(taskId) || taskId <= 0) return { ok: false, message: "Invalid task." };
  const { data, error } = await supabase.rpc("complete_task", { p_task_id: taskId });
  return error ? { ok: false, message: error.message } : data as EntityResult;
}
