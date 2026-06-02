import { createClient } from "@/utils/supabase/server";
import { Badge, Card } from "@/components/ui";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const supabase = await createClient();
  const [discounts, gifts, campaigns, carts] = await Promise.all([
    supabase.from("discounts").select("*").order("active", { ascending: false }),
    supabase.from("gift_cards").select("*"),
    supabase.from("marketing_campaigns").select("*").order("sent_at", { ascending: false, nullsFirst: false }),
    supabase.from("abandoned_carts").select("*").order("created_at", { ascending: false }),
  ]);

  const empty = (s: string) => <div className="muted">{s}</div>;

  return (
    <>
      <h2 className="section">Marketing</h2>
      <p className="lead">Discounts, gift cards, campaigns, and cart recovery.</p>

      <div className="grid two">
        <Card title="Discount codes">
          {(discounts.data ?? []).length === 0 ? empty("No discount codes.") : (
            <table>
              <thead><tr><th>Code</th><th>Type</th><th className="right">Value</th><th>Active</th></tr></thead>
              <tbody>{(discounts.data ?? []).map((d) => (
                <tr key={d.id}><td><b>{d.code}</b></td><td className="muted">{d.discount_type}</td>
                  <td className="right">{d.discount_type === "percentage" ? `${d.value}%` : d.discount_type === "fixed" ? money(d.value) : "—"}</td>
                  <td><Badge tone={d.active ? "green" : "muted"}>{d.active ? "live" : "off"}</Badge></td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>
        <Card title="Gift cards">
          {(gifts.data ?? []).length === 0 ? empty("No gift cards issued.") : (
            <table>
              <thead><tr><th>Code</th><th className="right">Balance</th><th>Status</th></tr></thead>
              <tbody>{(gifts.data ?? []).map((g) => (
                <tr key={g.id}><td><b>{g.code}</b></td><td className="right">{money(g.balance)}</td><td><Badge tone="green">{g.status}</Badge></td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="grid two">
        <Card title="Campaigns">
          {(campaigns.data ?? []).length === 0 ? empty("No campaigns.") : (
            <table>
              <thead><tr><th>Campaign</th><th className="right">Sent</th><th className="right">Opens</th><th className="right">Revenue</th></tr></thead>
              <tbody>{(campaigns.data ?? []).map((c) => (
                <tr key={c.id}><td><b>{c.name}</b><br /><span className="muted">{c.channel}</span></td><td className="right">{c.recipients}</td><td className="right">{c.opens}</td><td className="right">{money(c.revenue)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>
        <Card title="Abandoned carts">
          {(carts.data ?? []).length === 0 ? empty("No abandoned carts.") : (
            <table>
              <thead><tr><th>Email</th><th className="right">Subtotal</th><th>Recovered</th></tr></thead>
              <tbody>{(carts.data ?? []).map((c) => (
                <tr key={c.id}><td>{c.email || "—"}</td><td className="right">{money(c.subtotal)}</td><td><Badge tone={c.recovered ? "green" : "amber"}>{c.recovered ? "yes" : "open"}</Badge></td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
