"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { enqueueSync } from "@/lib/sync";
import { fToC } from "@/lib/format";
import type { EntityResult } from "@/components/EntityForm";

const VALID_ROOM_TYPES = new Set([
  "incubation",
  "fruiting",
  "drying",
  "lab",
  "storage",
]);

function num(raw: FormDataEntryValue | null, fallback: number): number {
  const n = Number(String(raw ?? "").trim());
  return Number.isFinite(n) ? n : fallback;
}

// Create a room/tent. Temperature is entered in °F (the operator's unit) and
// stored canonically in °C. Rooms aren't a sheet tab, so there's no sync row —
// this is app-local state that the environment board and the per-room table
// both read straight from the `rooms` table.
export async function addRoom(formData: FormData): Promise<EntityResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Room name is required." };

  const room_type = String(formData.get("room_type") ?? "fruiting");
  if (!VALID_ROOM_TYPES.has(room_type))
    return { ok: false, message: "Invalid room type." };

  const tempF = String(formData.get("target_temp_f") ?? "").trim();
  const target_temp_c = tempF === "" ? 20 : fToC(Number(tempF)) ?? 20;

  const supabase = createServiceClient();
  const { error } = await supabase.from("rooms").insert({
    name,
    room_type,
    capacity_blocks: num(formData.get("capacity_blocks"), 0),
    target_temp_c,
    target_humidity: num(formData.get("target_humidity"), 90),
    target_co2_ppm: num(formData.get("target_co2_ppm"), 800),
    target_fae_per_hr: num(formData.get("target_fae_per_hr"), 4),
    notes: String(formData.get("notes") ?? "").trim(),
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/environment");
  return { ok: true, message: `Room “${name}” added ✓` };
}

// Move a batch into a room/tent (or out, when roomId is null). This is the
// drag-and-drop reassignment behind the tents board: one page where you place
// each lot in its space, and the room shows up everywhere else (Batches, the
// per-room table) because it writes the same batches.room_id column.
export async function moveBatchToRoom(
  batchId: number,
  roomId: number | null,
): Promise<EntityResult> {
  if (!Number.isFinite(batchId)) return { ok: false, message: "Invalid batch." };
  if (roomId !== null && !Number.isFinite(roomId))
    return { ok: false, message: "Invalid room." };

  const supabase = createServiceClient();

  // No-op if it is already there - avoids a needless write + sync row.
  const { data: current, error: readErr } = await supabase
    .from("batches")
    .select("room_id,lot_code")
    .eq("id", batchId)
    .single();
  if (readErr || !current) return { ok: false, message: readErr?.message ?? "Not found." };
  if (current.room_id === roomId) return { ok: true, message: "" };

  const { error } = await supabase
    .from("batches")
    .update({ room_id: roomId })
    .eq("id", batchId);
  if (error) return { ok: false, message: error.message };

  // Record the move on the lifecycle timeline so the room change is traceable.
  await supabase.from("stage_events").insert({
    batch_id: batchId,
    stage: "moved",
    room_id: roomId,
    note: roomId === null ? "Removed from tent" : "Moved to tent",
  });

  await enqueueSync(supabase, "batch", batchId, "update", { room_id: roomId });
  revalidatePath("/environment");
  revalidatePath("/batches");
  return { ok: true, message: "Moved" };
}
