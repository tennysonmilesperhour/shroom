"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { enqueueSync } from "@/lib/sync";
import type { EntityResult } from "@/components/EntityForm";
import { STAGE_ORDER, VALID_STAGES, nextStage, normalizeStage } from "@/lib/stages";

export interface GenerateResult {
  ok: boolean;
  created: number;
  message: string;
}

export async function generateProtocolTasks(
  protocolId: number,
  batchId: number | null,
): Promise<GenerateResult> {
  if (!Number.isFinite(protocolId) || protocolId <= 0) {
    return { ok: false, created: 0, message: "Pick a protocol." };
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("generate_protocol_tasks", {
    p_protocol_id: protocolId,
    p_batch_id: batchId,
  });

  if (error) {
    return { ok: false, created: 0, message: error.message };
  }

  revalidatePath("/batches");
  return { ok: true, created: Number(data ?? 0), message: "" };
}

const VALID_CONTAINERS = new Set(["tub", "grain_bag", "aio"]);

export async function addBatch(formData: FormData): Promise<EntityResult> {
  const lot_code = String(formData.get("lot_code") ?? "").trim();
  const strain_id = Number(formData.get("strain_id") ?? NaN);
  const roomRaw = String(formData.get("room_id") ?? "");
  const room_id = roomRaw ? Number(roomRaw) : null;
  const stage = String(formData.get("stage") ?? "colonization");
  const container_type = String(formData.get("container_type") ?? "tub");
  const container_id = String(formData.get("container_id") ?? "").trim();
  const block_count = Number(formData.get("block_count") ?? 0);
  const substrate_weight_kg = Number(formData.get("substrate_weight_kg") ?? 0);
  const inoculated_on = String(formData.get("inoculated_on") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!lot_code) return { ok: false, message: "Lot code is required." };
  if (!Number.isFinite(strain_id)) return { ok: false, message: "Pick a strain." };
  if (!VALID_STAGES.has(stage)) return { ok: false, message: "Invalid stage." };
  if (!VALID_CONTAINERS.has(container_type))
    return { ok: false, message: "Invalid container type." };

  // A batch enters the cycle already colonizing, so stamp colonized_on when it
  // starts there (falling back to the inoculation date the operator entered).
  const colonized_on =
    stage === "colonization"
      ? inoculated_on || new Date().toISOString().slice(0, 10)
      : null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("batches")
    .insert({
      lot_code,
      strain_id,
      room_id,
      stage,
      container_type,
      container_id,
      block_count: Number.isFinite(block_count) ? block_count : 0,
      substrate_weight_kg: Number.isFinite(substrate_weight_kg) ? substrate_weight_kg : 0,
      inoculated_on: inoculated_on || null,
      colonized_on,
      notes,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Insert failed." };

  await enqueueSync(supabase, "batch", data.id, "insert", { lot_code, stage });
  revalidatePath("/batches");
  return { ok: true, message: "Batch added ✓" };
}

export async function advanceBatchStage(batchId: number): Promise<EntityResult> {
  if (!Number.isFinite(batchId)) return { ok: false, message: "Invalid batch." };

  const supabase = createServiceClient();
  const { data: current, error: readErr } = await supabase
    .from("batches")
    .select("stage,lot_code")
    .eq("id", batchId)
    .single();
  if (readErr || !current) return { ok: false, message: readErr?.message ?? "Not found." };

  const next = nextStage(current.stage);
  if (!next) {
    return normalizeStage(current.stage) === STAGE_ORDER[STAGE_ORDER.length - 1]
      ? { ok: false, message: "Already at the final stage." }
      : { ok: false, message: `Stage "${current.stage}" cannot be advanced.` };
  }
  const today = new Date().toISOString().slice(0, 10);
  const update: Record<string, unknown> = { stage: next };
  if (next === "colonization") update.colonized_on = today;
  else if (next === "fruiting") update.fruiting_on = today;
  else if (next === "spent") update.spent_on = today;

  const { error } = await supabase.from("batches").update(update).eq("id", batchId);
  if (error) return { ok: false, message: error.message };

  await enqueueSync(supabase, "batch", batchId, "update", { stage: next });
  revalidatePath(`/batches/${batchId}`);
  revalidatePath("/batches");
  return { ok: true, message: `Advanced to ${next}` };
}
