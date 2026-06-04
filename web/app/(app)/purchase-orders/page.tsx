import { createServiceClient } from "@/utils/supabase/service";
import { Badge, Card } from "@/components/ui";
import { money } from "@/lib/format";
import { must } from "@/lib/query";

export const dynamic = "force-dynamic";

interface POItem {
  id?: number;
  name: string;
  quantity: number;
  received_quantity: number;
  unit_cost: number;
}

interface PORow {
  id: number;
  reference: string | null;
  status: string;
  ordered_at: string | null;
  expected_at: string | null;
  total: number;
  vendors: { name: string } | null;
  purchase_order_items: POItem[] | null;
}

export default async function PurchaseOrdersPage() {
  const supabase = createServiceClient();
  const pos = await must<PORow[]>(
    supabase
      .from("purchase_orders")
      .select(
        "*, vendors(name), purchase_order_items(id,name,quantity,received_quantity,unit_cost)",
      )
      .order("ordered_at", { ascending: false, nullsFirst: false }),
    "load purchase orders",
  );

  return (
    <>
      <div>
        <div className="eyebrow">Sourcing</div>
        <h1 className="section">Purchase <em>orders</em></h1>
        <p className="lead">Supplier restock — spawn, grain, substrate, and lab supplies.</p>
      </div>

      {pos.length === 0 ? (
        <Card variant="quiet">
          <p className="muted" style={{ margin: 0 }}>No purchase orders recorded.</p>
        </Card>
      ) : (
        pos.map((p) => (
          <Card key={p.id} title={`${p.reference || "PO"} · ${p.vendors?.name ?? ""}`}>
            <div
              style={{
                display: "flex",
                gap: 14,
                marginBottom: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <Badge tone={p.status === "received" ? "green" : "amber"}>{p.status}</Badge>
              <span className="muted">
                Ordered {p.ordered_at || "—"} · Expected {p.expected_at || "—"}
              </span>
              <span className="muted">Total {money(p.total)}</span>
            </div>
            <table>
              <caption className="sr-only">Purchase order items</caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" className="right">Qty</th>
                  <th scope="col" className="right">Received</th>
                  <th scope="col" className="right">Unit cost</th>
                </tr>
              </thead>
              <tbody>
                {(p.purchase_order_items ?? []).map((it) => (
                  <tr key={it.id ?? it.name}>
                    <td>{it.name}</td>
                    <td className="right">{it.quantity}</td>
                    <td className="right">{it.received_quantity}</td>
                    <td className="right">{money(it.unit_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))
      )}
    </>
  );
}
