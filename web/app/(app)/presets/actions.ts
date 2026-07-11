"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { enqueueSync } from "@/lib/sync";
import { lbToKg } from "@/lib/format";
import type { EntityResult } from "@/components/EntityForm";

const VALID_CONTAINERS = new Set(["tub", "grain_bag", "aio"]);

interface MaterialInput {
  inventory_item_id: number | null;
  name: string;
  quantity: number;
  unit: string;
}

// The materials editor serialises its rows into a single hidden `materials_json`
// field. Parse defensively: a bad payload should never block saving the preset.
function parseMaterials(raw: string): MaterialInput[] {
  if (!raw.trim()) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((m): MaterialInput => ({
        inventory_item_id:
          m?.inventory_item_id != null && Number.isFinite(Number(m.inventory_item_id))
            ? Number(m.inventory_item_id)
            : null,
        name: String(m?.name ?? "").trim(),
        quantity: Number(m?.quantity ?? 0),
        unit: String(m?.unit ?? "unit").trim() || "unit",
      }))
      .filter((m) => (m.inventory_item_id != null || m.name) && Number.isFinite(m.quantity));
  } catch {
    return [];
  }
}

function optionalId(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function addPreset(formData: FormData): Promise<EntityResult> {
  const name = String(formData.get("name") ?? "").trim();
  const strain_id = optionalId(formData.get("strain_id"));
  const recipe_id = optionalId(formData.get("recipe_id"));
  const room_id = optionalId(formData.get("room_id"));
  const container_type = String(formData.get("container_type") ?? "tub");
  const tub_size = String(formData.get("tub_size") ?? "").trim();
  const spawn_type = String(formData.get("spawn_type") ?? "").trim();
  const substrate_type = String(formData.get("substrate_type") ?? "").trim();
  const bag_type = String(formData.get("bag_type") ?? "").trim();
  const block_count = Number(formData.get("block_count") ?? 0);
  // Weights are entered in pounds; storage stays canonical in kg.
  const substrate_weight_lb = Number(formData.get("substrate_weight_lb") ?? 0);
  const spawn_weight_lb = Number(formData.get("spawn_weight_lb") ?? 0);
  const substrate_weight_kg = Number.isFinite(substrate_weight_lb)
    ? lbToKg(substrate_weight_lb)
    : 0;
  const spawn_weight_kg = Number.isFinite(spawn_weight_lb) ? lbToKg(spawn_weight_lb) : 0;
  const notes = String(formData.get("notes") ?? "").trim();
  const materials = parseMaterials(String(formData.get("materials_json") ?? ""));

  if (!name) return { ok: false, message: "Preset name is required." };
  if (!VALID_CONTAINERS.has(container_type))
    return { ok: false, message: "Invalid container type." };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("batch_presets")
    .insert({
      name,
      strain_id,
      recipe_id,
      room_id,
      container_type,
      tub_size,
      spawn_type,
      substrate_type,
      bag_type,
      block_count: Number.isFinite(block_count) ? block_count : 0,
      substrate_weight_kg: Number.isFinite(substrate_weight_kg) ? substrate_weight_kg : 0,
      spawn_weight_kg: Number.isFinite(spawn_weight_kg) ? spawn_weight_kg : 0,
      notes,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Insert failed." };

  if (materials.length > 0) {
    const { error: matErr } = await supabase.from("preset_materials").insert(
      materials.map((m) => ({
        preset_id: data.id,
        inventory_item_id: m.inventory_item_id,
        name: m.name,
        quantity: m.quantity,
        unit: m.unit,
      })),
    );
    if (matErr)
      return { ok: false, message: `Preset saved, but materials failed: ${matErr.message}` };
  }

  await enqueueSync(supabase, "preset", data.id, "insert", { name });
  revalidatePath("/presets");
  revalidatePath("/batches");
  return { ok: true, message: "Preset saved ✓" };
}

export async function deletePreset(presetId: number): Promise<EntityResult> {
  if (!Number.isFinite(presetId)) return { ok: false, message: "Invalid preset." };

  const supabase = createServiceClient();
  const { error } = await supabase.from("batch_presets").delete().eq("id", presetId);
  if (error) return { ok: false, message: error.message };

  await enqueueSync(supabase, "preset", presetId, "delete", {});
  revalidatePath("/presets");
  revalidatePath("/batches");
  return { ok: true, message: "Preset deleted" };
}
