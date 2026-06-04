"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";

export interface GenerateResult {
  ok: boolean;
  created: number;
  message: string;
}

export async function generateProtocolTasks(
  protocolId: number,
  batchId: number | null,
): Promise<GenerateResult> {
  if (!Number.isFinite(protocolId) || protocolId <= 0) {
    return { ok: false, created: 0, message: "Pick a protocol." };
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("generate_protocol_tasks", {
    p_protocol_id: protocolId,
    p_batch_id: batchId,
  });

  if (error) {
    return { ok: false, created: 0, message: error.message };
  }

  revalidatePath("/batches");
  return { ok: true, created: Number(data ?? 0), message: "" };
}
