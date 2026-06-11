"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import type { EntityResult } from "@/components/EntityForm";

const KINDS = new Set(["task", "check_in", "automation", "report"]);
const CADENCES = new Set(["daily", "weekly", "monthly", "as_needed"]);

// Program a new routine into the dashboard command center.
export async function addRoutine(formData: FormData): Promise<EntityResult> {
  const kind = String(formData.get("kind") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const cadence = String(formData.get("cadence") ?? "daily").trim();
  const href = String(formData.get("href") ?? "/").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!KINDS.has(kind)) return { ok: false, message: "Pick a type." };
  if (!title) return { ok: false, message: "Give it a title." };
  if (!CADENCES.has(cadence)) return { ok: false, message: "Pick a cadence." };
  if (!href.startsWith("/")) return { ok: false, message: "Pick a target page." };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("routines")
    .insert({ kind, title, cadence, href, notes });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/");
  return { ok: true, message: "Programmed ✓" };
}

// Stamp a routine done now (or clear it back to due when `done` is false).
export async function setRoutineDone(id: number, done: boolean): Promise<EntityResult> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("routines")
    .update({ last_done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/");
  return { ok: true };
}

// Retire a routine from the command center.
export async function deleteRoutine(id: number): Promise<EntityResult> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("routines").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/");
  return { ok: true, message: "Removed" };
}
