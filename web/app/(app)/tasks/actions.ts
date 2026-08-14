"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/utils/supabase/service";
import { completeTaskRecord } from "@/lib/task-completion";
import type { EntityResult } from "@/components/EntityForm";
import { STAGE_ORDER } from "@/lib/stages";

const COMPLETION_ACTIONS = new Set(["none", "advance_stage", "set_stage", "move_room"]);
const PRIORITIES = new Set(["low", "med", "high"]);

function optionalId(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : Number.NaN;
}

export async function addTask(formData: FormData): Promise<EntityResult> {
  const title = String(formData.get("title") ?? "").trim().slice(0, 300);
  const description = String(formData.get("description") ?? "").trim().slice(0, 4000);
  const batchId = optionalId(formData.get("batch_id"));
  const roomId = optionalId(formData.get("room_id"));
  const completionRoomId = optionalId(formData.get("completion_room_id"));
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const priority = String(formData.get("priority") ?? "med");
  const completionAction = String(formData.get("completion_action") ?? "none");
  const completionStage = String(formData.get("completion_stage") ?? "");

  if (!title) return { ok: false, message: "Add a task title." };
  if ([batchId, roomId, completionRoomId].some(Number.isNaN)) {
    return { ok: false, message: "Choose valid batch and room values." };
  }
  if (!PRIORITIES.has(priority) || !COMPLETION_ACTIONS.has(completionAction)) {
    return { ok: false, message: "Choose valid task options." };
  }
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return { ok: false, message: "Choose a valid due date." };
  }
  if (completionAction !== "none" && batchId === null) {
    return { ok: false, message: "Link a batch for an automatic completion action." };
  }
  if (completionAction === "set_stage" && !STAGE_ORDER.includes(completionStage as (typeof STAGE_ORDER)[number])) {
    return { ok: false, message: "Choose the stage this task should set." };
  }
  if (completionAction === "move_room" && completionRoomId === null) {
    return { ok: false, message: "Choose the room this task should move the batch to." };
  }

  const { error } = await createServiceClient().from("tasks").insert({
    title,
    description,
    batch_id: batchId,
    room_id: roomId,
    due_date: dueDate || null,
    status: "open",
    priority,
    completion_action: completionAction,
    completion_stage: completionAction === "set_stage" ? completionStage : null,
    completion_room_id: completionAction === "move_room" ? completionRoomId : null,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/tasks");
  return { ok: true, message: completionAction === "none" ? "Task added" : "Task automation added" };
}

export async function completeTask(taskId: number): Promise<EntityResult> {
  const result = await completeTaskRecord(createServiceClient(), taskId);
  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath("/batches");
    revalidatePath("/");
  }
  return result;
}
