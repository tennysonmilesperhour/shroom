"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { enqueueSync } from "@/lib/sync";
import type { EntityResult } from "@/components/EntityForm";

export async function addCustomer(formData: FormData): Promise<EntityResult> {
  const name = String(formData.get("name") ?? "").trim();
  const channel = String(formData.get("channel") ?? "wholesale").trim();
  const contact_email = String(formData.get("contact_email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const status = String(formData.get("status") ?? "active").trim();
  const role = String(formData.get("role") ?? "").trim();
  const price_tier = String(formData.get("price_tier") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const priorityRaw = String(formData.get("priority") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) return { ok: false, message: "Name is required." };
  const priority = priorityRaw ? Number(priorityRaw) : null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      name, channel, contact_email, phone, status, role, price_tier, region,
      priority, notes,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Insert failed." };

  await enqueueSync(supabase, "customer", data.id, "insert", { name, channel });
  revalidatePath("/customers");
  return { ok: true, message: "Customer added ✓" };
}
