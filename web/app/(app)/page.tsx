import { createServiceClient } from "@/utils/supabase/service";
import { Kpi, Card, Badge } from "@/components/ui";
import { kgToG, money, DRY_FLOOR } from "@/lib/format";
import { must } from "@/lib/query";

export const dynamic = "force-dynamic";

interface BatchRow {
  stage: string;
  block_count: number | null;
}
interface DryRatioRow {
  fresh_g: number | null;
  dry_g: number | null;
  below_floor: boolean | null;
}
interface EnvStatusRow {
  room_id: number;
  room: string;
  in_spec: boolean | null;
}
interface YieldRow {
  strain_id: number;
  strain: string;
  batches: number;
  fresh_kg: number | null;
  biological_efficiency_pct: number | null;
}
interface TaskRow {
  status: string;
}
interface InventoryRow {
  name: string;
  quantity_on_hand: number;
  reorder_threshold: number;
}
interface ValuationRow {
  distributor_low: number | null;
  distributor_high: number | null;
}

const ACTIVE_STAGES = new Set(["colonization", "spawn_to_bulk", "fruiting", "harvesting"]);
const RETIRED_STAGES = new Set(["spent", "contaminated"]);

export default async function Dashboard() {
  const supabase = createServiceClient();
  const [batches, dry, env, yields, tasks, inv, valuation] = await Promise.all([
    must<BatchRow[]>(supabase.from("batches").select("stage,block_count"), "load batches"),
    must<DryRatioRow[]>(supabase.from("v_dry_ratio").select("fresh_g,dry_g,below_floor"), "load dry ratios"),
    must<EnvStatusRow[]>(supabase.from("v_environment_status").select("room_id,room,in_spec"), "load environment status"),
    must<YieldRow[]>(
      supabase
        .from("v_yield_by_strain")
        .select("strain_id,strain,batches,fresh_kg,biological_efficiency_pct")
        .order("fresh_kg", { ascending: false }),
      "load yield by strain",
    ),
    must<TaskRow[]>(supabase.from("tasks").select("status"), "load tasks"),
    must<InventoryRow[]>(
      supabase.from("inventory_items").select("name,quantity_on_hand,reorder_threshold"),
      "load inventory",
    ),
    must<ValuationRow[]>(
      supabase.from("v_inventory_valuation").select("distributor_low,distributor_high"),
      "load valuation",
    ),
  ]);

  const active = batches.filter((b) => ACTIVE_STAGES.has(b.stage)).length;
  const blocks = batches
    .filter((b) => !RETIRED_STAGES.has(b.stage))
    .reduce((s, b) => s + (b.block_count ?? 0), 0);
  const freshG = dry.reduce((s, r) => s + (r.fresh_g ?? 0), 0);
  const dryG = dry.reduce((s, r) => s + (r.dry_g ?? 0), 0);
  const overallRatio = freshG > 0 ? Math.round((dryG / freshG) * 1000) / 10 : 0;
  const flagged = dry.filter((r) => r.below_floor).length;
  const openTasks = tasks.filter((t) => t.status !== "done").length;
  const lowStock = inv.filter((i) => i.quantity_on_hand <= i.reorder_threshold);
  const alerts = env.filter((e) => e.in_spec === false);
  const invLow = valuation.reduce((s, r) => s + (r.distributor_low ?? 0), 0);
  const invHigh = valuation.reduce((s, r) => s + (r.distributor_high ?? 0), 0);

  return (
    <>
      <div>
        <div className="eyebrow">Operation</div>
        <h1 className="section">Today&rsquo;s state of the mycelium</h1>
        <p className="lead">A live, persisted single source of truth, from spawn point to shelf.</p>
      </div>

      <div className="kpi-row">
        <Kpi label="Active batches" value={active} feature />
        <Kpi label="Blocks in production" value={blocks} />
        <Kpi label="Harvested (fresh)" value={freshG} unit="g" />
        <Kpi label="Overall dry ratio" value={overallRatio} unit="%" />
      </div>

      <div className="grid kpis" style={{ marginTop: "var(--space-3)" }}>
        <Kpi label="Dried on-hand (distrib.)" value={`${money(invLow)}–${money(invHigh)}`} />
        <Kpi label="Open tasks" value={openTasks} />
      </div>

      <div className="grid two" style={{ marginTop: 6 }}>
        <Card title="Environment alerts">
          {alerts.length === 0 ? (
            <div className="muted">All rooms in spec ✓</div>
          ) : (
            alerts.map((a) => (
              <div
                key={a.room_id}
                style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}
              >
                <b>{a.room}</b>
                <Badge tone="red">out of spec</Badge>
              </div>
            ))
          )}
        </Card>
        <Card title="Attention">
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
            <span>Harvests below {DRY_FLOOR}% dry floor</span>
            <Badge tone={flagged ? "amber" : "green"}>{flagged}</Badge>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
            <span>Low-stock items</span>
            <Badge tone={lowStock.length ? "red" : "green"}>{lowStock.length}</Badge>
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            {lowStock.map((i) => i.name).join(", ") || "Inventory healthy"}
          </div>
        </Card>
      </div>

      <Card title="Yield by strain">
        <table>
          <caption className="sr-only">Yield by strain</caption>
          <thead>
            <tr>
              <th scope="col">Strain</th>
              <th scope="col">Batches</th>
              <th scope="col" className="right">Fresh (g)</th>
              <th scope="col" className="right">Bio-efficiency</th>
            </tr>
          </thead>
          <tbody>
            {yields.filter((y) => y.batches > 0).map((y) => (
              <tr key={y.strain_id}>
                <td>{y.strain}</td>
                <td>{y.batches}</td>
                <td className="right">{kgToG(y.fresh_kg ?? 0)}</td>
                <td className="right">{y.biological_efficiency_pct ?? "-"}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
