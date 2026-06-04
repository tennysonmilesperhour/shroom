import { createServiceClient } from "@/utils/supabase/service";
import { Badge, Card } from "@/components/ui";
import { must } from "@/lib/query";

export const revalidate = 300;

interface VendorRow {
  id: number;
  name: string;
  category: string;
  products: string | null;
  rating: number | null;
  contact_priority: string | null;
  notes: string | null;
  url: string | null;
}

const GROUPS: { key: string; label: string }[] = [
  { key: "spores", label: "Spores & genetics" },
  { key: "functional", label: "Functional spawn" },
  { key: "supplies", label: "Supplies" },
  { key: "sourcing", label: "Wild-harvest sourcing" },
];

export default async function VendorsPage() {
  const supabase = createServiceClient();
  const vendors = await must<VendorRow[]>(
    supabase.from("vendors").select("*").order("category").order("name"),
    "load vendors",
  );

  return (
    <>
      <div>
        <div className="eyebrow">Sourcing</div>
        <h1 className="section">Trusted <em>vendors</em></h1>
        <p className="lead">
          Spore &amp; genetics, functional spawn, supplies, and wild-harvest sourcing partners.
        </p>
      </div>

      {GROUPS.map((g) => {
        const inGroup = vendors.filter((v) => v.category === g.key);
        if (inGroup.length === 0) return null;
        return (
          <Card key={g.key} title={g.label}>
            <table>
              <caption className="sr-only">{g.label}</caption>
              <thead>
                <tr>
                  <th scope="col">Vendor</th>
                  <th scope="col">Products</th>
                  <th scope="col">Rating</th>
                  <th scope="col">Priority</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {inGroup.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <b>{v.name}</b>
                      {v.url && (
                        <div className="muted" style={{ fontSize: 11 }}>
                          {v.url}
                        </div>
                      )}
                    </td>
                    <td className="muted">{v.products ?? "—"}</td>
                    <td>
                      <span
                        className="stars"
                        aria-label={`Rating ${v.rating ?? 0} of 5`}
                      >
                        {"★".repeat(v.rating ?? 0)}
                      </span>
                    </td>
                    <td className="muted">{v.contact_priority || "—"}</td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {v.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        );
      })}
    </>
  );
}
