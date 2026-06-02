import { createClient } from "@/utils/supabase/server";
import { Kpi, Card, Badge } from "@/components/ui";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CommercePage() {
  const supabase = await createClient();
  const [kpis, best, products, discounts, gifts, subs, pos, ltv, campaigns, fulfil] = await Promise.all([
    supabase.from("v_commerce_kpis").select("*").single(),
    supabase.from("v_best_sellers").select("*").limit(6),
    supabase.from("products").select("*, product_variants(id,title,price,inventory_quantity)").order("name"),
    supabase.from("discounts").select("*").order("active", { ascending: false }),
    supabase.from("gift_cards").select("*"),
    supabase.from("subscriptions").select("*, customers(name)"),
    supabase.from("purchase_orders").select("*, vendors(name)"),
    supabase.from("v_customer_ltv").select("*").gt("lifetime_value", 0).limit(8),
    supabase.from("marketing_campaigns").select("*"),
    supabase.from("fulfillments").select("*, orders(order_number)"),
  ]);

  const k = kpis.data ?? { orders: 0, gross_sales: 0, avg_order_value: 0, customers: 0 };

  return (
    <>
      <h2 className="section">Commerce</h2>
      <p className="lead">Shopify-class storefront backend — catalog, inventory, orders, fulfillment, discounts, subscriptions, suppliers, and marketing.</p>

      <div className="grid kpis">
        <Kpi label="Gross sales" value={money(k.gross_sales)} />
        <Kpi label="Orders" value={k.orders} />
        <Kpi label="Avg order value" value={money(k.avg_order_value)} />
        <Kpi label="Customers" value={k.customers} />
      </div>

      <div className="grid two">
        <Card title="Best sellers">
          <table>
            <thead><tr><th>Product</th><th className="right">Units</th><th className="right">Revenue</th></tr></thead>
            <tbody>{(best.data ?? []).map((b) => (
              <tr key={b.product_id}><td>{b.name}</td><td className="right">{b.units}</td><td className="right">{money(b.revenue)}</td></tr>
            ))}</tbody>
          </table>
        </Card>
        <Card title="Customer lifetime value">
          <table>
            <thead><tr><th>Customer</th><th>Channel</th><th className="right">Orders</th><th className="right">LTV</th></tr></thead>
            <tbody>{(ltv.data ?? []).map((c) => (
              <tr key={c.id}><td>{c.name}</td><td><Badge tone="muted">{c.channel}</Badge></td><td className="right">{c.orders}</td><td className="right">{money(c.lifetime_value)}</td></tr>
            ))}</tbody>
          </table>
        </Card>
      </div>

      <Card title="Catalog — products, variants & inventory">
        <table>
          <thead><tr><th>Product</th><th>Status</th><th>Variants</th><th className="right">Price</th><th className="right">On hand</th></tr></thead>
          <tbody>{(products.data ?? []).map((p: any) => (
            <tr key={p.id}>
              <td><b>{p.name}</b><br /><span className="muted">{p.sku}</span></td>
              <td><Badge tone={p.status === "active" ? "green" : "muted"}>{p.status}</Badge></td>
              <td className="muted">{(p.product_variants ?? []).map((v: any) => v.title).join(", ") || "—"}</td>
              <td className="right">{money(p.price)}{p.compare_at_price ? <><br /><span className="muted" style={{ textDecoration: "line-through" }}>{money(p.compare_at_price)}</span></> : null}</td>
              <td className="right">{p.inventory_quantity}</td>
            </tr>
          ))}</tbody>
        </table>
      </Card>

      <div className="grid two">
        <Card title="Discounts">
          <table>
            <thead><tr><th>Code</th><th>Type</th><th className="right">Value</th><th>Active</th></tr></thead>
            <tbody>{(discounts.data ?? []).map((d) => (
              <tr key={d.id}><td><b>{d.code}</b></td><td className="muted">{d.discount_type}</td>
                <td className="right">{d.discount_type === "percentage" ? `${d.value}%` : d.discount_type === "fixed" ? money(d.value) : "—"}</td>
                <td><Badge tone={d.active ? "green" : "muted"}>{d.active ? "live" : "off"}</Badge></td></tr>
            ))}</tbody>
          </table>
        </Card>
        <Card title="Gift cards">
          <table>
            <thead><tr><th>Code</th><th className="right">Balance</th><th>Status</th></tr></thead>
            <tbody>{(gifts.data ?? []).map((g) => (
              <tr key={g.id}><td><b>{g.code}</b></td><td className="right">{money(g.balance)} / {money(g.initial_balance)}</td><td><Badge tone="green">{g.status}</Badge></td></tr>
            ))}</tbody>
          </table>
        </Card>
      </div>

      <div className="grid two">
        <Card title="Subscriptions (recurring / CSA)">
          {(subs.data ?? []).length === 0 ? <div className="muted">None.</div> : (
            <table>
              <thead><tr><th>Plan</th><th>Customer</th><th className="right">Price</th><th>Renews</th></tr></thead>
              <tbody>{(subs.data ?? []).map((s: any) => (
                <tr key={s.id}><td><b>{s.plan_name}</b><br /><span className="muted">{s.interval}</span></td><td>{s.customers?.name}</td><td className="right">{money(s.price)}</td><td className="muted">{s.next_renewal}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>
        <Card title="Purchase orders (supplier restock)">
          <table>
            <thead><tr><th>Ref</th><th>Vendor</th><th>Status</th><th className="right">Total</th></tr></thead>
            <tbody>{(pos.data ?? []).map((p: any) => (
              <tr key={p.id}><td><b>{p.reference}</b></td><td>{p.vendors?.name}</td><td><Badge tone={p.status === "received" ? "green" : "amber"}>{p.status}</Badge></td><td className="right">{money(p.total)}</td></tr>
            ))}</tbody>
          </table>
        </Card>
      </div>

      <div className="grid two">
        <Card title="Fulfillments">
          {(fulfil.data ?? []).length === 0 ? <div className="muted">No shipments yet.</div> : (
            <table>
              <thead><tr><th>Order</th><th>Status</th><th>Tracking</th></tr></thead>
              <tbody>{(fulfil.data ?? []).map((f: any) => (
                <tr key={f.id}><td>{f.orders?.order_number}</td><td><Badge tone={f.status === "delivered" ? "green" : "amber"}>{f.status}</Badge></td><td className="muted">{f.tracking_company} {f.tracking_number?.slice(-6)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>
        <Card title="Marketing campaigns">
          <table>
            <thead><tr><th>Campaign</th><th className="right">Sent</th><th className="right">Opens</th><th className="right">Revenue</th></tr></thead>
            <tbody>{(campaigns.data ?? []).map((c) => (
              <tr key={c.id}><td><b>{c.name}</b><br /><span className="muted">{c.channel}</span></td><td className="right">{c.recipients}</td><td className="right">{c.opens}</td><td className="right">{money(c.revenue)}</td></tr>
            ))}</tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
