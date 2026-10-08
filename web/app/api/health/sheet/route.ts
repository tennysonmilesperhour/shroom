import { createServiceClient } from "@/utils/supabase/service";
import { importHealth } from "@/lib/sheet-sync-status";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const db = createServiceClient();
    const [runs, queue] = await Promise.all([
      db.from("sheet_imports").select("status,started_at").order("started_at", { ascending: false }).limit(10),
      db.from("sheet_sync_queue").select("id", { count: "exact", head: true }).is("synced_at", null),
    ]);
    if (runs.error || queue.error) throw new Error("Connection failed");
    const health = importHealth(runs.data ?? []);
    const ok = health.state === "healthy" && (queue.count ?? 0) === 0;
    return Response.json({ ok, state: health.state, queueEmpty: (queue.count ?? 0) === 0 }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ ok: false, state: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
