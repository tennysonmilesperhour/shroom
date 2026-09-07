import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createServiceClient } from "@/utils/supabase/service";
import { must } from "@/lib/query";

/** Shared collection scope for list pages and their add/edit choices. Shared, unassigned resources remain available. */
export const currentCollection = cache(async () => {
  const mode = (await cookies()).get("shroom-mushroom-mode")?.value;
  const functional = mode === "functional" || mode === "function";
  const types = functional ? ["functional", "gourmet"] : ["psychedelic"];
  const rows = await must<{ id: number; mushroom_type: string }[]>(createServiceClient().from("strains").select("id,mushroom_type"), "load collection");
  const strainIds = rows.filter((row) => types.includes(row.mushroom_type)).map((row) => row.id);
  return { functional, types, strainIds: strainIds.length ? strainIds : [-1], label: functional ? "Functional" : "Magic" };
});
