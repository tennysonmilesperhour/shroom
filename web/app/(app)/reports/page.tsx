import { createClient } from "@/utils/supabase/server";
import { Kpi, Card } from "@/components/ui";
import { kgToG, money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = await createClient();
  const [yields, scoreboard, dry, circ, kpis, best, ltv] = await Promise.all([
    supabase.from("v_yield_by_strain").select("*").order("fresh_kg", { ascending: false }),
    supabase.from("v_strain_scoreboard").select("*"),
    supabase.from("v_dry_ratio").select("*"),
    supabase.from("v_circular_economy").select("*").single(),
    supabase.from("v_commerce_kpis").select("*").single(),
    supabase.from("v_best_sellers").select("*").limit(6),
    supabase.from("v_customer_ltv").select("*").gt("lifetime_value", 0).limit(8),
  ]);

  const dr = dry.data ?? [];
  const fresh = dr.reduce((s, r) => s + (r.fresh_g ?? 0), 0);
  const dryG = dr.reduce((s, r) => s + (r.dry_g ?? 0), 0);
  const overall = fresh > 0 ? Math.round((dryG / fresh) * 1000) / 10 : 0;
  const k = kpis.data ?? { gross_sales: 0, avg_order_value: 0, orders: 0 };
  const c = circ.data ?? { spent_substrate_kg: 0, estimated_co2e_diverted_kg: 0 };

  return (
    <>
      <h2 className="section">Reports & Intelligence</h2>
      <p className="lead">Production, quality, sales, and sustainability analytics in one place.</p>

      <div className="grid kpis">
        <Kpi label="Fresh harvested" value={Math.round(fresh)} unit="g" />
        <Kpi label="Overall dry ratio" value={overall} unit="%" />
        <Kpi label="Gross sales" value={money(k.gross_sales)} />
        <Kpi label="Avg order value" value={money(k.avg_order_value)} />
        <Kpi label="Spent substrate" value={c.spent_substrate_kg} unit="kg" />
      </div>

      <div className="grid two">
        <Card title="Yield by strain">
          <table>
            <thead><tr><th>Strain</th><th className="right">Batches</th><th className="right">Fresh (g)</th><th className="right">Bio-eff.</th></tr></thead>
            <tbody>{(yields.data ?? []).filter((y) => y.batches > 0).map((y) => (
              <tr key={y.strain_id}><td>{y.strain}</td><td className="right">{y.batches}</td><td className="right">{kgToG(y.fresh_kg)}</td><td className="right">{y.biological_efficiency_pct ?? "—"}%</td></tr>
            ))}</tbody>
          </table>
        </Card>
        <Card title="Strain scoreboard (portfolio optimizer)">
          <table>
            <thead><tr><th>Strain</th><th className="right">BE%</th><th className="right">Dry%</th><th className="right">Ease</th></tr></thead>
            <tbody>{(scoreboard.data ?? []).filter((s) => s.fresh_kg > 0).map((s) => (
              <tr key={s.id}><td>{s.name}</td><td className="right">{s.biological_efficiency_pct ?? "—"}</td><td className="right">{s.avg_dry_ratio ?? "—"}</td><td className="right">{s.ease_rating ?? "—"}/10</td></tr>
            ))}</tbody>
          </table>
        </Card>
      </div>

      <div className="grid two">
        <Card title="Best sellers">
          {(best.data ?? []).every((b) => b.units === 0) ? <div className="muted">No sales recorded yet.</div> : (
            <table>
              <thead><tr><th>Product</th><th className="right">Units</th><th className="right">Revenue</th></tr></thead>
              <tbody>{(best.data ?? []).map((b) => (
                <tr key={b.product_id}><td>{b.name}</td><td className="right">{b.units}</td><td className="right">{money(b.revenue)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>
        <Card title="Customer lifetime value">
          {(ltv.data ?? []).length === 0 ? <div className="muted">No sales recorded yet.</div> : (
            <table>
              <thead><tr><th>Customer</th><th className="right">Orders</th><th className="right">LTV</th></tr></thead>
              <tbody>{(ltv.data ?? []).map((c2) => (
                <tr key={c2.id}><td>{c2.name}</td><td className="right">{c2.orders}</td><td className="right">{money(c2.lifetime_value)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
