import { createClient } from "@/utils/supabase/server";
import { Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function GuidesPage() {
  const supabase = await createClient();
  const [protocols, guides, issues] = await Promise.all([
    supabase.from("protocols").select("*").order("name"),
    supabase.from("reference_guides").select("*").order("guide_type"),
    supabase.from("issue_log").select("*").order("log_date", { ascending: false, nullsFirst: false }),
  ]);

  const contamination = (guides.data ?? []).filter((g) => g.guide_type === "contamination");
  const symptoms = (guides.data ?? []).filter((g) => g.guide_type === "symptom");

  return (
    <>
      <h2 className="section">SOPs & Guides</h2>
      <p className="lead">Standard operating procedures, contamination &amp; troubleshooting references, and the lessons-learned log.</p>

      <Card title="SOP protocols">
        {(protocols.data ?? []).map((p) => (
          <details className="acc" key={p.id} style={{ marginBottom: 8 }}>
            <summary>{p.name} <Badge tone="muted">{(p.steps as string[]).length} steps</Badge></summary>
            <ol className="steps" style={{ marginTop: 10 }}>
              {(p.steps as string[]).map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </details>
        ))}
      </Card>

      <div className="grid two">
        <Card title="Contamination guide">
          <table>
            <thead><tr><th>Type</th><th>Action</th></tr></thead>
            <tbody>{contamination.map((g) => (
              <tr key={g.id}><td><b>{g.label}</b><br /><span className="muted">{g.appearance}</span></td><td>{g.action}</td></tr>
            ))}</tbody>
          </table>
        </Card>
        <Card title="Troubleshooting (symptom → fix)">
          <table>
            <thead><tr><th>Symptom</th><th>Fix</th></tr></thead>
            <tbody>{symptoms.map((g) => (
              <tr key={g.id}><td><b>{g.label}</b><br /><span className="muted">{g.cause}</span></td><td>{g.action}</td></tr>
            ))}</tbody>
          </table>
        </Card>
      </div>

      <Card title="Issue log (lessons learned)">
        <table>
          <thead><tr><th>Date</th><th>Issue</th><th>Root cause</th><th>Resolution</th></tr></thead>
          <tbody>{(issues.data ?? []).map((i) => (
            <tr key={i.id}><td className="muted">{i.log_date ?? "—"}</td><td>{i.issue}</td><td className="muted">{i.root_cause}</td><td>{i.resolution}</td></tr>
          ))}</tbody>
        </table>
      </Card>
    </>
  );
}
