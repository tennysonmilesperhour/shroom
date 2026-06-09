import { createServiceClient } from "@/utils/supabase/service";
import { Badge, Card } from "@/components/ui";
import { must } from "@/lib/query";
import SightingForm from "./SightingForm";
import RowActions from "@/components/RowActions";

export const dynamic = "force-dynamic";

interface LogRow {
  id: number;
  observed_on: string;
  contam_type: string;
  severity: "low" | "med" | "high";
  batch_id: number | null;
  action_taken: string | null;
  reported_by: string | null;
  batches: { lot_code: string } | null;
}

interface GuideRow {
  label: string;
  action: string;
}

interface BatchOption {
  id: number;
  lot_code: string;
  container_id: string | null;
}

export default async function ContaminationPage() {
  const supabase = createServiceClient();
  const [logs, guides, batches] = await Promise.all([
    must<LogRow[]>(
      supabase
        .from("contamination_logs")
        .select(
          "id,observed_on,contam_type,severity,batch_id,action_taken,reported_by,batches(lot_code)",
        )
        .order("observed_on", { ascending: false })
        .returns<LogRow[]>(),
      "load contamination logs",
    ),
    must<GuideRow[]>(
      supabase
        .from("reference_guides")
        .select("label,action")
        .eq("guide_type", "contamination"),
      "load contamination guides",
    ),
    must<BatchOption[]>(
      supabase
        .from("batches")
        .select("id,lot_code,container_id")
        .order("created_at", { ascending: false }),
      "load batches",
    ),
  ]);

  const batchSelectOptions = batches.map((b) => ({
    value: String(b.id),
    label: b.lot_code,
  }));

  return (
    <>
      <div>
        <div className="eyebrow">Safety</div>
        <h1 className="section">Contamination log</h1>
        <p className="lead">
          Record sightings with a photo and action taken. The reference guide hints adjust based on
          the type you select.
        </p>
      </div>

      <div className="grid two">
        <Card title="Log a sighting">
          <SightingForm batches={batches} guides={guides} />
        </Card>

        <Card title="Recent sightings">
          {logs.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>None logged.</p>
          ) : (
            <table>
              <caption className="sr-only">Recent contamination sightings</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Batch</th>
                  <th scope="col">Type</th>
                  <th scope="col">Severity</th>
                  <th scope="col" className="actions-col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="muted">{l.observed_on}</td>
                    <td>{l.batches?.lot_code ?? "-"}</td>
                    <td>{l.contam_type}</td>
                    <td>
                      <Badge
                        tone={
                          l.severity === "high"
                            ? "red"
                            : l.severity === "med"
                              ? "amber"
                              : "muted"
                        }
                      >
                        {l.severity}
                      </Badge>
                    </td>
                    <td className="actions-col">
                      <RowActions
                        entity="contamination"
                        id={l.id}
                        label={l.batches?.lot_code ?? l.contam_type}
                        initial={{
                          batch_id: l.batch_id,
                          observed_on: l.observed_on,
                          contam_type: l.contam_type,
                          severity: l.severity,
                          action_taken: l.action_taken,
                          reported_by: l.reported_by,
                        }}
                        options={{ batch_id: batchSelectOptions }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
