import { createServiceClient } from "@/utils/supabase/service";
import { Badge, Card } from "@/components/ui";
import { must } from "@/lib/query";
import AddPanel from "@/components/AddPanel";
import AddPresetForm from "./AddPresetForm";
import DeletePresetButton from "./DeletePresetButton";

export const dynamic = "force-dynamic";

interface PresetMaterial {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  inventory_items: { name: string } | null;
}

interface PresetRow {
  id: number;
  name: string;
  container_type: string;
  tub_size: string | null;
  spawn_type: string | null;
  substrate_type: string | null;
  bag_type: string | null;
  block_count: number;
  substrate_weight_kg: number;
  spawn_weight_kg: number;
  notes: string | null;
  strains: { name: string } | null;
  recipes: { name: string } | null;
  rooms: { name: string } | null;
  preset_materials: PresetMaterial[];
}

interface Option {
  id: number;
  name: string;
}
interface InventoryItemRow {
  id: number;
  name: string;
  unit: string;
}

export default async function PresetsPage() {
  const supabase = createServiceClient();
  const [presets, strains, recipes, rooms, items] = await Promise.all([
    must<PresetRow[]>(
      supabase
        .from("batch_presets")
        .select(
          "*, strains(name), recipes(name), rooms(name), preset_materials(id,name,quantity,unit, inventory_items(name))",
        )
        .eq("active", true)
        .order("name"),
      "load presets",
    ),
    must<Option[]>(supabase.from("strains").select("id,name").order("name"), "load strains"),
    must<Option[]>(supabase.from("recipes").select("id,name").order("name"), "load recipes"),
    must<Option[]>(supabase.from("rooms").select("id,name").order("name"), "load rooms"),
    must<InventoryItemRow[]>(
      supabase.from("inventory_items").select("id,name,unit").order("name"),
      "load inventory",
    ),
  ]);

  return (
    <>
      <div>
        <div className="eyebrow">Production</div>
        <h1 className="section">Tub presets</h1>
        <p className="lead">
          Build a preset per mushroom type once — spores, substrate, tub size, spawn,
          bags and the materials each tub uses. Starting a new batch then prefills every
          field and can draw the materials straight out of inventory.
        </p>
      </div>

      <AddPanel label="New preset" buttonLabel="Build a preset">
        <AddPresetForm strains={strains} recipes={recipes} rooms={rooms} items={items} />
      </AddPanel>

      {presets.length === 0 ? (
        <Card title="No presets yet">
          <p className="muted" style={{ margin: 0 }}>
            Build your first preset above. Once saved, it appears in the &ldquo;Start from
            preset&rdquo; picker when you inoculate a new batch.
          </p>
        </Card>
      ) : (
        presets.map((p) => (
          <Card key={p.id} title={p.name}>
            <div className="hero-meta" style={{ marginBottom: "var(--space-3)" }}>
              <Badge tone="muted">{p.container_type}</Badge>
              {p.tub_size && <Badge tone="muted">{p.tub_size}</Badge>}
              {p.strains && <Badge tone="green">{p.strains.name}</Badge>}
              {p.recipes && <Badge tone="amber">{p.recipes.name}</Badge>}
              {p.rooms && <Badge tone="muted">{p.rooms.name}</Badge>}
            </div>

            <dl className="kv kv-3">
              <dt>Spawn</dt>
              <dd>
                {p.spawn_type || "—"}
                {p.spawn_weight_kg ? ` · ${p.spawn_weight_kg} kg` : ""}
              </dd>
              <dt>Substrate</dt>
              <dd>
                {p.substrate_type || "—"}
                {p.substrate_weight_kg ? ` · ${p.substrate_weight_kg} kg` : ""}
              </dd>
              <dt>Bag</dt>
              <dd>{p.bag_type || "—"}</dd>
              <dt>Units</dt>
              <dd>{p.block_count || "—"}</dd>
            </dl>

            {p.preset_materials.length > 0 && (
              <table style={{ marginTop: "var(--space-3)" }}>
                <caption className="sr-only">Materials for {p.name}</caption>
                <thead>
                  <tr>
                    <th scope="col">Material</th>
                    <th scope="col" className="right">
                      Qty / tub
                    </th>
                    <th scope="col">Tracked</th>
                  </tr>
                </thead>
                <tbody>
                  {p.preset_materials.map((m) => (
                    <tr key={m.id}>
                      <td>{m.inventory_items?.name || m.name || "—"}</td>
                      <td className="right">
                        {m.quantity} {m.unit}
                      </td>
                      <td>
                        {m.inventory_items ? (
                          <Badge tone="green">inventory</Badge>
                        ) : (
                          <Badge tone="muted">manual</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {p.notes && (
              <p className="muted" style={{ whiteSpace: "pre-wrap", marginTop: "var(--space-3)" }}>
                {p.notes}
              </p>
            )}

            <div style={{ marginTop: "var(--space-3)" }}>
              <DeletePresetButton presetId={p.id} name={p.name} />
            </div>
          </Card>
        ))
      )}
    </>
  );
}
