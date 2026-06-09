import { createServiceClient } from "@/utils/supabase/service";
import { Badge, Card } from "@/components/ui";
import { money } from "@/lib/format";
import { must } from "@/lib/query";
import RowActions from "@/components/RowActions";

export const dynamic = "force-dynamic";

interface DiscountRow {
  id: number;
  code: string;
  discount_type: string;
  value: number;
  active: boolean;
}
interface GiftCardRow {
  id: number;
  code: string;
  balance: number;
  status: string;
}
interface CampaignRow {
  id: number;
  name: string;
  channel: string;
  audience: string | null;
  status: string | null;
  recipients: number;
  opens: number;
  clicks: number;
  revenue: number;
}
interface CartRow {
  id: number;
  email: string | null;
  subtotal: number;
  recovered: boolean;
}

export default async function MarketingPage() {
  const supabase = createServiceClient();
  const [discounts, gifts, campaigns, carts] = await Promise.all([
    must<DiscountRow[]>(
      supabase.from("discounts").select("*").order("active", { ascending: false }),
      "load discounts",
    ),
    must<GiftCardRow[]>(supabase.from("gift_cards").select("*"), "load gift cards"),
    must<CampaignRow[]>(
      supabase
        .from("marketing_campaigns")
        .select("*")
        .order("sent_at", { ascending: false, nullsFirst: false }),
      "load campaigns",
    ),
    must<CartRow[]>(
      supabase.from("abandoned_carts").select("*").order("created_at", { ascending: false }),
      "load abandoned carts",
    ),
  ]);

  return (
    <>
      <div>
        <div className="eyebrow">Commerce</div>
        <h1 className="section">Marketing &amp; recovery</h1>
        <p className="lead">Discount codes, gift cards, campaigns, and cart recovery.</p>
      </div>

      <div className="grid two">
        <Card title="Discount codes">
          {discounts.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No discount codes.</p>
          ) : (
            <table>
              <caption className="sr-only">Discount codes</caption>
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="right">Value</th>
                  <th scope="col">Active</th>
                </tr>
              </thead>
              <tbody>
                {discounts.map((d) => (
                  <tr key={d.id}>
                    <td><b>{d.code}</b></td>
                    <td className="muted">{d.discount_type}</td>
                    <td className="right">
                      {d.discount_type === "percentage"
                        ? `${d.value}%`
                        : d.discount_type === "fixed"
                          ? money(d.value)
                          : "-"}
                    </td>
                    <td>
                      <Badge tone={d.active ? "green" : "muted"}>
                        {d.active ? "live" : "off"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Gift cards">
          {gifts.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No gift cards issued.</p>
          ) : (
            <table>
              <caption className="sr-only">Gift cards</caption>
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col" className="right">Balance</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {gifts.map((g) => (
                  <tr key={g.id}>
                    <td><b>{g.code}</b></td>
                    <td className="right">{money(g.balance)}</td>
                    <td><Badge tone="green">{g.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="grid two">
        <Card title="Campaigns">
          {campaigns.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No campaigns.</p>
          ) : (
            <table>
              <caption className="sr-only">Marketing campaigns</caption>
              <thead>
                <tr>
                  <th scope="col">Campaign</th>
                  <th scope="col" className="right">Sent</th>
                  <th scope="col" className="right">Opens</th>
                  <th scope="col" className="right">Revenue</th>
                  <th scope="col" className="actions-col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <b>{c.name}</b>
                      <br />
                      <span className="muted">{c.channel}</span>
                    </td>
                    <td className="right">{c.recipients}</td>
                    <td className="right">{c.opens}</td>
                    <td className="right">{money(c.revenue)}</td>
                    <td className="actions-col">
                      <RowActions
                        entity="campaign"
                        id={c.id}
                        label={c.name}
                        initial={{
                          name: c.name,
                          channel: c.channel,
                          audience: c.audience,
                          status: c.status,
                          recipients: c.recipients,
                          opens: c.opens,
                          clicks: c.clicks,
                          revenue: c.revenue,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Abandoned carts">
          {carts.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No abandoned carts.</p>
          ) : (
            <table>
              <caption className="sr-only">Abandoned carts</caption>
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col" className="right">Subtotal</th>
                  <th scope="col">Recovered</th>
                </tr>
              </thead>
              <tbody>
                {carts.map((c) => (
                  <tr key={c.id}>
                    <td>{c.email || "-"}</td>
                    <td className="right">{money(c.subtotal)}</td>
                    <td>
                      <Badge tone={c.recovered ? "green" : "amber"}>
                        {c.recovered ? "yes" : "open"}
                      </Badge>
                    </td>
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
