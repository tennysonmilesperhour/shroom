import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Kpi } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { createServiceClient } from "@/utils/supabase/service";
import { must, maybe } from "@/lib/query";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

interface CustomerRow {
  id: number;
  name: string;
  channel: string;
  contact_email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  role: string | null;
  price_tier: string | null;
  volume_est: string | null;
  region: string | null;
  last_contact: string | null;
  follow_up_date: string | null;
  priority: number | null;
  notes: string | null;
}

interface OrderLine {
  quantity: number;
  unit_price: number;
}

interface OrderRow {
  id: number;
  order_number: string;
  order_date: string;
  channel: string;
  financial_status: string;
  fulfillment_status: string;
  order_lines: OrderLine[] | null;
}

interface SubRow {
  id: number;
  plan_name: string;
  interval: string;
  status: string;
  next_renewal: string | null;
  price: number;
}

function statusTone(s: string): BadgeTone {
  if (s === "active" || s === "integrated") return "green";
  if (s === "warm") return "amber";
  return "muted";
}

function lineTotal(lines: OrderLine[] | null): number {
  return (lines ?? []).reduce((s, l) => s + l.quantity * l.unit_price, 0);
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const supabase = createServiceClient();
  const [customer, orders, subs] = await Promise.all([
    maybe<CustomerRow>(
      supabase.from("customers").select("*").eq("id", id).single(),
      "load customer",
    ),
    must<OrderRow[]>(
      supabase
        .from("orders")
        .select(
          "id,order_number,order_date,channel,financial_status,fulfillment_status, order_lines(quantity,unit_price)",
        )
        .eq("customer_id", id)
        .order("order_date", { ascending: false }),
      "load orders for customer",
    ),
    must<SubRow[]>(
      supabase
        .from("subscriptions")
        .select("id,plan_name,interval,status,next_renewal,price")
        .eq("customer_id", id),
      "load subscriptions for customer",
    ),
  ]);

  if (!customer) notFound();

  const lifetimeValue = orders.reduce((s, o) => s + lineTotal(o.order_lines), 0);
  const avgOrderValue = orders.length > 0 ? lifetimeValue / orders.length : 0;
  const lastOrder = orders[0]?.order_date ?? null;

  return (
    <>
      <Link href="/customers" className="back-link">
        &larr; Customers
      </Link>

      <div>
        <div className="eyebrow">Commerce</div>
        <h1 className="section">{customer.name}</h1>
        <div className="hero-meta">
          <Badge tone="muted">{customer.channel}</Badge>
          <Badge tone={statusTone(customer.status)}>{customer.status}</Badge>
          {customer.region && <Badge tone="muted">{customer.region}</Badge>}
          {customer.price_tier && <Badge tone="muted">{customer.price_tier} tier</Badge>}
          <span className="stars" aria-label={`Priority ${customer.priority ?? 0} of 5`}>
            {"★".repeat(customer.priority ?? 0)}
          </span>
        </div>
      </div>

      <div className="kpi-row">
        <Kpi label="Lifetime value" value={money(lifetimeValue)} feature />
        <Kpi label="Orders" value={orders.length} />
        <Kpi label="Avg order" value={money(avgOrderValue)} />
        <Kpi label="Last order" value={lastOrder ?? "—"} />
      </div>

      <div className="grid two">
        <Card title="Contact">
          <dl className="kv">
            <dt>Email</dt><dd>{customer.contact_email || "—"}</dd>
            <dt>Phone</dt><dd>{customer.phone || "—"}</dd>
            <dt>Address</dt><dd>{customer.address || "—"}</dd>
            <dt>Role</dt><dd>{customer.role || "—"}</dd>
            <dt>Volume est.</dt><dd>{customer.volume_est || "—"}</dd>
          </dl>
        </Card>

        <Card title="Pipeline">
          <dl className="kv">
            <dt>Last contact</dt><dd>{customer.last_contact ?? "—"}</dd>
            <dt>Follow-up</dt><dd>{customer.follow_up_date ?? "—"}</dd>
            <dt>Subscriptions</dt>
            <dd>
              {subs.length === 0
                ? "—"
                : subs.map((s) => (
                    <div key={s.id}>
                      {s.plan_name} · {s.interval} ·{" "}
                      <Badge tone={s.status === "active" ? "green" : "amber"}>
                        {s.status}
                      </Badge>
                    </div>
                  ))}
            </dd>
          </dl>
        </Card>
      </div>

      <Card title="Order history">
        {orders.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No orders recorded for this customer.</p>
        ) : (
          <table>
            <caption className="sr-only">Orders for {customer.name}</caption>
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Date</th>
                <th scope="col">Channel</th>
                <th scope="col">Payment</th>
                <th scope="col">Fulfillment</th>
                <th scope="col" className="right">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><b>{o.order_number}</b></td>
                  <td>{o.order_date}</td>
                  <td><Badge tone="muted">{o.channel}</Badge></td>
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

      {customer.notes && (
        <Card title="Notes" variant="quiet">
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{customer.notes}</p>
        </Card>
      )}
    </>
  );
}
