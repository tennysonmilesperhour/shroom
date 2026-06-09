import { createServiceClient } from "@/utils/supabase/service";
import { Badge, Card } from "@/components/ui";
import { money } from "@/lib/format";
import { must } from "@/lib/query";
import RowActions from "@/components/RowActions";

export const dynamic = "force-dynamic";

interface SubItem {
  quantity: number;
  products: { name: string } | null;
}
interface SubRow {
  id: number;
  customer_id: number | null;
  plan_name: string;
  interval: string;
  status: string;
  started_on: string | null;
  next_renewal: string | null;
  price: number;
  customers: { name: string } | null;
  subscription_items: SubItem[] | null;
}
interface CustomerOpt {
  id: number;
  name: string;
}

export default async function SubscriptionsPage() {
  const supabase = createServiceClient();
  const [subs, customerOpts] = await Promise.all([
    must<SubRow[]>(
      supabase
        .from("subscriptions")
        .select("*, customers(name), subscription_items(quantity, products(name))")
        .order("next_renewal", { ascending: true, nullsFirst: false }),
      "load subscriptions",
    ),
    must<CustomerOpt[]>(
      supabase.from("customers").select("id,name").order("name"),
      "load customers",
    ),
  ]);

  return (
    <>
      <div>
        <div className="eyebrow">Commerce</div>
        <h1 className="section">Subscriptions &amp; recurring</h1>
        <p className="lead">Recurring revenue: CSA boxes and standing wholesale or wellness orders.</p>
      </div>

      <Card>
        {subs.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No subscriptions yet. Set up recurring CSA boxes or standing orders here.
          </p>
        ) : (
          <table>
            <caption className="sr-only">Subscriptions</caption>
            <thead>
              <tr>
                <th scope="col">Plan</th>
                <th scope="col">Customer</th>
                <th scope="col">Interval</th>
                <th scope="col">Items</th>
                <th scope="col">Status</th>
                <th scope="col">Renews</th>
                <th scope="col" className="right">Price</th>
                <th scope="col" className="actions-col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id}>
                  <td><b>{s.plan_name}</b></td>
                  <td>{s.customers?.name ?? "-"}</td>
                  <td className="muted">{s.interval}</td>
                  <td className="muted">
                    {(s.subscription_items ?? [])
                      .map((i) => `${i.quantity}× ${i.products?.name ?? "?"}`)
                      .join(", ") || "-"}
                  </td>
                  <td>
                    <Badge tone={s.status === "active" ? "green" : "amber"}>{s.status}</Badge>
                  </td>
                  <td className="muted">{s.next_renewal || "-"}</td>
                  <td className="right">{money(s.price)}</td>
                  <td className="actions-col">
                    <RowActions
                      entity="subscription"
                      id={s.id}
                      label={s.plan_name}
                      initial={{
                        customer_id: s.customer_id,
                        plan_name: s.plan_name,
                        interval: s.interval,
                        price: s.price,
                        status: s.status,
                        started_on: s.started_on,
                        next_renewal: s.next_renewal,
                      }}
                      options={{
                        customer_id: customerOpts.map((c) => ({
                          value: String(c.id),
                          label: c.name,
                        })),
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
