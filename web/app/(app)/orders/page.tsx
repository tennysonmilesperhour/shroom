import { createClient } from "@/utils/supabase/server";
import { Badge, Card } from "@/components/ui";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("*, customers(name), order_lines(quantity,unit_price)")
    .order("order_date", { ascending: false });

  const total = (o: any) => (o.order_lines ?? []).reduce((s: number, l: any) => s + l.quantity * l.unit_price, 0);
  const rows = orders ?? [];

  return (
    <>
      <h2 className="section">Orders</h2>
      <p className="lead">Sales across every channel — wholesale, distributor, retail, farmers market, online.</p>
      <Card>
        {rows.length === 0 ? (
          <div className="muted">No orders yet. They'll appear here as you record sales (or once checkout is wired up).</div>
        ) : (
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Channel</th><th>Date</th><th>Payment</th><th>Fulfillment</th><th className="right">Total</th></tr></thead>
            <tbody>
              {rows.map((o: any) => (
                <tr key={o.id}>
                  <td><b>{o.order_number}</b></td>
                  <td>{o.customers?.name}</td>
                  <td><Badge tone="muted">{o.channel}</Badge></td>
                  <td>{o.order_date}</td>
                  <td><Badge tone={o.financial_status === "paid" ? "green" : "amber"}>{o.financial_status}</Badge></td>
                  <td><Badge tone={o.fulfillment_status === "fulfilled" ? "green" : "muted"}>{o.fulfillment_status}</Badge></td>
                  <td className="right">{money(total(o))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
