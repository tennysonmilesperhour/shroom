import Link from "next/link";
import { createServiceClient } from "@/utils/supabase/service";
import { Kpi, Card, Badge } from "@/components/ui";
import CountUp from "@/components/anim/CountUp";
import RadialGauge from "@/components/anim/RadialGauge";
import Meter from "@/components/anim/Meter";
import QuickLog, { type QuickLogBatch } from "@/components/QuickLog";
import { currentCollection } from "@/lib/collection";
import { weeklyTotals } from "@/lib/weekly-totals";
import RoutinePlanner, { type Routine } from "@/components/RoutinePlanner";
import OperationPulse from "@/components/OperationPulse";
import { kgToG, money, DRY_FLOOR } from "@/lib/format";
import { must, soft } from "@/lib/query";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

interface BatchRow {
  id: number;
  created_at: string;
  stage: string;
  block_count: number | null;
  strains: { mushroom_type: string } | null;
}
interface DryRatioRow {
  harvested_on: string;
  strain_id: number | null;
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
  batch_id: number | null;
  created_at: string;
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
interface SpotlightHarvest {
  harvest_id: number;
  batch_id: number;
  lot_code: string | null;
  harvested_on: string;
  flush_number: number;
  strain_id: number | null;
  strain: string | null;
  fresh_g: number | null;
  dry_g: number | null;
  dry_ratio_pct: number | null;
  below_floor: boolean | null;
}

interface ActiveBatchPick {
  id: number;
  lot_code: string;
  stage: string;
  strains: { name: string } | null;
}

const ACTIVE_STAGES = new Set(["colonization", "spawn_to_bulk", "fruiting", "harvesting"]);
const RETIRED_STAGES = new Set(["spent", "contaminated"]);

export default async function Dashboard() {
  const cookieStore = await cookies();
  const rawMode = cookieStore.get("shroom-mushroom-mode")?.value;
  const mode = rawMode === "functional" || rawMode === "function" ? "functional" : "magic";
  const includedTypes = mode === "functional"
    ? new Set(["functional", "gourmet"])
    : new Set(["psychedelic"]);
  const isFunctional = mode === "functional";
  const supabase = createServiceClient();
  const collection = await currentCollection();
  const [allBatches, allDry, env, allYields, allTasks, inv, valuation, allSpotlights, strainTypes] = await Promise.all([
    must<BatchRow[]>(supabase.from("batches").select("id,created_at,stage,block_count,strains(mushroom_type)"), "load batches"),
    must<DryRatioRow[]>(supabase.from("v_dry_ratio").select("harvested_on,strain_id,fresh_g,dry_g,below_floor"), "load dry ratios"),
    must<EnvStatusRow[]>(supabase.from("v_environment_status").select("room_id,room,in_spec"), "load environment status"),
    must<YieldRow[]>(
      supabase
        .from("v_yield_by_strain")
        .select("strain_id,strain,batches,fresh_kg,biological_efficiency_pct")
        .order("fresh_kg", { ascending: false }),
      "load yield by strain",
    ),
    must<TaskRow[]>(supabase.from("tasks").select("status,batch_id,created_at"), "load tasks"),
    must<InventoryRow[]>(
      supabase.from("inventory_items").select("name,quantity_on_hand,reorder_threshold"),
      "load inventory",
    ),
    must<ValuationRow[]>(
      supabase.from("v_inventory_valuation").select("distributor_low,distributor_high"),
      "load valuation",
    ),
    must<SpotlightHarvest[]>(
      supabase
        .from("v_dry_ratio")
        .select(
          "harvest_id,batch_id,lot_code,harvested_on,flush_number,strain_id,strain,fresh_g,dry_g,dry_ratio_pct,below_floor",
        )
        .in("strain_id", collection.strainIds)
        .order("harvested_on", { ascending: false })
        .limit(20),
      "load spotlight harvests",
    ),
    must<{ id: number; mushroom_type: string }[]>(
      supabase.from("strains").select("id,mushroom_type"),
      "load strain types",
    ),
  ]);

  const typeByStrain = new Map(strainTypes.map((s) => [s.id, s.mushroom_type]));
  const batches = allBatches.filter((b) => b.strains && includedTypes.has(b.strains.mushroom_type));
  const dry = allDry.filter((r) => r.strain_id != null && includedTypes.has(typeByStrain.get(r.strain_id) ?? ""));
  const yields = allYields.filter((y) => includedTypes.has(typeByStrain.get(y.strain_id) ?? ""));
  const spotlight = allSpotlights.find(
    (h) => h.strain_id != null && includedTypes.has(typeByStrain.get(h.strain_id) ?? ""),
  ) ?? null;
  const active = batches.filter((b) => ACTIVE_STAGES.has(b.stage)).length;
  const blocks = batches
    .filter((b) => !RETIRED_STAGES.has(b.stage))
    .reduce((s, b) => s + (b.block_count ?? 0), 0);
  const freshG = dry.reduce((s, r) => s + (r.fresh_g ?? 0), 0);
  const dryG = dry.reduce((s, r) => s + (r.dry_g ?? 0), 0);
  const overallRatio = freshG > 0 ? Math.round((dryG / freshG) * 1000) / 10 : 0;
  const flagged = dry.filter((r) => r.below_floor).length;
  const batchIds = new Set(batches.map((batch) => batch.id));
  const tasks = allTasks.filter((task) => task.batch_id == null || batchIds.has(task.batch_id));
  const openTasks = tasks.filter((t) => t.status !== "done").length;
  const lowStock = inv.filter((i) => i.quantity_on_hand <= i.reorder_threshold);
  const alerts = env.filter((e) => e.in_spec === false);
  const invLow = valuation.reduce((s, r) => s + (r.distributor_low ?? 0), 0);
  const invHigh = valuation.reduce((s, r) => s + (r.distributor_high ?? 0), 0);

  const [routineRows, batchPickRes] = await Promise.all([
    // soft() so a not-yet-applied routines migration degrades to an empty
    // command center rather than breaking the dashboard.
    soft<Routine>(
      supabase
        .from("routines")
        .select("id,kind,title,cadence,href,notes,last_done_at")
        .eq("active", true)
        .order("kind")
        .order("sort_order")
        .order("created_at"),
    ),
    // batches always exists; embedded strains is typed as an array by supabase-js
    // (same as loadCommandIndex in the layout), so we cast the row shape.
    supabase
      .from("batches")
      .select("id,lot_code,stage,strains(name)")
      .in("strain_id", collection.strainIds)
      .order("created_at", { ascending: false }),
  ]);

  const now = new Date();
  const freshSeries = weeklyTotals(dry.map((row) => ({ date: row.harvested_on, amount: row.fresh_g })), now);
  const drySeries = weeklyTotals(dry.map((row) => ({ date: row.harvested_on, amount: row.dry_g })), now);
  const ratioSeries = freshSeries.map((fresh, index) => fresh > 0 ? drySeries[index] / fresh * 100 : 0);
  const startedSeries = weeklyTotals(batches.map((row) => ({ date: row.created_at, amount: 1 })), now);
  const tasksSeries = weeklyTotals(tasks.map((row) => ({ date: row.created_at, amount: 1 })), now);

  const activeBatches: QuickLogBatch[] = ((batchPickRes.data as ActiveBatchPick[] | null) ?? [])
    .filter((b) => ACTIVE_STAGES.has(b.stage))
    .slice(0, 60)
    .map((b) => ({ id: b.id, lot_code: b.lot_code, stage: b.stage, strain: b.strains?.name ?? null }));

  // Live vitals for the reactive ambient background (#4).
  const vitals = {
    activeBatches: active,
    blocks,
    alerts: alerts.length,
    lastHarvestOn: spotlight?.harvested_on ?? null,
  };

  return (
    <>
      <OperationPulse vitals={vitals} />

      <div>
        <div className="eyebrow">{isFunctional ? "Functional & culinary" : "Magic collection"}</div>
        <h1 className="section">
          {isFunctional ? "From fruiting room to kitchen shelf" : "Today’s state of the mycelium"}
        </h1>
        <p className="lead mode-intro">
          {isFunctional
            ? "Production health for functional extracts, fresh culinary harvests, and the cultures behind them."
            : "Cultivation signals, harvest potency, and the living library behind the magic collection."}
        </p>
      </div>

      <RoutinePlanner routines={routineRows as Routine[]} />

      {spotlight && (
        <section className="spotlight has-gauge" aria-labelledby="spotlight-title">
          <div className="spotlight-main">
            <div className="eyebrow">{isFunctional ? "Fresh from the fruiting room" : "Latest magic harvest"}</div>
            <h3 id="spotlight-title">
              {spotlight.strain_id ? (
                <Link href={`/strains/${spotlight.strain_id}`} className="row-anchor">
                  {spotlight.strain ?? "Unknown strain"}
                </Link>
              ) : (
                spotlight.strain ?? "Unknown strain"
              )}{" "}
              <span className="muted">· F{spotlight.flush_number}</span>
            </h3>
            <p className="lead">
              Lot{" "}
              {spotlight.batch_id ? (
                <Link href={`/batches/${spotlight.batch_id}`} className="row-anchor">
                  {spotlight.lot_code ?? "-"}
                </Link>
              ) : (
                spotlight.lot_code ?? "-"
              )}{" "}
              pulled on {spotlight.harvested_on}.
              {spotlight.below_floor && (
                <>
                  {" "}<Badge tone="red">below {DRY_FLOOR}% dry floor</Badge>
                </>
              )}
            </p>
            <div className="spotlight-meta">
              <div className="spotlight-stat">
                <div className="label">Fresh</div>
                <div className="value"><CountUp value={spotlight.fresh_g ?? 0} /><span className="muted" style={{ fontSize: "0.6em", marginLeft: 4 }}>g</span></div>
              </div>
              <div className="spotlight-stat">
                <div className="label">Dry</div>
                <div className="value"><CountUp value={spotlight.dry_g ?? 0} /><span className="muted" style={{ fontSize: "0.6em", marginLeft: 4 }}>g</span></div>
              </div>
              <div className="spotlight-stat">
                <div className="label">Ratio</div>
                <div className="value"><CountUp value={spotlight.dry_ratio_pct ?? 0} decimals={1} /><span className="muted" style={{ fontSize: "0.6em", marginLeft: 4 }}>%</span></div>
              </div>
            </div>
          </div>
          <RadialGauge
            value={Math.min(1, (spotlight.dry_ratio_pct ?? 0) / 12)}
            tone={spotlight.below_floor ? "ember" : "lumen"}
            centerValue={<><CountUp value={spotlight.dry_ratio_pct ?? 0} decimals={1} />%</>}
            centerLabel={isFunctional ? "conversion" : "dry yield"}
            ariaLabel={`Dry ratio ${spotlight.dry_ratio_pct ?? 0} percent`}
          />
        </section>
      )}

      <div className="kpi-row">
        <Kpi label={isFunctional ? "Active grows" : "Active batches"} countTo={active} series={startedSeries} feature tilt />
        <Kpi label={isFunctional ? "Fruiting blocks" : "Blocks in production"} countTo={blocks} tilt />
        <Kpi label={isFunctional ? "Fresh crop" : "Harvested (fresh)"} countTo={freshG} unit="g" series={freshSeries} tilt />
        <Kpi label={isFunctional ? "Dry conversion" : "Overall dry ratio"} countTo={overallRatio} decimals={1} unit="%" series={ratioSeries} tilt />
      </div>

      <div className="grid kpis" style={{ marginTop: "var(--space-3)" }}>
        {isFunctional ? (
          <Kpi label="Cultivars in rotation" countTo={yields.filter((y) => y.batches > 0).length} tilt />
        ) : (
          <Kpi label="Dried on-hand (distrib.)" value={`${money(invLow)}–${money(invHigh)}`} tilt />
        )}
        <Kpi label="Open tasks" countTo={openTasks} series={tasksSeries} tilt href="/tasks" />
      </div>

      <Card title="Quick log" className="quicklog-card">
        <QuickLog batches={activeBatches} />
      </Card>

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
        <Card title={isFunctional ? "Crop watch" : "Attention"}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
            <span>{isFunctional ? "Lots below target conversion" : `Harvests below ${DRY_FLOOR}% dry floor`}</span>
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

      <Card title={isFunctional ? "Yield by cultivar" : "Yield by strain"}>
        <table>
          <caption className="sr-only">Yield by {isFunctional ? "cultivar" : "strain"}</caption>
          <thead>
            <tr>
              <th scope="col">{isFunctional ? "Cultivar" : "Strain"}</th>
              <th scope="col">Batches</th>
              <th scope="col" className="right">Fresh (g)</th>
              <th scope="col" className="right">Bio-efficiency</th>
            </tr>
          </thead>
          <tbody>
            {yields.filter((y) => y.batches > 0).map((y) => (
              <tr key={y.strain_id} className="row-link">
                <td>
                  <Link href={`/strains/${y.strain_id}`} className="row-anchor">
                    <b>{y.strain}</b>
                  </Link>
                </td>
                <td>{y.batches}</td>
                <td className="right">{kgToG(y.fresh_kg ?? 0)}</td>
                <td className="right">
                  {y.biological_efficiency_pct == null ? (
                    "-"
                  ) : (
                    <span className="be-cell">
                      <Meter
                        value={Math.min(1, y.biological_efficiency_pct / 100)}
                        ariaLabel={`Bio-efficiency ${y.biological_efficiency_pct} percent`}
                      />
                      <span className="be-num">{y.biological_efficiency_pct}%</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
