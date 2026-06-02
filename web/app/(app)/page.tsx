import { createClient } from "@/utils/supabase/server";
import { Kpi, Card, Badge } from "@/components/ui";
import { kgToG, money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = await createClient();
  const [batches, dry, env, yields, tasks, inv, valuation] = await Promise.all([
    supabase.from("batches").select("stage,block_count"),
    supabase.from("v_dry_ratio").select("*"),
    supabase.from("v_environment_status").select("*"),
    supabase.from("v_yield_by_strain").select("*").order("fresh_kg", { ascending: false }),
    supabase.from("tasks").select("status"),
    supabase.from("inventory_items").select("name,quantity_on_hand,reorder_threshold"),
    supabase.from("v_inventory_valuation").select("distributor_low,distributor_high"),
  ]);

  const active = (batches.data ?? []).filter((b) =>
    ["colonization", "spawn_to_bulk", "fruiting", "harvesting"].includes(b.stage),
  ).length;
  const blocks = (batches.data ?? [])
    .filter((b) => b.stage !== "spent" && b.stage !== "contaminated")
    .reduce((s, b) => s + (b.block_count ?? 0), 0);
  const freshG = (dry.data ?? []).reduce((s, r) => s + (r.fresh_g ?? 0), 0);
  const dryG = (dry.data ?? []).reduce((s, r) => s + (r.dry_g ?? 0), 0);
  const overallRatio = freshG > 0 ? Math.round((dryG / freshG) * 1000) / 10 : 0;
  const flagged = (dry.data ?? []).filter((r) => r.below_floor).length;
  const openTasks = (tasks.data ?? []).filter((t) => t.status !== "done").length;
  const lowStock = (inv.data ?? []).filter((i) => i.quantity_on_hand <= i.reorder_threshold);
  const alerts = (env.data ?? []).filter((e) => e.in_spec === false);
  const invLow = (valuation.data ?? []).reduce((s, r) => s + (r.distributor_low ?? 0), 0);
  const invHigh = (valuation.data ?? []).reduce((s, r) => s + (r.distributor_high ?? 0), 0);

  return (
    <>
      <div>
        <div className="eyebrow">Operation</div>
        <h2 className="section">Today&rsquo;s <em>state of the mycelium</em></h2>
        <p className="lead">A live, persisted single source of truth — from spawn point to shelf.</p>
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
              <div key={a.room_id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <b>{a.room}</b>
                <Badge tone="red">out of spec</Badge>
              </div>
            ))
          )}
        </Card>
        <Card title="Attention">
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
            <span>Harvests below {7.5}% dry floor</span>
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
          <thead>
            <tr><th>Strain</th><th>Batches</th><th className="right">Fresh (g)</th><th className="right">Bio-efficiency</th></tr>
          </thead>
          <tbody>
            {(yields.data ?? []).filter((y) => y.batches > 0).map((y) => (
              <tr key={y.strain_id}>
                <td>{y.strain}</td>
                <td>{y.batches}</td>
                <td className="right">{kgToG(y.fresh_kg)}</td>
                <td className="right">{y.biological_efficiency_pct ?? "—"}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
