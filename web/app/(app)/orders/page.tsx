import Link from "next/link";
import { createServiceClient } from "@/utils/supabase/service";
import { Badge, Card, Kpi } from "@/components/ui";
import { money } from "@/lib/format";
import { must } from "@/lib/query";
import AddPanel from "@/components/AddPanel";
import AddOrderForm from "./AddOrderForm";

export const dynamic = "force-dynamic";

interface OrderLine {
  quantity: number;
  unit_price: number;
}
interface OrderRow {
  id: number;
  order_number: string;
  channel: string;
  order_date: string;
  financial_status: string;
  fulfillment_status: string;
  customers: { id: number; name: string } | null;
  order_lines: OrderLine[] | null;
}

function lineTotal(lines: OrderLine[] | null): number {
  return (lines ?? []).reduce((s, l) => s + l.quantity * l.unit_price, 0);
}

interface CustomerOpt {
  id: number;
  name: string;
}

export default async function OrdersPage() {
  const supabase = createServiceClient();
  const [orders, customerOpts] = await Promise.all([
    must<OrderRow[]>(
      supabase
        .from("orders")
        .select("*, customers(id,name), order_lines(quantity,unit_price)")
        .order("order_date", { ascending: false })
        .returns<OrderRow[]>(),
      "load orders",
    ),
    must<CustomerOpt[]>(
      supabase.from("customers").select("id,name").order("name"),
      "load customers",
    ),
  ]);

  const grossYtd = orders.reduce((s, o) => s + lineTotal(o.order_lines), 0);
  const avg = orders.length > 0 ? grossYtd / orders.length : 0;

  return (
    <>
      <div>
        <div className="eyebrow">Commerce</div>
        <h1 className="section">Orders &amp; fulfillment</h1>
        <p className="lead">
          Sales across every channel: wholesale, distributor, retail, farmers market, and online.
        </p>
      </div>

      <div className="kpi-row">
        <Kpi label="Gross (all time)" countTo={grossYtd ?? 0} prefix="$" feature />
        <Kpi label="Orders" countTo={orders.length} />
        <Kpi label="Avg order value" countTo={avg ?? 0} prefix="$" />
        <Kpi
          label="Unfulfilled"
          countTo={orders.filter((o) => o.fulfillment_status !== "fulfilled").length}
        />
      </div>

      <AddPanel label="New order">
        <AddOrderForm customers={customerOpts} />
      </AddPanel>

      <Card>
        {orders.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No orders yet. They&rsquo;ll appear here as you record sales (or once checkout is wired up).
          </p>
        ) : (
          <table>
            <caption className="sr-only">All orders</caption>
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Customer</th>
                <th scope="col">Channel</th>
                <th scope="col">Date</th>
                <th scope="col">Payment</th>
                <th scope="col">Fulfillment</th>
                <th scope="col" className="right">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><b>{o.order_number}</b></td>
                  <td>
                    {o.customers ? (
                      <Link href={`/customers/${o.customers.id}`} className="row-anchor">
                        {o.customers.name}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <Badge tone="muted">{o.channel}</Badge>
                  </td>
                  <td>{o.order_date}</td>
                  <td>
                    <Badge tone={o.financial_status === "paid" ? "green" : "amber"}>
                      {o.financial_status}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={o.fulfillment_status === "fulfilled" ? "green" : "muted"}>
                      {o.fulfillment_status}
                    </Badge>
                  </td>
                  <td className="right">{money(lineTotal(o.order_lines))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
