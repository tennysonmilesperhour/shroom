import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntityResult } from "@/components/EntityForm";
import { advanceBatch, setBatchRoom, setBatchStage } from "@/lib/batch-operations";

interface TaskCompletionRow {
  id: number;
  title: string;
  status: string;
  batch_id: number | null;
  completion_action: "none" | "advance_stage" | "set_stage" | "move_room";
  completion_stage: string | null;
  completion_room_id: number | null;
}

export async function completeTaskRecord(
  supabase: SupabaseClient,
  taskId: number,
): Promise<EntityResult> {
  if (!Number.isFinite(taskId)) return { ok: false, message: "Invalid task." };
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id,title,status,batch_id,completion_action,completion_stage,completion_room_id")
    .eq("id", taskId)
    .single<TaskCompletionRow>();
  if (taskError || !task) return { ok: false, message: taskError?.message ?? "Task not found." };
  if (task.status === "done") return { ok: true, message: "Task already completed" };

  let linkedResult: EntityResult = { ok: true };
  const action = `Completed task: ${task.title}`;
  if (task.completion_action !== "none") {
    if (!task.batch_id) return { ok: false, message: "This automation needs a linked batch." };
    if (task.completion_action === "advance_stage") {
      linkedResult = await advanceBatch(supabase, task.batch_id, { action });
    } else if (task.completion_action === "set_stage") {
      if (!task.completion_stage) return { ok: false, message: "Choose the stage this task should set." };
      linkedResult = await setBatchStage(supabase, task.batch_id, task.completion_stage, { action });
    } else if (task.completion_action === "move_room") {
      linkedResult = await setBatchRoom(supabase, task.batch_id, task.completion_room_id, { action });
    }
    if (!linkedResult.ok) return linkedResult;
  }

  const { error } = await supabase
    .from("tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", taskId);
  if (error) {
    return {
      ok: false,
      message: linkedResult.undoId
        ? `${error.message} The batch update can still be undone.`
        : error.message,
      undoId: linkedResult.undoId,
    };
  }
  return {
    ok: true,
    message: task.completion_action === "none" ? "Task completed" : "Task completed · batch record updated",
    undoId: linkedResult.undoId,
  };
}
