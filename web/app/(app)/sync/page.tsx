import { Badge, Card, Kpi } from "@/components/ui";
import { createServiceClient } from "@/utils/supabase/service";
import { must } from "@/lib/query";
import MarkSyncedButton from "./MarkSyncedButton";
import SyncFromSheetButton from "./SyncFromSheetButton";

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

interface ImportRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  source: string;
  status: string;
  rows_upserted: Record<string, number>;
  detail: string;
}

export default async function SyncPage() {
  const supabase = createServiceClient();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [pending, recent, imports] = await Promise.all([
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
    must<ImportRun[]>(
      supabase
        .from("sheet_imports")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(10),
      "load sheet imports",
    ),
  ]);

  const syncedToday = imports.some((r) => new Date(r.started_at) >= todayStart);
  const lastImport = imports[0] ?? null;
  const lastSyncLabel = lastImport
    ? new Date(lastImport.started_at).toISOString().slice(0, 16).replace("T", " ")
    : "—";

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
          The <strong>Master Cultivation Reference</strong> sheet is the source
          of truth. Pull it into the app with one click below (sheet → website).
          Website edits are captured separately as pending ops to push back up.
        </p>
      </div>

      <div className="kpi-row">
        <Kpi label="Last sheet sync" value={lastSyncLabel} feature />
        <Kpi label="Pending ops (to sheet)" countTo={pending.length} />
        <Kpi label="Entities affected" countTo={entries.length} />
        <Kpi label="Synced (last 50)" countTo={recent.length} />
      </div>

      <Card title="Pull from the sheet (sheet → website)">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <SyncFromSheetButton syncedToday={syncedToday} />
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {syncedToday
              ? "Already synced today. The button re-enables tomorrow; an admin can still re-run it from GitHub Actions."
              : "Pulls strains, inventory, vendors, buyers, harvests and more straight from the workbook. Runs in about a minute."}
          </p>
          {imports.length > 0 && (
            <table>
              <caption className="sr-only">Recent sheet imports</caption>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Source</th>
                  <th scope="col">Status</th>
                  <th scope="col">Rows</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((r) => (
                  <tr key={r.id}>
                    <td className="muted">
                      {new Date(r.started_at).toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    <td>{r.source || "—"}</td>
                    <td>
                      <Badge tone={r.status === "ok" ? "green" : r.status === "error" ? "red" : "blue"}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                      {Object.values(r.rows_upserted ?? {}).reduce((a, b) => a + (Number(b) || 0), 0) || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Card title="Push to the sheet (website → sheet)">
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
