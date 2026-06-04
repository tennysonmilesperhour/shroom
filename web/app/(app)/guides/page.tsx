import { createServiceClient } from "@/utils/supabase/service";
import { Badge, Card } from "@/components/ui";
import { must } from "@/lib/query";

export const dynamic = "force-dynamic";

interface ProtocolRow {
  id: number;
  name: string;
  steps: string[];
}
interface GuideRow {
  id: number;
  guide_type: string;
  label: string;
  appearance: string | null;
  cause: string | null;
  action: string;
}
interface IssueRow {
  id: number;
  log_date: string | null;
  issue: string;
  root_cause: string | null;
  resolution: string | null;
}

export default async function GuidesPage() {
  const supabase = createServiceClient();
  const [protocols, guides, issues] = await Promise.all([
    must<ProtocolRow[]>(supabase.from("protocols").select("*").order("name"), "load protocols"),
    must<GuideRow[]>(
      supabase.from("reference_guides").select("*").order("guide_type"),
      "load reference guides",
    ),
    must<IssueRow[]>(
      supabase
        .from("issue_log")
        .select("*")
        .order("log_date", { ascending: false, nullsFirst: false }),
      "load issue log",
    ),
  ]);

  const contamination = guides.filter((g) => g.guide_type === "contamination");
  const symptoms = guides.filter((g) => g.guide_type === "symptom");

  return (
    <>
      <div>
        <div className="eyebrow">Reference</div>
        <h1 className="section">Standard operating procedures</h1>
        <p className="lead">
          SOPs, contamination &amp; troubleshooting references, and the lessons-learned log.
        </p>
      </div>

      <Card title="Operating procedures">
        {protocols.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No protocols defined.</p>
        ) : (
          protocols.map((p) => (
            <details className="acc" key={p.id} style={{ marginBottom: 8 }}>
              <summary>
                {p.name} <Badge tone="muted">{p.steps.length} steps</Badge>
              </summary>
              <ol className="steps" style={{ marginTop: 10 }}>
                {p.steps.map((s, i) => (
                  <li key={`${p.id}-${i}`}>{s}</li>
                ))}
              </ol>
            </details>
          ))
        )}
      </Card>

      <div className="grid two">
        <Card title="Contamination guide">
          {contamination.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No contamination references.</p>
          ) : (
            <table>
              <caption className="sr-only">Contamination guide</caption>
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {contamination.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <b>{g.label}</b>
                      <br />
                      <span className="muted">{g.appearance}</span>
                    </td>
                    <td>{g.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Troubleshooting (symptom → fix)">
          {symptoms.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No symptom references.</p>
          ) : (
            <table>
              <caption className="sr-only">Troubleshooting symptoms and fixes</caption>
              <thead>
                <tr>
                  <th scope="col">Symptom</th>
                  <th scope="col">Fix</th>
                </tr>
              </thead>
              <tbody>
                {symptoms.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <b>{g.label}</b>
                      <br />
                      <span className="muted">{g.cause}</span>
                    </td>
                    <td>{g.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Issue log (lessons learned)">
        {issues.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No issues logged yet.</p>
        ) : (
          <table>
            <caption className="sr-only">Issue log</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Issue</th>
                <th scope="col">Root cause</th>
                <th scope="col">Resolution</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((i) => (
                <tr key={i.id}>
                  <td className="muted">{i.log_date ?? "-"}</td>
                  <td>{i.issue}</td>
                  <td className="muted">{i.root_cause ?? "-"}</td>
                  <td>{i.resolution ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
