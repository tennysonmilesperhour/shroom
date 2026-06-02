import { createClient } from "@/utils/supabase/server";
import { Badge, Card } from "@/components/ui";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BusinessPage() {
  const supabase = await createClient();
  const [orders, customers, valuation, scoreboard] = await Promise.all([
    supabase.from("orders").select("*, customers(name), order_lines(quantity,unit_price)").order("order_date", { ascending: false }),
    supabase.from("customers").select("*").order("priority", { ascending: false, nullsFirst: false }),
    supabase.from("v_inventory_valuation").select("*"),
    supabase.from("v_strain_scoreboard").select("*").gt("fresh_kg", 0).order("biological_efficiency_pct", { ascending: false, nullsFirst: false }),
  ]);

  const orderTotal = (o: any) => (o.order_lines ?? []).reduce((s: number, l: any) => s + l.quantity * l.unit_price, 0);

  return (
    <>
      <h2 className="section">Business Backend</h2>
      <p className="lead">Orders, sales-lead CRM, live dried-inventory valuation, and strain performance.</p>

      <Card title="Dried inventory valuation (live, by jar)">
        <table>
          <thead>
            <tr><th>Jar</th><th>Strain</th><th className="right">Remaining (g)</th><th className="right">Wholesale</th><th className="right">Distributor</th><th className="right">Retail</th></tr>
          </thead>
          <tbody>
            {(valuation.data ?? []).map((v) => (
              <tr key={v.jar_id}>
                <td><b>{v.jar_id}</b></td>
                <td>{v.strain}</td>
                <td className="right">{v.remaining_g}</td>
                <td className="right">{money(v.wholesale_low)}–{money(v.wholesale_high)}</td>
                <td className="right">{money(v.distributor_low)}–{money(v.distributor_high)}</td>
                <td className="right">{money(v.retail_low)}–{money(v.retail_high)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid two">
        <Card title="Orders">
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th className="right">Total</th></tr></thead>
            <tbody>
              {(orders.data ?? []).map((o: any) => (
                <tr key={o.id}>
                  <td><b>{o.order_number}</b><br /><span className="muted">{o.channel}</span></td>
                  <td>{o.customers?.name}</td>
                  <td><Badge tone={o.status === "paid" || o.status === "fulfilled" ? "green" : "amber"}>{o.status}</Badge></td>
                  <td className="right">{money(orderTotal(o))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Strain scoreboard (#10 portfolio optimizer)">
          <table>
            <thead><tr><th>Strain</th><th className="right">BE%</th><th className="right">Dry%</th><th className="right">Ease</th></tr></thead>
            <tbody>
              {(scoreboard.data ?? []).map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="right">{s.biological_efficiency_pct ?? "—"}</td>
                  <td className="right">{s.avg_dry_ratio ?? "—"}</td>
                  <td className="right">{s.ease_rating ?? "—"}/10</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Sales-lead CRM">
        <table>
          <thead><tr><th>Name</th><th>Channel</th><th>Role</th><th>Tier</th><th>Status</th><th className="right">Priority</th></tr></thead>
          <tbody>
            {(customers.data ?? []).map((c) => (
              <tr key={c.id}>
                <td><b>{c.name}</b></td>
                <td><Badge tone="muted">{c.channel}</Badge></td>
                <td className="muted">{c.role || "—"}</td>
                <td>{c.price_tier || "—"}</td>
                <td><Badge tone={c.status === "active" || c.status === "integrated" ? "green" : c.status === "warm" ? "amber" : "muted"}>{c.status}</Badge></td>
                <td className="right"><span className="stars">{"★".repeat(c.priority ?? 0)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
