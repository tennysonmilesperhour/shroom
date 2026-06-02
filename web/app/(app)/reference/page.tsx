import { createClient } from "@/utils/supabase/server";
import { Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ReferencePage() {
  const supabase = await createClient();
  const [protocols, guides, issues, vendors, equipment, tiers] = await Promise.all([
    supabase.from("protocols").select("*").order("name"),
    supabase.from("reference_guides").select("*").order("guide_type"),
    supabase.from("issue_log").select("*").order("log_date", { ascending: false, nullsFirst: false }),
    supabase.from("vendors").select("*").order("category"),
    supabase.from("equipment").select("*").order("name"),
    supabase.from("price_tiers").select("*"),
  ]);

  const contamination = (guides.data ?? []).filter((g) => g.guide_type === "contamination");
  const symptoms = (guides.data ?? []).filter((g) => g.guide_type === "symptom");

  return (
    <>
      <h2 className="section">Reference Library</h2>
      <p className="lead">SOPs, contamination &amp; troubleshooting guides, issue log, vendors, equipment, and pricing — mirrored from the Master Cultivation sheet.</p>

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
            <tbody>
              {contamination.map((g) => (
                <tr key={g.id}><td><b>{g.label}</b><br /><span className="muted">{g.appearance}</span></td><td>{g.action}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Troubleshooting (symptom → fix)">
          <table>
            <thead><tr><th>Symptom</th><th>Fix</th></tr></thead>
            <tbody>
              {symptoms.map((g) => (
                <tr key={g.id}><td><b>{g.label}</b><br /><span className="muted">{g.cause}</span></td><td>{g.action}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Issue log (lessons learned)">
        <table>
          <thead><tr><th>Date</th><th>Issue</th><th>Root cause</th><th>Resolution</th></tr></thead>
          <tbody>
            {(issues.data ?? []).map((i) => (
              <tr key={i.id}><td className="muted">{i.log_date ?? "—"}</td><td>{i.issue}</td><td className="muted">{i.root_cause}</td><td>{i.resolution}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid two">
        <Card title="Pricing tiers">
          <table>
            <thead><tr><th>Tier</th><th>Class</th><th className="right">$/g</th><th className="right">$/lb</th></tr></thead>
            <tbody>
              {(tiers.data ?? []).map((t) => (
                <tr key={t.id}>
                  <td>{t.tier}</td><td className="muted">{t.product_class}</td>
                  <td className="right">{t.min_per_gram ? `$${t.min_per_gram}–${t.max_per_gram}` : "—"}</td>
                  <td className="right">{t.min_per_lb ? `$${t.min_per_lb}–${t.max_per_lb}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Equipment">
          <table>
            <thead><tr><th>Item</th><th>Status</th></tr></thead>
            <tbody>
              {(equipment.data ?? []).map((e) => (
                <tr key={e.id}><td><b>{e.name}</b><br /><span className="muted">{e.spec_notes}</span></td><td><Badge tone={e.status === "active" ? "green" : "amber"}>{e.status}</Badge></td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Vendors">
        <table>
          <thead><tr><th>Vendor</th><th>Category</th><th>Products</th><th>Notes</th></tr></thead>
          <tbody>
            {(vendors.data ?? []).map((v) => (
              <tr key={v.id}><td><b>{v.name}</b></td><td><Badge tone="muted">{v.category}</Badge></td><td className="muted">{v.products}</td><td className="muted">{v.notes}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
