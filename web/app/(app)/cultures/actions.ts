"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { enqueueSync } from "@/lib/sync";
import type { EntityResult } from "@/components/EntityForm";
import {
  CULTURE_STATUS_VALUES,
  CULTURE_TYPE_VALUES,
  cultureStatusLabel,
} from "./constants";

const nullableDate = (v: FormDataEntryValue | null): string | null => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

export async function addCulture(formData: FormData): Promise<EntityResult> {
  const label = String(formData.get("label") ?? "").trim();
  const culture_type = String(formData.get("culture_type") ?? "spore_syringe").trim();
  const status = String(formData.get("status") ?? "stored").trim();
  const strainRaw = String(formData.get("strain_id") ?? "").trim();
  const qty = Number(formData.get("quantity_on_hand") ?? 1);
  const unit = String(formData.get("unit") ?? "unit").trim();
  const threshold = Number(formData.get("reorder_threshold") ?? 0);
  const location = String(formData.get("location") ?? "").trim();
  const source = String(formData.get("source") ?? "").trim();
  const acquired_on = nullableDate(formData.get("acquired_on"));
  const expires_on = nullableDate(formData.get("expires_on"));
  const notes = String(formData.get("notes") ?? "").trim();

  if (!label) return { ok: false, message: "Label is required." };
  if (!CULTURE_TYPE_VALUES.includes(culture_type))
    return { ok: false, message: "Unknown culture type." };
  if (!CULTURE_STATUS_VALUES.includes(status))
    return { ok: false, message: "Unknown status." };
  if (!Number.isFinite(qty) || qty < 0) return { ok: false, message: "Quantity must be ≥ 0." };
  if (!Number.isFinite(threshold) || threshold < 0)
    return { ok: false, message: "Threshold must be ≥ 0." };

  const strain_id = strainRaw === "" ? null : Number(strainRaw);
  if (strain_id !== null && !Number.isFinite(strain_id))
    return { ok: false, message: "Invalid strain." };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("culture_inventory")
    .insert({
      label,
      culture_type,
      status,
      strain_id,
      quantity_on_hand: qty,
      unit,
      reorder_threshold: threshold,
      location,
      source,
      acquired_on,
      expires_on,
      notes,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Insert failed." };

  await enqueueSync(supabase, "culture", data.id, "insert", { label, culture_type, status });
  revalidatePath("/cultures");
  return { ok: true, message: "Culture added ✓" };
}

/** Move a unit one stage forward/back through the lifecycle (or set directly). */
export async function setCultureStatus(
  cultureId: number,
  status: string,
): Promise<EntityResult> {
  if (!Number.isFinite(cultureId)) return { ok: false, message: "Invalid unit." };
  if (!CULTURE_STATUS_VALUES.includes(status))
    return { ok: false, message: "Unknown status." };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("culture_inventory")
    .update({ status })
    .eq("id", cultureId)
    .select("label")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Update failed." };

  await enqueueSync(supabase, "culture", cultureId, "update", { field: "status", to: status });
  revalidatePath("/cultures");
  return { ok: true, message: `${data.label}: ${cultureStatusLabel(status)}` };
}

/** Quick +/- on the on-hand count of a culture unit. */
export async function adjustCultureQuantity(
  cultureId: number,
  delta: number,
): Promise<EntityResult> {
  if (!Number.isFinite(cultureId)) return { ok: false, message: "Invalid unit." };
  if (!Number.isFinite(delta) || delta === 0) return { ok: false, message: "No change." };

  const supabase = createServiceClient();
  const { data: current, error: readErr } = await supabase
    .from("culture_inventory")
    .select("quantity_on_hand,label")
    .eq("id", cultureId)
    .single();
  if (readErr || !current) return { ok: false, message: readErr?.message ?? "Not found." };

  const next = Math.max(0, Number(current.quantity_on_hand) + delta);
  const { error } = await supabase
    .from("culture_inventory")
    .update({ quantity_on_hand: next })
    .eq("id", cultureId);
  if (error) return { ok: false, message: error.message };

  await enqueueSync(supabase, "culture", cultureId, "update", {
    field: "quantity_on_hand",
    delta,
    to: next,
  });
  revalidatePath("/cultures");
  return { ok: true, message: `${current.label}: ${next}` };
}
