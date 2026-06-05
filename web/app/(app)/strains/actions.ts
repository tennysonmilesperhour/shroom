"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { enqueueSync } from "@/lib/sync";
import type { EntityResult } from "@/components/EntityForm";

const VALID_TYPES = new Set(["psychedelic", "functional", "gourmet"]);

function fToC(f: number): number {
  return Math.round(((f - 32) * 5) / 9 * 10) / 10;
}

export async function addStrain(formData: FormData): Promise<EntityResult> {
  const name = String(formData.get("name") ?? "").trim();
  const mushroom_type = String(formData.get("mushroom_type") ?? "functional");
  const species = String(formData.get("species") ?? "").trim();
  const strain_code = String(formData.get("strain_code") ?? "").trim();
  const vendor = String(formData.get("vendor") ?? "").trim();
  const genetics = String(formData.get("genetics") ?? "").trim();
  const potency = String(formData.get("potency") ?? "").trim();
  const ease = Number(formData.get("ease_rating") ?? 3);
  const tempF = Number(formData.get("target_temp_f") ?? 70);
  const humidity = Number(formData.get("target_humidity") ?? 90);
  const co2 = Number(formData.get("target_co2_ppm") ?? 800);
  const typicalBe = Number(formData.get("typical_be") ?? 75);
  const syringes = Number(formData.get("syringes_on_hand") ?? 0);
  const library_status = String(formData.get("library_status") ?? "active").trim();
  const priorityRaw = String(formData.get("priority") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) return { ok: false, message: "Name is required." };
  if (!VALID_TYPES.has(mushroom_type)) return { ok: false, message: "Invalid mushroom type." };
  if (!Number.isFinite(tempF)) return { ok: false, message: "Invalid temp." };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("strains")
    .insert({
      name,
      mushroom_type,
      species,
      strain_code,
      vendor,
      genetics,
      potency,
      ease_rating: Number.isFinite(ease) ? ease : 3,
      target_temp_c: fToC(tempF),
      target_humidity: Number.isFinite(humidity) ? humidity : 90,
      target_co2_ppm: Number.isFinite(co2) ? co2 : 800,
      typical_be: Number.isFinite(typicalBe) ? typicalBe : 75,
      syringes_on_hand: Number.isFinite(syringes) ? syringes : 0,
      library_status,
      priority: priorityRaw ? Number(priorityRaw) : null,
      notes,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Insert failed." };

  await enqueueSync(supabase, "strain", data.id, "insert", { name, mushroom_type });
  revalidatePath("/strains");
  return { ok: true, message: "Strain added ✓" };
}
