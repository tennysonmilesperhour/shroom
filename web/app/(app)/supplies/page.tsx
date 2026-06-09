import { createServiceClient } from "@/utils/supabase/service";
import { Badge, Card } from "@/components/ui";
import { must } from "@/lib/query";
import AddPanel from "@/components/AddPanel";
import RowActions from "@/components/RowActions";
import AddSupplyForm from "./AddSupplyForm";
import AddEquipmentForm from "./AddEquipmentForm";
import QuickAdjust from "./QuickAdjust";

export const dynamic = "force-dynamic";

interface InventoryItem {
  id: number;
  name: string;
  category: string;
  unit: string;
  quantity_on_hand: number;
  reorder_threshold: number;
  unit_cost: number | null;
  supplier: string | null;
  location: string | null;
}

interface EquipmentRow {
  id: number;
  name: string;
  spec_notes: string | null;
  status: string;
  room_id: number | null;
  last_checked: string | null;
}

interface RoomOpt {
  id: number;
  name: string;
}

export default async function SuppliesPage() {
  const supabase = createServiceClient();
  const [items, equipment, rooms] = await Promise.all([
    must<InventoryItem[]>(
      supabase.from("inventory_items").select("*").order("category").order("name"),
      "load inventory",
    ),
    must<EquipmentRow[]>(
      supabase.from("equipment").select("*").order("name"),
      "load equipment",
    ),
    must<RoomOpt[]>(
      supabase.from("rooms").select("id,name").order("name"),
      "load rooms",
    ),
  ]);

  const roomOptions = rooms.map((r) => ({ value: String(r.id), label: r.name }));

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

      <AddPanel label="New supply">
        <AddSupplyForm />
      </AddPanel>

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
                <th scope="col" className="actions-col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className={isLow(i) ? "flag-low" : ""}>
                  <td><b>{i.name}</b></td>
                  <td className="muted">{i.category}</td>
                  <td className="right">
                    {i.quantity_on_hand} {i.unit}
                    <QuickAdjust itemId={i.id} />
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
                  <td className="actions-col">
                    <RowActions
                      entity="supply"
                      id={i.id}
                      label={i.name}
                      initial={{
                        name: i.name,
                        category: i.category,
                        unit: i.unit,
                        quantity_on_hand: i.quantity_on_hand,
                        reorder_threshold: i.reorder_threshold,
                        unit_cost: i.unit_cost,
                        supplier: i.supplier,
                        location: i.location,
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <AddPanel label="New equipment" buttonLabel="Add equipment">
        <AddEquipmentForm />
      </AddPanel>

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
                <th scope="col" className="actions-col"><span className="sr-only">Actions</span></th>
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
                  <td className="actions-col">
                    <RowActions
                      entity="equipment"
                      id={e.id}
                      label={e.name}
                      initial={{
                        name: e.name,
                        status: e.status,
                        room_id: e.room_id,
                        last_checked: e.last_checked,
                        spec_notes: e.spec_notes,
                      }}
                      options={{ room_id: roomOptions }}
                    />
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
