import { createClient } from "@/utils/supabase/server";
import { Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FoodSafetyPage() {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("food_safety_logs")
    .select("*")
    .order("log_date", { ascending: false });

  const rows = logs ?? [];

  return (
    <>
      <h2 className="section">Food Safety / GAP</h2>
      <p className="lead">Sanitation, hygiene, water, temperature, and pest logs — the audit trail wholesale buyers ask for.</p>
      <Card>
        {rows.length === 0 ? (
          <div className="muted">No logs yet. Record sanitation, worker-hygiene, and temperature checks here.</div>
        ) : (
          <table>
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>By</th><th>Result</th></tr></thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className="muted">{l.log_date}</td>
                  <td><Badge tone="muted">{l.category}</Badge></td>
                  <td>{l.description}{l.corrective_action && <div className="muted" style={{ fontSize: 11 }}>↳ {l.corrective_action}</div>}</td>
                  <td className="muted">{l.performed_by}</td>
                  <td><Badge tone={l.passed ? "green" : "red"}>{l.passed ? "pass" : "fail"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
