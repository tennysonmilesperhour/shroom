"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { toSheetEmbedUrl } from "@/lib/sheets";
import type { EntityResult } from "@/components/EntityForm";

const VALID_CATEGORIES = new Set([
  "general",
  "cultivation",
  "sales",
  "finance",
  "inventory",
]);

export async function addTruthSource(formData: FormData): Promise<EntityResult> {
  const label = String(formData.get("label") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const category = String(formData.get("category") ?? "general");
  const notes = String(formData.get("notes") ?? "").trim();
  const heightRaw = String(formData.get("height") ?? "").trim();

  if (!label) return { ok: false, message: "Label is required." };
  if (!url) return { ok: false, message: "Sheet URL is required." };
  if (!toSheetEmbedUrl(url)) {
    return {
      ok: false,
      message: "That doesn't look like an embeddable URL. Paste a Google Sheets link.",
    };
  }
  if (!VALID_CATEGORIES.has(category)) {
    return { ok: false, message: "Invalid category." };
  }
  let height = heightRaw ? Number(heightRaw) : 540;
  if (!Number.isFinite(height)) height = 540;
  height = Math.min(2000, Math.max(160, Math.round(height)));

  const supabase = createServiceClient();

  // Append to the end of the current ordering.
  const { data: last } = await supabase
    .from("truth_sources")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  const { error } = await supabase
    .from("truth_sources")
    .insert({ label, url, category, notes: notes || null, height, position });
  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/truth-source");
  return { ok: true, message: "Source added ✓" };
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function removeTruthSource(id: number): Promise<ActionResult> {
  if (!Number.isFinite(id)) return { ok: false, message: "Invalid id." };

  const supabase = createServiceClient();
  const { error } = await supabase.from("truth_sources").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/truth-source");
  return { ok: true, message: "Source removed." };
}
