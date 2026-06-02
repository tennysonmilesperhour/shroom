import { createClient } from "@/utils/supabase/server";
import { Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const supabase = await createClient();
  const { data: vendors } = await supabase.from("vendors").select("*").order("category").order("name");

  const groups = ["spores", "functional", "supplies", "sourcing"];
  const byCat = (c: string) => (vendors ?? []).filter((v) => v.category === c);

  return (
    <>
      <h2 className="section">Vendors</h2>
      <p className="lead">Spore/genetics, functional spawn, supplies, and wild-harvest sourcing partners.</p>
      {groups.map((g) => byCat(g).length > 0 && (
        <Card key={g} title={g[0].toUpperCase() + g.slice(1)}>
          <table>
            <thead><tr><th>Vendor</th><th>Products</th><th>Rating</th><th>Priority</th><th>Notes</th></tr></thead>
            <tbody>
              {byCat(g).map((v) => (
                <tr key={v.id}>
                  <td><b>{v.name}</b>{v.url && <div className="muted" style={{ fontSize: 11 }}>{v.url}</div>}</td>
                  <td className="muted">{v.products}</td>
                  <td><span className="stars">{"★".repeat(v.rating ?? 0)}</span></td>
                  <td className="muted">{v.contact_priority || "—"}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{v.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </>
  );
}
