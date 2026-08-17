"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { enqueueSync } from "@/lib/sync";
import { kgToLb, lbToKg } from "@/lib/format";
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

// A `*_lb` input converted straight back to kg would drift an untouched value
// (5 kg shows as 11.0 lb, which stores as 4.99 kg). The form carries the stored
// kg along in a hidden `__orig_*` field; when the shown pounds are unchanged,
// keep the stored kilograms exactly as they were.
function weightKg(formData: FormData, lbField: string, origField: string): number {
  const lb = Number(formData.get(lbField) ?? 0);
  if (!Number.isFinite(lb)) return 0;
  const origRaw = formData.get(origField);
  const orig = origRaw == null ? NaN : Number(String(origRaw));
  if (Number.isFinite(orig) && kgToLb(orig) === lb) return orig;
  return lbToKg(lb);
}

interface PresetInput {
  row: Record<string, unknown>;
  name: string;
  materials: MaterialInput[];
}

function parsePresetForm(formData: FormData): PresetInput | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  const container_type = String(formData.get("container_type") ?? "tub");
  if (!name) return { error: "Preset name is required." };
  if (!VALID_CONTAINERS.has(container_type)) return { error: "Invalid container type." };

  const block_count = Number(formData.get("block_count") ?? 0);
  return {
    name,
    materials: parseMaterials(String(formData.get("materials_json") ?? "")),
    row: {
      name,
      strain_id: optionalId(formData.get("strain_id")),
      recipe_id: optionalId(formData.get("recipe_id")),
      room_id: optionalId(formData.get("room_id")),
      container_type,
      tub_size: String(formData.get("tub_size") ?? "").trim(),
      spawn_type: String(formData.get("spawn_type") ?? "").trim(),
      substrate_type: String(formData.get("substrate_type") ?? "").trim(),
      bag_type: String(formData.get("bag_type") ?? "").trim(),
      block_count: Number.isFinite(block_count) ? block_count : 0,
      // Weights are entered in pounds; storage stays canonical in kg.
      substrate_weight_kg: weightKg(formData, "substrate_weight_lb", "__orig_substrate_weight_kg"),
      spawn_weight_kg: weightKg(formData, "spawn_weight_lb", "__orig_spawn_weight_kg"),
      notes: String(formData.get("notes") ?? "").trim(),
    },
  };
}

export async function addPreset(formData: FormData): Promise<EntityResult> {
  const parsed = parsePresetForm(formData);
  if ("error" in parsed) return { ok: false, message: parsed.error };
  const { row, name, materials } = parsed;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("batch_presets")
    .insert(row)
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

export async function updatePreset(
  presetId: number,
  formData: FormData,
): Promise<EntityResult> {
  if (!Number.isFinite(presetId)) return { ok: false, message: "Invalid preset." };
  const parsed = parsePresetForm(formData);
  if ("error" in parsed) return { ok: false, message: parsed.error };
  const { row, name, materials } = parsed;

  const supabase = createServiceClient();
  // .select() so an update that matches nothing reads as the error it is.
  const { data, error } = await supabase
    .from("batch_presets")
    .update(row)
    .eq("id", presetId)
    .select("id");
  if (error) return { ok: false, message: error.message };
  if (!data || data.length === 0)
    return { ok: false, message: "This preset no longer exists — reload the page." };

  // The bill of materials is edited as a whole, so replace it as a whole.
  // Nothing references preset_materials rows (batches snapshot their own
  // copy into batch_materials), so delete + reinsert is safe.
  const { error: clearErr } = await supabase
    .from("preset_materials")
    .delete()
    .eq("preset_id", presetId);
  if (clearErr)
    return { ok: false, message: `Preset saved, but materials failed: ${clearErr.message}` };
  if (materials.length > 0) {
    const { error: matErr } = await supabase.from("preset_materials").insert(
      materials.map((m) => ({
        preset_id: presetId,
        inventory_item_id: m.inventory_item_id,
        name: m.name,
        quantity: m.quantity,
        unit: m.unit,
      })),
    );
    if (matErr)
      return { ok: false, message: `Preset saved, but materials failed: ${matErr.message}` };
  }

  await enqueueSync(supabase, "preset", presetId, "update", { name });
  revalidatePath("/presets");
  revalidatePath("/batches");
  return { ok: true, message: "Preset updated ✓" };
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
