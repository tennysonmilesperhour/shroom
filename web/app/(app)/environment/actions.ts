"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { enqueueSync } from "@/lib/sync";
import type { EntityResult } from "@/components/EntityForm";

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
