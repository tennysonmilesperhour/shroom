import Link from "next/link";
import { createServiceClient } from "@/utils/supabase/service";
import { Badge, Card } from "@/components/ui";
import { must } from "@/lib/query";
import type { BadgeTone } from "@/components/ui";
import AddPanel from "@/components/AddPanel";
import AddCustomerForm from "./AddCustomerForm";
import RowActions from "@/components/RowActions";

export const dynamic = "force-dynamic";

interface CustomerRow {
  id: number;
  name: string;
  channel: string;
  role: string | null;
  price_tier: string | null;
  status: string;
  follow_up_date: string | null;
  priority: number | null;
  notes: string | null;
  contact_email: string | null;
  phone: string | null;
  region: string | null;
  volume_est: string | null;
  address: string | null;
}

function statusTone(s: string): BadgeTone {
  if (s === "active" || s === "integrated") return "green";
  if (s === "warm") return "amber";
  return "muted";
}

export default async function CustomersPage() {
  const supabase = createServiceClient();
  const customers = await must<CustomerRow[]>(
    supabase
      .from("customers")
      .select("*")
      .order("priority", { ascending: false, nullsFirst: false })
      .order("name"),
    "load customers",
  );

  return (
    <>
      <div>
        <div className="eyebrow">Commerce</div>
        <h1 className="section">Customers &amp; leads</h1>
        <p className="lead">
          CRM pipeline across distributors, wholesale, retail, wellness, and market channels.
        </p>
      </div>

      <AddPanel label="New customer">
        <AddCustomerForm />
      </AddPanel>

      <Card>
        {customers.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No customers yet.</p>
        ) : (
          <table>
            <caption className="sr-only">Customers and leads</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Channel</th>
                <th scope="col">Role</th>
                <th scope="col">Tier</th>
                <th scope="col">Status</th>
                <th scope="col">Follow-up</th>
                <th scope="col" className="right">Priority</th>
                <th scope="col" className="actions-col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="row-link">
                  <td>
                    <Link href={`/customers/${c.id}`} className="row-anchor">
                      <b>{c.name}</b>
                    </Link>
                    {c.notes && (
                      <div className="muted" style={{ fontSize: 11 }}>
                        {c.notes.slice(0, 80)}
                      </div>
                    )}
                  </td>
                  <td>
                    <Badge tone="muted">{c.channel}</Badge>
                  </td>
                  <td className="muted">{c.role || "-"}</td>
                  <td>{c.price_tier || "-"}</td>
                  <td>
                    <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                  </td>
                  <td className="muted">{c.follow_up_date || "-"}</td>
                  <td className="right">
                    <span className="stars" aria-label={`Priority ${c.priority ?? 0} of 5`}>
                      {"★".repeat(c.priority ?? 0)}
                    </span>
                  </td>
                  <td className="actions-col">
                    <RowActions
                      entity="customer"
                      id={c.id}
                      label={c.name}
                      viewHref={`/customers/${c.id}`}
                      initial={{
                        name: c.name,
                        channel: c.channel,
                        status: c.status,
                        contact_email: c.contact_email,
                        phone: c.phone,
                        role: c.role,
                        region: c.region,
                        price_tier: c.price_tier,
                        volume_est: c.volume_est,
                        follow_up_date: c.follow_up_date,
                        address: c.address,
                        notes: c.notes,
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
