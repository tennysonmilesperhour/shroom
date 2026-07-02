"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { enqueueSync } from "@/lib/sync";
import type { EntityResult } from "@/components/EntityForm";

export async function addOrder(formData: FormData): Promise<EntityResult> {
  const order_number = String(formData.get("order_number") ?? "").trim();
  const customer_id = Number(String(formData.get("customer_id") ?? "").trim() || NaN);
  const channel = String(formData.get("channel") ?? "wholesale").trim();
  const order_date = String(formData.get("order_date") ?? "").trim();
  const financial_status = String(formData.get("financial_status") ?? "pending").trim();
  const fulfillment_status = String(formData.get("fulfillment_status") ?? "unfulfilled").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!order_number) return { ok: false, message: "Order number is required." };
  if (!Number.isFinite(customer_id)) return { ok: false, message: "Pick a customer." };
  if (!order_date) return { ok: false, message: "Order date is required." };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .insert({
      order_number,
      customer_id,
      channel,
      order_date,
      financial_status,
      fulfillment_status,
      notes,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Insert failed." };

  await enqueueSync(supabase, "order", data.id, "insert", { order_number, customer_id });
  revalidatePath("/orders");
  return { ok: true, message: "Order added ✓" };
}
