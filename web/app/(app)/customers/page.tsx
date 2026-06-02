import { createClient } from "@/utils/supabase/server";
import { Badge, Card } from "@/components/ui";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

const statusTone = (s: string) =>
  s === "active" || s === "integrated" ? "green" : s === "warm" ? "amber" : "muted";

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .order("priority", { ascending: false, nullsFirst: false })
    .order("name");

  const rows = customers ?? [];

  return (
    <>
      <h2 className="section">Customers & Leads</h2>
      <p className="lead">CRM pipeline — distributors, wholesale, retail, wellness, and market channels.</p>
      <Card>
        <table>
          <thead><tr><th>Name</th><th>Channel</th><th>Role</th><th>Tier</th><th>Status</th><th>Follow-up</th><th className="right">Priority</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><b>{c.name}</b>{c.notes && <div className="muted" style={{ fontSize: 11 }}>{c.notes.slice(0, 80)}</div>}</td>
                <td><Badge tone="muted">{c.channel}</Badge></td>
                <td className="muted">{c.role || "—"}</td>
                <td>{c.price_tier || "—"}</td>
                <td><Badge tone={statusTone(c.status) as any}>{c.status}</Badge></td>
                <td className="muted">{c.follow_up_date || "—"}</td>
                <td className="right"><span className="stars">{"★".repeat(c.priority ?? 0)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
