"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import type { EntityResult } from "@/components/EntityForm";
import { parseBagCsv } from "@/lib/bag-csv";

export async function importBags(form: FormData): Promise<EntityResult> {
  const file = form.get("csv");
  if (!(file instanceof File) || file.size > 1_000_000) return { ok: false, message: "Choose a CSV under 1 MB." };
  try {
    const rows = parseBagCsv(await file.text());
    const db = createServiceClient();
    const { data: strains, error } = await db.from("strains").select("id,name");
    if (error) throw new Error(error.message);
    const batches = rows.map((row) => {
      const matches = (strains ?? []).filter((s) => s.name.toLowerCase() === row.strain.toLowerCase());
      if (matches.length !== 1) throw new Error(`Unknown or ambiguous strain: ${row.strain}`);
      return { lot_code: row.lot_code, strain_id: matches[0].id, inoculated_on: row.inoculated_on, stage: "inoculation", container_type: "grain_bag", block_count: 1, notes: row.notes };
    });
    // One transaction; conflict-ignore preserves existing histories on repeat uploads.
    const { data, error: insertError } = await db.from("batches").upsert(batches, { onConflict: "lot_code", ignoreDuplicates: true }).select("id");
    if (insertError) throw new Error(insertError.message);
    revalidatePath("/batches");
    revalidatePath("/");
    return { ok: true, message: `${data?.length ?? 0} grain bags created. Existing lots preserved.` };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : "CSV import failed." }; }
}
