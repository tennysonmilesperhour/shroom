"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { enqueueSync } from "@/lib/sync";
import type { EntityResult } from "@/components/EntityForm";

export async function addSupply(formData: FormData): Promise<EntityResult> {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "other").trim();
  const unit = String(formData.get("unit") ?? "unit").trim();
  const qty = Number(formData.get("quantity_on_hand") ?? 0);
  const threshold = Number(formData.get("reorder_threshold") ?? 0);
  const cost = Number(formData.get("unit_cost") ?? 0);
  const supplier = String(formData.get("supplier") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();

  if (!name) return { ok: false, message: "Name is required." };
  if (!Number.isFinite(qty) || qty < 0) return { ok: false, message: "Quantity must be ≥ 0." };
  if (!Number.isFinite(threshold) || threshold < 0)
    return { ok: false, message: "Threshold must be ≥ 0." };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .insert({
      name, category, unit,
      quantity_on_hand: qty,
      reorder_threshold: threshold,
      unit_cost: cost,
      supplier, location,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Insert failed." };

  await enqueueSync(supabase, "supply", data.id, "insert", { name, category });
  revalidatePath("/supplies");
  return { ok: true, message: "Supply added ✓" };
}

export async function addEquipment(formData: FormData): Promise<EntityResult> {
  const name = String(formData.get("name") ?? "").trim();
  const spec_notes = String(formData.get("spec_notes") ?? "").trim();
  const status = String(formData.get("status") ?? "active").trim();
  const last_checked = String(formData.get("last_checked") ?? "").trim();

  if (!name) return { ok: false, message: "Name is required." };
  if (!["active", "ordered", "retired"].includes(status))
    return { ok: false, message: "Invalid status." };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("equipment")
    .insert({ name, spec_notes, status, last_checked })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Insert failed." };

  await enqueueSync(supabase, "equipment", data.id, "insert", { name, status });
  revalidatePath("/supplies");
  return { ok: true, message: "Equipment added ✓" };
}

/** Quick-adjust quantity for an existing inventory item. */
export async function adjustSupplyQuantity(
  itemId: number,
  delta: number,
): Promise<EntityResult> {
  if (!Number.isFinite(itemId)) return { ok: false, message: "Invalid item." };
  if (!Number.isFinite(delta) || delta === 0) return { ok: false, message: "No change." };

  const supabase = createServiceClient();
  const { data: current, error: readErr } = await supabase
    .from("inventory_items")
    .select("quantity_on_hand,name")
    .eq("id", itemId)
    .single();
  if (readErr || !current) return { ok: false, message: readErr?.message ?? "Not found." };

  const next = Math.max(0, Number(current.quantity_on_hand) + delta);
  const { error } = await supabase
    .from("inventory_items")
    .update({ quantity_on_hand: next })
    .eq("id", itemId);
  if (error) return { ok: false, message: error.message };

  await enqueueSync(supabase, "supply", itemId, "update", {
    field: "quantity_on_hand",
    delta,
    to: next,
  });
  revalidatePath("/supplies");
  return { ok: true, message: `${current.name}: ${next}` };
}
