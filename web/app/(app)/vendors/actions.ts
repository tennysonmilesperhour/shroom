"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { enqueueSync } from "@/lib/sync";
import type { EntityResult } from "@/components/EntityForm";

const VALID_CATEGORIES = new Set(["spores", "functional", "supplies", "sourcing"]);

export async function addVendor(formData: FormData): Promise<EntityResult> {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "supplies");
  const products = String(formData.get("products") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const ratingRaw = String(formData.get("rating") ?? "").trim();
  const contact_priority = String(formData.get("contact_priority") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) return { ok: false, message: "Name is required." };
  if (!VALID_CATEGORIES.has(category)) return { ok: false, message: "Invalid category." };
  const rating = ratingRaw ? Number(ratingRaw) : null;
  if (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 5)) {
    return { ok: false, message: "Rating must be 0–5." };
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("vendors")
    .insert({ name, category, products, url, rating, contact_priority, notes })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, message: error?.message ?? "Insert failed." };
  }

  await enqueueSync(supabase, "vendor", data.id, "insert", {
    name, category, url,
  });
  revalidatePath("/vendors");
  return { ok: true, message: "Vendor added ✓" };
}
