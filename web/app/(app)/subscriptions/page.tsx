import { createServiceClient } from "@/utils/supabase/service";
import { Badge, Card } from "@/components/ui";
import { money } from "@/lib/format";
import { must } from "@/lib/query";

export const dynamic = "force-dynamic";

interface SubItem {
  quantity: number;
  products: { name: string } | null;
}
interface SubRow {
  id: number;
  plan_name: string;
  interval: string;
  status: string;
  next_renewal: string | null;
  price: number;
  customers: { name: string } | null;
  subscription_items: SubItem[] | null;
}

export default async function SubscriptionsPage() {
  const supabase = createServiceClient();
  const subs = await must<SubRow[]>(
    supabase
      .from("subscriptions")
      .select("*, customers(name), subscription_items(quantity, products(name))")
      .order("next_renewal", { ascending: true, nullsFirst: false }),
    "load subscriptions",
  );

  return (
    <>
      <div>
        <div className="eyebrow">Commerce</div>
        <h1 className="section">Subscriptions &amp; <em>recurring</em></h1>
        <p className="lead">Recurring revenue — CSA boxes and standing wholesale/wellness orders.</p>
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
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id}>
                  <td><b>{s.plan_name}</b></td>
                  <td>{s.customers?.name ?? "—"}</td>
                  <td className="muted">{s.interval}</td>
                  <td className="muted">
                    {(s.subscription_items ?? [])
                      .map((i) => `${i.quantity}× ${i.products?.name ?? "?"}`)
                      .join(", ") || "—"}
                  </td>
                  <td>
                    <Badge tone={s.status === "active" ? "green" : "amber"}>{s.status}</Badge>
                  </td>
                  <td className="muted">{s.next_renewal || "—"}</td>
                  <td className="right">{money(s.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
