import { createClient } from "@/utils/supabase/server";
import { Badge, Card } from "@/components/ui";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage() {
  const supabase = await createClient();
  const { data: pos } = await supabase
    .from("purchase_orders")
    .select("*, vendors(name), purchase_order_items(name,quantity,received_quantity,unit_cost)")
    .order("ordered_at", { ascending: false, nullsFirst: false });

  const rows = pos ?? [];

  return (
    <>
      <h2 className="section">Purchase Orders</h2>
      <p className="lead">Supplier restock — spawn, grain, substrate, and lab supplies.</p>
      {rows.length === 0 ? (
        <Card><div className="muted">No purchase orders.</div></Card>
      ) : rows.map((p: any) => (
        <Card key={p.id} title={`${p.reference || "PO"} · ${p.vendors?.name ?? ""}`}>
          <div style={{ display: "flex", gap: 14, marginBottom: 10, flexWrap: "wrap" }}>
            <Badge tone={p.status === "received" ? "green" : "amber"}>{p.status}</Badge>
            <span className="muted">Ordered {p.ordered_at || "—"} · Expected {p.expected_at || "—"}</span>
            <span className="muted">Total {money(p.total)}</span>
          </div>
          <table>
            <thead><tr><th>Item</th><th className="right">Qty</th><th className="right">Received</th><th className="right">Unit cost</th></tr></thead>
            <tbody>
              {(p.purchase_order_items ?? []).map((it: any, i: number) => (
                <tr key={i}><td>{it.name}</td><td className="right">{it.quantity}</td><td className="right">{it.received_quantity}</td><td className="right">{money(it.unit_cost)}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </>
  );
}
