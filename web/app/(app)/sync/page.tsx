import { Badge, Card, Kpi } from "@/components/ui";
import { createServiceClient } from "@/utils/supabase/service";
import { must } from "@/lib/query";
import MarkSyncedButton from "./MarkSyncedButton";
import SyncFromSheetButton from "./SyncFromSheetButton";
import PushToSheetButton from "./PushToSheetButton";
import WorkbookUpload from "./WorkbookUpload";
import { activeSheetImport, displayImportStatus } from "@/lib/sheet-sync-status";

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
  const cloudConfigured = Boolean(process.env.GITHUB_DISPATCH_TOKEN);

  const cutoff = new Date().toISOString();
  const [pending, recent, imports, pendingCount] = await Promise.all([
    must<QueueRow[]>(
      supabase
        .from("sheet_sync_queue")
        .select("*")
        .is("synced_at", null)
        .lte("created_at", cutoff)
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
    supabase.from("sheet_sync_queue").select("id", { count: "exact", head: true }).is("synced_at", null).lte("created_at", cutoff),
  ]);
  if (pendingCount.error) throw new Error("Could not count pending sheet updates.");
  const pendingTotal = pendingCount.count ?? pending.length;

  const inProgress = activeSheetImport(imports);
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
        <h1 className="section">Your records, in sync.</h1>
        <p className="lead">
          Bring your <strong>Master Cultivation Reference</strong> into Shroom.
          Preview a workbook from your device, or sync your connected cloud sheet.
        </p>
      </div>

      <WorkbookUpload />

      <div className="kpi-row sync-kpis">
        <Kpi label="Last import" value={lastSyncLabel} />
        <Kpi label="Pending ops (to sheet)" countTo={pendingTotal} />
        <Kpi label="Entities in visible ops" countTo={entries.length} />
        <Kpi label="Synced (last 50)" countTo={recent.length} />
      </div>

      <Card title="Pull from the sheet (sheet → website)">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <SyncFromSheetButton inProgress={inProgress} configured={cloudConfigured} />
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {!cloudConfigured ? "Import a workbook above to update your records. Cloud sync becomes available when the sheet connection is set up."
              : inProgress ? "Your sheet is being imported. This page checks for completion automatically."
              : "Pull the latest saved sheet whenever you need it. A failed or completed attempt never blocks another sync."}
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
                        {displayImportStatus(r)}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {cloudConfigured ? <PushToSheetButton /> : <p className="muted">Cloud write-back is not connected yet.</p>}
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Writes the app&rsquo;s current data back into the{" "}
            <strong>Master Cultivation Reference</strong> — a non-destructive
            keyed upsert (owned rows updated in place, new ones appended,
            hand-maintained columns left untouched). Only changes fully covered by those workbook fields are marked synced after the write finishes. Other fields and deletions stay pending for manual reconciliation.
          </p>
          <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "2px 0" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <MarkSyncedButton cutoff={cutoff} count={pendingTotal} />
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              Manual override: mark all pending ops counted above as synced without
              running a push — for when the sheet was reconciled by hand.
            </p>
          </div>
        </div>
      </Card>

      <Card title={`Pending ops (${pendingTotal})`}>
        {pendingTotal > pending.length && <p className="muted">Showing the oldest {pending.length} of {pendingTotal} pending changes.</p>}
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
