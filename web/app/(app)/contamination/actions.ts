"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";

interface SightingPayload {
  batch_id: number;
  contam_type: string;
  severity: "low" | "med" | "high";
  photo_url: string;
  action_taken: string;
}

const VALID_TYPES = new Set([
  "trichoderma",
  "cobweb",
  "bacterial_blotch",
  "green_mold",
  "wet_spot",
  "other",
]);
const VALID_SEVERITIES = new Set<SightingPayload["severity"]>(["low", "med", "high"]);

export interface SightingResult {
  ok: boolean;
  message: string;
}

export async function logSighting(formData: FormData): Promise<SightingResult> {
  const batchIdRaw = formData.get("batch_id");
  const contamType = String(formData.get("contam_type") ?? "");
  const severity = String(formData.get("severity") ?? "") as SightingPayload["severity"];
  const photoUrl = String(formData.get("photo_url") ?? "").trim().slice(0, 500);
  const actionTaken = String(formData.get("action_taken") ?? "").trim().slice(0, 1000);

  const batchId = batchIdRaw ? Number(batchIdRaw) : NaN;
  if (!Number.isFinite(batchId)) {
    return { ok: false, message: "Pick a batch." };
  }
  if (!VALID_TYPES.has(contamType)) {
    return { ok: false, message: "Invalid contamination type." };
  }
  if (!VALID_SEVERITIES.has(severity)) {
    return { ok: false, message: "Invalid severity." };
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("contamination_logs").insert({
    batch_id: batchId,
    observed_on: new Date().toISOString().slice(0, 10),
    contam_type: contamType,
    severity,
    photo_url: photoUrl,
    action_taken: actionTaken,
    reported_by: "app",
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/contamination");
  return { ok: true, message: "Logged ✓" };
}
