import { createClient } from "@/utils/supabase/server";
import { Badge, Card } from "@/components/ui";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const supabase = await createClient();
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("*, customers(name), subscription_items(quantity, products(name))")
    .order("next_renewal", { ascending: true, nullsFirst: false });

  const rows = subs ?? [];

  return (
    <>
      <h2 className="section">Subscriptions</h2>
      <p className="lead">Recurring revenue — CSA boxes and standing wholesale/wellness orders.</p>
      <Card>
        {rows.length === 0 ? (
          <div className="muted">No subscriptions yet. Set up recurring CSA boxes or standing orders here.</div>
        ) : (
          <table>
            <thead><tr><th>Plan</th><th>Customer</th><th>Interval</th><th>Items</th><th>Status</th><th>Renews</th><th className="right">Price</th></tr></thead>
            <tbody>
              {rows.map((s: any) => (
                <tr key={s.id}>
                  <td><b>{s.plan_name}</b></td>
                  <td>{s.customers?.name}</td>
                  <td className="muted">{s.interval}</td>
                  <td className="muted">{(s.subscription_items ?? []).map((i: any) => `${i.quantity}× ${i.products?.name ?? "?"}`).join(", ") || "—"}</td>
                  <td><Badge tone={s.status === "active" ? "green" : "amber"}>{s.status}</Badge></td>
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
