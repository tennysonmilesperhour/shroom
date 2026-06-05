"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { enqueueSync } from "@/lib/sync";
import type { EntityResult } from "@/components/EntityForm";

export async function addPurchaseOrder(formData: FormData): Promise<EntityResult> {
  const reference = String(formData.get("reference") ?? "").trim();
  const vendor_id = Number(formData.get("vendor_id") ?? NaN);
  const status = String(formData.get("status") ?? "ordered").trim();
  const ordered_at = String(formData.get("ordered_at") ?? "").trim();
  const expected_at = String(formData.get("expected_at") ?? "").trim();
  const total = Number(formData.get("total") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim();

  if (!reference) return { ok: false, message: "Reference is required." };
  if (!Number.isFinite(vendor_id)) return { ok: false, message: "Pick a vendor." };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .insert({
      reference,
      vendor_id,
      status,
      ordered_at: ordered_at || null,
      expected_at: expected_at || null,
      total: Number.isFinite(total) ? total : 0,
      notes,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Insert failed." };

  await enqueueSync(supabase, "purchase_order", data.id, "insert", { reference, vendor_id });
  revalidatePath("/purchase-orders");
  return { ok: true, message: "PO added ✓" };
}
