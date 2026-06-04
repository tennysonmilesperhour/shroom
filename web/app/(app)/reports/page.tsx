import { createServiceClient } from "@/utils/supabase/service";
import { Kpi, Card } from "@/components/ui";
import { kgToG, money } from "@/lib/format";
import { must, maybe } from "@/lib/query";

export const dynamic = "force-dynamic";

interface YieldRow {
  strain_id: number;
  strain: string;
  batches: number;
  fresh_kg: number | null;
  biological_efficiency_pct: number | null;
}
interface ScoreboardRow {
  id: number;
  name: string;
  ease_rating: number | null;
  fresh_kg: number | null;
  biological_efficiency_pct: number | null;
  avg_dry_ratio: number | null;
}
interface DryRow {
  fresh_g: number | null;
  dry_g: number | null;
}
interface CircularRow {
  spent_substrate_kg: number;
  estimated_co2e_diverted_kg: number;
}
interface CommerceKpiRow {
  gross_sales: number | null;
  avg_order_value: number | null;
  orders: number | null;
}
interface BestSellerRow {
  product_id: number;
  name: string;
  units: number;
  revenue: number;
}
interface LtvRow {
  id: number;
  name: string;
  orders: number;
  lifetime_value: number;
}

export default async function ReportsPage() {
  const supabase = createServiceClient();
  const [yields, scoreboard, dry, circ, kpis, best, ltv] = await Promise.all([
    must<YieldRow[]>(
      supabase
        .from("v_yield_by_strain")
        .select("*")
        .order("fresh_kg", { ascending: false }),
      "load yield by strain",
    ),
    must<ScoreboardRow[]>(supabase.from("v_strain_scoreboard").select("*"), "load scoreboard"),
    must<DryRow[]>(supabase.from("v_dry_ratio").select("*"), "load dry ratio"),
    maybe<CircularRow>(
      supabase.from("v_circular_economy").select("*").single(),
      "load circular economy",
    ),
    maybe<CommerceKpiRow>(
      supabase.from("v_commerce_kpis").select("*").single(),
      "load commerce KPIs",
    ),
    must<BestSellerRow[]>(
      supabase.from("v_best_sellers").select("*").limit(6),
      "load best sellers",
    ),
    must<LtvRow[]>(
      supabase.from("v_customer_ltv").select("*").gt("lifetime_value", 0).limit(8),
      "load LTV",
    ),
  ]);

  const fresh = dry.reduce((s, r) => s + (r.fresh_g ?? 0), 0);
  const dryG = dry.reduce((s, r) => s + (r.dry_g ?? 0), 0);
  const overall = fresh > 0 ? Math.round((dryG / fresh) * 1000) / 10 : 0;
  const k = kpis ?? { gross_sales: 0, avg_order_value: 0, orders: 0 };
  const c = circ ?? { spent_substrate_kg: 0, estimated_co2e_diverted_kg: 0 };

  return (
    <>
      <div>
        <div className="eyebrow">Intelligence</div>
        <h1 className="section">Reports &amp; analytics</h1>
        <p className="lead">
          Production, quality, sales, and sustainability, all on one page.
        </p>
      </div>

      <div className="kpi-row">
        <Kpi label="Gross sales" value={money(k.gross_sales)} feature />
        <Kpi label="Fresh harvested" value={Math.round(fresh)} unit="g" />
        <Kpi label="Overall dry ratio" value={overall} unit="%" />
        <Kpi label="Avg order value" value={money(k.avg_order_value)} />
      </div>

      <div className="grid kpis" style={{ marginTop: "var(--space-3)" }}>
        <Kpi label="Spent substrate" value={c.spent_substrate_kg} unit="kg" />
        <Kpi label="CO₂e diverted (est.)" value={c.estimated_co2e_diverted_kg} unit="kg" />
      </div>

      <div className="grid two">
        <Card title="Yield by strain">
          <table>
            <caption className="sr-only">Yield by strain</caption>
            <thead>
              <tr>
                <th scope="col">Strain</th>
                <th scope="col" className="right">Batches</th>
                <th scope="col" className="right">Fresh (g)</th>
                <th scope="col" className="right">Bio-eff.</th>
              </tr>
            </thead>
            <tbody>
              {yields
                .filter((y) => y.batches > 0)
                .map((y) => (
                  <tr key={y.strain_id}>
                    <td>{y.strain}</td>
                    <td className="right">{y.batches}</td>
                    <td className="right">{kgToG(y.fresh_kg ?? 0)}</td>
                    <td className="right">{y.biological_efficiency_pct ?? "-"}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>

        <Card title="Strain scoreboard (portfolio optimizer)">
          <table>
            <caption className="sr-only">Strain scoreboard</caption>
            <thead>
              <tr>
                <th scope="col">Strain</th>
                <th scope="col" className="right">BE%</th>
                <th scope="col" className="right">Dry%</th>
                <th scope="col" className="right">Ease</th>
              </tr>
            </thead>
            <tbody>
              {scoreboard
                .filter((s) => (s.fresh_kg ?? 0) > 0)
                .map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td className="right">{s.biological_efficiency_pct ?? "-"}</td>
                    <td className="right">{s.avg_dry_ratio ?? "-"}</td>
                    <td className="right">{s.ease_rating ?? "-"}/10</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="grid two">
        <Card title="Best sellers">
          {best.every((b) => b.units === 0) ? (
            <p className="muted" style={{ margin: 0 }}>No sales recorded yet.</p>
          ) : (
            <table>
              <caption className="sr-only">Best-selling products</caption>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col" className="right">Units</th>
                  <th scope="col" className="right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {best.map((b) => (
                  <tr key={b.product_id}>
                    <td>{b.name}</td>
                    <td className="right">{b.units}</td>
                    <td className="right">{money(b.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Customer lifetime value">
          {ltv.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No sales recorded yet.</p>
          ) : (
            <table>
              <caption className="sr-only">Customer lifetime value</caption>
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col" className="right">Orders</th>
                  <th scope="col" className="right">LTV</th>
                </tr>
              </thead>
              <tbody>
                {ltv.map((c2) => (
                  <tr key={c2.id}>
                    <td>{c2.name}</td>
                    <td className="right">{c2.orders}</td>
                    <td className="right">{money(c2.lifetime_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
