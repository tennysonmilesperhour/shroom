"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { enqueueSync } from "@/lib/sync";
import type { EntityResult } from "@/components/EntityForm";

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

const VALID_STAGES = new Set([
  "inoculation", "colonization", "spawn_to_bulk",
  "fruiting", "harvesting", "spent", "contaminated",
]);
const VALID_CONTAINERS = new Set(["tub", "grain_bag", "aio"]);

export async function addBatch(formData: FormData): Promise<EntityResult> {
  const lot_code = String(formData.get("lot_code") ?? "").trim();
  const strain_id = Number(formData.get("strain_id") ?? NaN);
  const roomRaw = String(formData.get("room_id") ?? "");
  const room_id = roomRaw ? Number(roomRaw) : null;
  const stage = String(formData.get("stage") ?? "inoculation");
  const container_type = String(formData.get("container_type") ?? "tub");
  const container_id = String(formData.get("container_id") ?? "").trim();
  const block_count = Number(formData.get("block_count") ?? 0);
  const substrate_weight_kg = Number(formData.get("substrate_weight_kg") ?? 0);
  const inoculated_on = String(formData.get("inoculated_on") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const tub_size = String(formData.get("tub_size") ?? "").trim();
  const spawn_type = String(formData.get("spawn_type") ?? "").trim();
  const substrate_type = String(formData.get("substrate_type") ?? "").trim();
  const bag_type = String(formData.get("bag_type") ?? "").trim();
  const presetRaw = String(formData.get("preset_id") ?? "");
  const preset_id = presetRaw && Number.isFinite(Number(presetRaw)) ? Number(presetRaw) : null;
  const deduct = String(formData.get("deduct_materials") ?? "") === "on";

  if (!lot_code) return { ok: false, message: "Lot code is required." };
  if (!Number.isFinite(strain_id)) return { ok: false, message: "Pick a strain." };
  if (!VALID_STAGES.has(stage)) return { ok: false, message: "Invalid stage." };
  if (!VALID_CONTAINERS.has(container_type))
    return { ok: false, message: "Invalid container type." };

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
      notes,
      preset_id,
      tub_size,
      spawn_type,
      substrate_type,
      bag_type,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Insert failed." };

  await enqueueSync(supabase, "batch", data.id, "insert", { lot_code, stage });

  // Draw the preset's bill-of-materials down from inventory and record exactly
  // what this tub consumed. Best-effort: the batch is already created, so a
  // materials hiccup never loses the batch — it just surfaces in the message.
  let materialNote = "";
  if (preset_id && deduct) {
    materialNote = await consumePresetMaterials(supabase, preset_id, data.id);
  }

  revalidatePath("/batches");
  return { ok: true, message: `Batch added ✓${materialNote}` };
}

interface PresetMaterialRow {
  inventory_item_id: number | null;
  name: string;
  quantity: number;
  unit: string;
}

// Records batch_materials history rows and decrements inventory for any linked
// items. Returns a short suffix for the success toast (or an error note).
async function consumePresetMaterials(
  supabase: ReturnType<typeof createServiceClient>,
  presetId: number,
  batchId: number,
): Promise<string> {
  const { data: materials, error } = await supabase
    .from("preset_materials")
    .select("inventory_item_id,name,quantity,unit")
    .eq("preset_id", presetId)
    .returns<PresetMaterialRow[]>();
  if (error) return ` (materials skipped: ${error.message})`;
  if (!materials || materials.length === 0) return "";

  const historyRows = materials.map((m) => ({
    batch_id: batchId,
    inventory_item_id: m.inventory_item_id,
    name: m.name,
    quantity: m.quantity,
    unit: m.unit,
  }));
  const { error: histErr } = await supabase.from("batch_materials").insert(historyRows);
  if (histErr) return ` (materials skipped: ${histErr.message})`;

  let drawn = 0;
  for (const m of materials) {
    if (m.inventory_item_id == null || !(m.quantity > 0)) continue;
    const { data: item } = await supabase
      .from("inventory_items")
      .select("quantity_on_hand")
      .eq("id", m.inventory_item_id)
      .single();
    if (!item) continue;
    const next = Math.max(0, Number(item.quantity_on_hand) - m.quantity);
    const { error: updErr } = await supabase
      .from("inventory_items")
      .update({ quantity_on_hand: next })
      .eq("id", m.inventory_item_id);
    if (!updErr) {
      drawn += 1;
      await enqueueSync(supabase, "supply", m.inventory_item_id, "update", {
        field: "quantity_on_hand",
        delta: -m.quantity,
        to: next,
        batch_id: batchId,
      });
    }
  }

  revalidatePath("/supplies");
  return drawn > 0 ? ` · drew ${drawn} material${drawn === 1 ? "" : "s"} from stock` : "";
}

const STAGE_ORDER = [
  "inoculation", "colonization", "spawn_to_bulk",
  "fruiting", "harvesting", "spent",
] as const;

// Board stages a tub can be dragged between. Mirrors STAGE_ORDER; "contaminated"
// is intentionally excluded — that transition stays a deliberate logging action.
const BOARD_STAGES = new Set<string>(STAGE_ORDER);

// Move a batch to an arbitrary stage via the kanban board (drag + drop).
// Unlike advanceBatchStage this allows jumping forward or back; it stamps the
// relevant lifecycle date the first time a batch reaches that stage.
export async function moveBatchStage(
  batchId: number,
  toStage: string,
): Promise<EntityResult> {
  if (!Number.isFinite(batchId)) return { ok: false, message: "Invalid batch." };
  if (!BOARD_STAGES.has(toStage)) return { ok: false, message: "Invalid stage." };

  const supabase = createServiceClient();
  const { data: current, error: readErr } = await supabase
    .from("batches")
    .select("stage,colonized_on,fruiting_on,spent_on")
    .eq("id", batchId)
    .single();
  if (readErr || !current) return { ok: false, message: readErr?.message ?? "Not found." };
  if (current.stage === toStage) return { ok: true, message: "No change" };

  const today = new Date().toISOString().slice(0, 10);
  const update: Record<string, unknown> = { stage: toStage };
  // Stamp the lifecycle date only if this stage hasn't been recorded before,
  // so dragging back and forth never clobbers an existing milestone.
  if (toStage === "colonization" && !current.colonized_on) update.colonized_on = today;
  else if (toStage === "fruiting" && !current.fruiting_on) update.fruiting_on = today;
  else if (toStage === "spent" && !current.spent_on) update.spent_on = today;

  const { error } = await supabase.from("batches").update(update).eq("id", batchId);
  if (error) return { ok: false, message: error.message };

  await enqueueSync(supabase, "batch", batchId, "update", { stage: toStage });
  revalidatePath(`/batches/${batchId}`);
  revalidatePath("/batches");
  return { ok: true, message: `Moved to ${toStage}` };
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

  const idx = STAGE_ORDER.indexOf(current.stage as (typeof STAGE_ORDER)[number]);
  if (idx < 0) return { ok: false, message: `Stage "${current.stage}" cannot be advanced.` };
  if (idx === STAGE_ORDER.length - 1)
    return { ok: false, message: "Already at the final stage." };

  const next = STAGE_ORDER[idx + 1];
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
