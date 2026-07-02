"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { enqueueSync } from "@/lib/sync";
import type { EntityResult } from "@/components/EntityForm";

export async function addHarvest(formData: FormData): Promise<EntityResult> {
  const batch_id = Number(String(formData.get("batch_id") ?? "").trim() || NaN);
  const harvested_on = String(formData.get("harvested_on") ?? "").trim();
  const flush_number = Number(formData.get("flush_number") ?? 1);
  const fresh_g = Number(formData.get("fresh_g") ?? 0);
  const dry_g = Number(formData.get("dry_g") ?? 0);
  const grade = String(formData.get("grade") ?? "A").trim();
  const labor_minutes = Number(formData.get("labor_minutes") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim();

  if (!Number.isFinite(batch_id)) return { ok: false, message: "Pick a batch." };
  if (!harvested_on) return { ok: false, message: "Harvest date is required." };
  if (!Number.isFinite(fresh_g) || fresh_g < 0)
    return { ok: false, message: "Fresh weight must be ≥ 0." };
  if (!Number.isFinite(dry_g) || dry_g < 0)
    return { ok: false, message: "Dry weight must be ≥ 0." };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("harvests")
    .insert({
      batch_id,
      harvested_on,
      flush_number: Number.isFinite(flush_number) ? flush_number : 1,
      weight_kg: fresh_g / 1000,
      dry_weight_kg: dry_g / 1000,
      grade,
      labor_minutes: Number.isFinite(labor_minutes) ? labor_minutes : 0,
      notes,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Insert failed." };

  await enqueueSync(supabase, "harvest", data.id, "insert", {
    batch_id, flush_number, fresh_g, dry_g,
  });
  revalidatePath("/harvests");
  revalidatePath(`/batches/${batch_id}`);
  return { ok: true, message: "Harvest logged ✓" };
}
