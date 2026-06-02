import { createClient } from "@/utils/supabase/server";
import { Badge, Card } from "@/components/ui";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SuppliesPage() {
  const supabase = await createClient();
  const [items, equipment] = await Promise.all([
    supabase.from("inventory_items").select("*").order("category").order("name"),
    supabase.from("equipment").select("*").order("name"),
  ]);

  const low = (i: any) => i.quantity_on_hand <= i.reorder_threshold;

  return (
    <>
      <h2 className="section">Supplies & Equipment</h2>
      <p className="lead">Consumable stock with reorder thresholds, plus the grow-room equipment register.</p>

      <Card title="Consumables">
        <table>
          <thead><tr><th>Item</th><th>Category</th><th className="right">On hand</th><th className="right">Reorder at</th><th>Status</th><th>Supplier</th></tr></thead>
          <tbody>
            {(items.data ?? []).map((i) => (
              <tr key={i.id} className={low(i) ? "flag-low" : ""}>
                <td><b>{i.name}</b></td>
                <td className="muted">{i.category}</td>
                <td className="right">{i.quantity_on_hand} {i.unit}</td>
                <td className="right">{i.reorder_threshold}</td>
                <td>{low(i) ? <Badge tone="red">reorder</Badge> : <Badge tone="green">ok</Badge>}</td>
                <td className="muted">{i.supplier || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Equipment">
        <table>
          <thead><tr><th>Item</th><th>Spec / notes</th><th>Status</th><th>Checked</th></tr></thead>
          <tbody>
            {(equipment.data ?? []).map((e) => (
              <tr key={e.id}>
                <td><b>{e.name}</b></td>
                <td className="muted" style={{ fontSize: 12 }}>{e.spec_notes}</td>
                <td><Badge tone={e.status === "active" ? "green" : "amber"}>{e.status}</Badge></td>
                <td className="muted">{e.last_checked || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
