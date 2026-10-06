"use server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/utils/supabase/service";
export async function archiveBatches(ids: number[], archived: boolean) {
  if (!ids.length || ids.length > 500 || ids.some((id) => !Number.isSafeInteger(id) || id < 1)) return { ok: false, message: "Select valid batches." };
  const { data, error } = await createServiceClient().rpc("archive_batches", { p_ids: ids, p_archived: archived });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/batches"); revalidatePath("/");
  for (const id of ids) revalidatePath(`/batches/${id}`);
  return { ok: true, message: `${data} batches ${archived ? "archived" : "restored"}. Harvests and order links preserved.` };
}
