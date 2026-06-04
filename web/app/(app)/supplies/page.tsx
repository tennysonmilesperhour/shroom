import { createServiceClient } from "@/utils/supabase/service";
import { Badge, Card } from "@/components/ui";
import { must } from "@/lib/query";

export const dynamic = "force-dynamic";

interface InventoryItem {
  id: number;
  name: string;
  category: string;
  unit: string;
  quantity_on_hand: number;
  reorder_threshold: number;
  supplier: string | null;
}

interface EquipmentRow {
  id: number;
  name: string;
  spec_notes: string | null;
  status: string;
  last_checked: string | null;
}

export default async function SuppliesPage() {
  const supabase = createServiceClient();
  const [items, equipment] = await Promise.all([
    must<InventoryItem[]>(
      supabase.from("inventory_items").select("*").order("category").order("name"),
      "load inventory",
    ),
    must<EquipmentRow[]>(
      supabase.from("equipment").select("*").order("name"),
      "load equipment",
    ),
  ]);

  const isLow = (i: InventoryItem) => i.quantity_on_hand <= i.reorder_threshold;
  const lowCount = items.filter(isLow).length;

  return (
    <>
      <div>
        <div className="eyebrow">Sourcing</div>
        <h1 className="section">Supplies &amp; equipment</h1>
        <p className="lead">
          Consumable stock with reorder thresholds, plus the grow-room equipment register.
          {lowCount > 0 && (
            <>
              {" "}
              <span style={{ color: "var(--ember)" }}>
                {lowCount} item{lowCount === 1 ? "" : "s"} need reorder.
              </span>
            </>
          )}
        </p>
      </div>

      <Card title="Consumables">
        {items.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No inventory tracked.</p>
        ) : (
          <table>
            <caption className="sr-only">Consumable inventory</caption>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Category</th>
                <th scope="col" className="right">On hand</th>
                <th scope="col" className="right">Reorder at</th>
                <th scope="col">Status</th>
                <th scope="col">Supplier</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className={isLow(i) ? "flag-low" : ""}>
                  <td><b>{i.name}</b></td>
                  <td className="muted">{i.category}</td>
                  <td className="right">
                    {i.quantity_on_hand} {i.unit}
                  </td>
                  <td className="right">{i.reorder_threshold}</td>
                  <td>
                    {isLow(i) ? (
                      <Badge tone="red">reorder</Badge>
                    ) : (
                      <Badge tone="green">ok</Badge>
                    )}
                  </td>
                  <td className="muted">{i.supplier || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Equipment">
        {equipment.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No equipment registered.</p>
        ) : (
          <table>
            <caption className="sr-only">Equipment register</caption>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Spec / notes</th>
                <th scope="col">Status</th>
                <th scope="col">Checked</th>
              </tr>
            </thead>
            <tbody>
              {equipment.map((e) => (
                <tr key={e.id}>
                  <td><b>{e.name}</b></td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {e.spec_notes ?? "-"}
                  </td>
                  <td>
                    <Badge tone={e.status === "active" ? "green" : "amber"}>{e.status}</Badge>
                  </td>
                  <td className="muted">{e.last_checked || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
