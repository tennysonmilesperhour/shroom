import { Badge, Card, Kpi } from "@/components/ui";
import { createServiceClient } from "@/utils/supabase/service";
import { must } from "@/lib/query";
import MarkSyncedButton from "./MarkSyncedButton";

export const dynamic = "force-dynamic";

interface QueueRow {
  id: number;
  entity: string;
  entity_id: number;
  op: string;
  payload: Record<string, unknown>;
  synced_at: string | null;
  created_at: string;
  source: string;
}

export default async function SyncPage() {
  const supabase = createServiceClient();
  const [pending, recent] = await Promise.all([
    must<QueueRow[]>(
      supabase
        .from("sheet_sync_queue")
        .select("*")
        .is("synced_at", null)
        .order("created_at", { ascending: true })
        .limit(200),
      "load pending ops",
    ),
    must<QueueRow[]>(
      supabase
        .from("sheet_sync_queue")
        .select("*")
        .not("synced_at", "is", null)
        .order("synced_at", { ascending: false })
        .limit(50),
      "load recent synced ops",
    ),
  ]);

  const byEntity = pending.reduce<Record<string, number>>((acc, r) => {
    acc[r.entity] = (acc[r.entity] ?? 0) + 1;
    return acc;
  }, {});
  const entries = Object.entries(byEntity).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div>
        <div className="eyebrow">Sync</div>
        <h1 className="section">Sheet bridge</h1>
        <p className="lead">
          Website changes are captured here as pending ops. An external worker
          will push them to the Google Sheet; for now you can mark a batch as
          synced after reconciling manually. Sheet → website sync continues to
          run on its existing schedule.
        </p>
      </div>

      <div className="kpi-row">
        <Kpi label="Pending ops" value={pending.length} feature />
        <Kpi label="Entities affected" value={entries.length} />
        <Kpi label="Most recent" value={pending[pending.length - 1]?.created_at?.slice(0, 10) ?? "—"} />
        <Kpi label="Synced (last 50)" value={recent.length} />
      </div>

      <Card title="Actions">
        <MarkSyncedButton />
      </Card>

      <Card title={`Pending ops (${pending.length})`}>
        {pending.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Queue is empty. Nothing waiting to flow up to the sheet.
          </p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {entries.map(([k, v]) => (
                <Badge key={k} tone="blue">{k} · {v}</Badge>
              ))}
            </div>
            <table>
              <caption className="sr-only">Pending sync ops</caption>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Entity</th>
                  <th scope="col" className="right">ID</th>
                  <th scope="col">Op</th>
                  <th scope="col">Payload</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id}>
                    <td className="muted">{r.created_at.slice(0, 16).replace("T", " ")}</td>
                    <td>{r.entity}</td>
                    <td className="right">{r.entity_id}</td>
                    <td><Badge tone="muted">{r.op}</Badge></td>
                    <td className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                      {JSON.stringify(r.payload)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>

      <Card title="Recently synced">
        {recent.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No synced ops yet.</p>
        ) : (
          <table>
            <caption className="sr-only">Recently synced ops</caption>
            <thead>
              <tr>
                <th scope="col">Synced</th>
                <th scope="col">Entity</th>
                <th scope="col" className="right">ID</th>
                <th scope="col">Op</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className="muted">
                    {r.synced_at?.slice(0, 16).replace("T", " ")}
                  </td>
                  <td>{r.entity}</td>
                  <td className="right">{r.entity_id}</td>
                  <td><Badge tone="muted">{r.op}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
