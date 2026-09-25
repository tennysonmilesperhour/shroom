"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  // Straight to the new order so the operator can add its line items.
  redirect(`/orders/${data.id}`);
}

// Line items are what make an order worth anything: every revenue surface sums
// order_lines, and the harvest link on each line is what lets a recall trace a
// lot forward to the customers who received it.
export async function addOrderLine(orderId: number, formData: FormData): Promise<EntityResult> {
  if (!Number.isFinite(orderId)) return { ok: false, message: "Invalid order." };
  const product_id = Number(String(formData.get("product_id") ?? "").trim() || NaN);
  const harvestRaw = String(formData.get("harvest_id") ?? "").trim();
  const harvest_id = harvestRaw === "" ? null : Number(harvestRaw);
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const priceRaw = String(formData.get("unit_price") ?? "").trim();
  const quantity = Number(quantityRaw);

  if (!Number.isFinite(product_id)) return { ok: false, message: "Pick a product." };
  if (harvest_id !== null && !Number.isFinite(harvest_id)) return { ok: false, message: "Pick a valid harvest." };
  if (quantityRaw === "" || !Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, message: "Quantity must be a number greater than 0." };
  }
  if (priceRaw !== "" && (!Number.isFinite(Number(priceRaw)) || Number(priceRaw) < 0)) {
    return { ok: false, message: "Unit price must be 0 or more." };
  }

  const supabase = createServiceClient();
  const [{ data: order, error: orderError }, { data: product, error: productError }] = await Promise.all([
    supabase.from("orders").select("id,channel").eq("id", orderId).single(),
    supabase.from("products").select("id,name,sku,price,distributor_price").eq("id", product_id).single(),
  ]);
  if (orderError || !order) return { ok: false, message: "This order no longer exists. Reload the page." };
  if (productError || !product) return { ok: false, message: "That product no longer exists." };

  // Blank price → the product's list price for this order's channel.
  const listPrice =
    order.channel === "distributor" && Number(product.distributor_price) > 0
      ? Number(product.distributor_price)
      : Number(product.price) || 0;
  const unit_price = priceRaw === "" ? listPrice : Number(priceRaw);

  const { error } = await supabase.from("order_lines").insert({
    order_id: orderId,
    product_id,
    harvest_id,
    quantity,
    unit_price,
    title: product.name ?? "",
    sku: product.sku ?? "",
  });
  if (error) return { ok: false, message: error.message };

  await enqueueSync(supabase, "order", orderId, "update", { line_added: product_id });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { ok: true, message: harvest_id === null ? "Line added. Link a harvest to make it traceable." : "Line added ✓" };
}

export async function removeOrderLine(orderId: number, lineId: number): Promise<EntityResult> {
  if (!Number.isFinite(orderId) || !Number.isFinite(lineId)) return { ok: false, message: "Invalid line." };
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("order_lines")
    .delete()
    .eq("id", lineId)
    .eq("order_id", orderId)
    .select("id");
  if (error) return { ok: false, message: error.message };
  if (!data || data.length === 0) return { ok: false, message: "This line no longer exists. Reload the page." };
  await enqueueSync(supabase, "order", orderId, "update", { line_removed: lineId });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { ok: true, message: "Line removed" };
}
