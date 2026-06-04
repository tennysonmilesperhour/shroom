import { createServiceClient } from "@/utils/supabase/service";
import { Badge, Card } from "@/components/ui";
import { must } from "@/lib/query";

export const dynamic = "force-dynamic";

interface SafetyLog {
  id: number;
  log_date: string;
  category: string;
  description: string;
  performed_by: string | null;
  passed: boolean;
  corrective_action: string | null;
}

export default async function FoodSafetyPage() {
  const supabase = createServiceClient();
  const logs = await must<SafetyLog[]>(
    supabase.from("food_safety_logs").select("*").order("log_date", { ascending: false }),
    "load food safety logs",
  );

  return (
    <>
      <div>
        <div className="eyebrow">Safety</div>
        <h1 className="section">Food safety &amp; <em>GAP audit trail</em></h1>
        <p className="lead">
          Sanitation, hygiene, water, temperature, and pest logs — the audit trail wholesale buyers ask for.
        </p>
      </div>

      <Card>
        {logs.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No logs yet. Record sanitation, worker-hygiene, and temperature checks here.
          </p>
        ) : (
          <table>
            <caption className="sr-only">Food safety logs</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Category</th>
                <th scope="col">Description</th>
                <th scope="col">By</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="muted">{l.log_date}</td>
                  <td>
                    <Badge tone="muted">{l.category}</Badge>
                  </td>
                  <td>
                    {l.description}
                    {l.corrective_action && (
                      <div className="muted" style={{ fontSize: 11 }}>
                        ↳ {l.corrective_action}
                      </div>
                    )}
                  </td>
                  <td className="muted">{l.performed_by ?? "—"}</td>
                  <td>
                    <Badge tone={l.passed ? "green" : "red"}>
                      {l.passed ? "pass" : "fail"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
