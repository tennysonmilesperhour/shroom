import { createServiceClient } from "@/utils/supabase/service";
import { Badge, Card } from "@/components/ui";
import { money } from "@/lib/format";
import { must } from "@/lib/query";

export const revalidate = 300;

interface ProductRow {
  id: number;
  name: string;
  sku: string | null;
  status: string;
  price: number;
  inventory_quantity: number;
  product_variants: { title: string; price: number; inventory_quantity: number }[] | null;
}
interface CollectionRow {
  id: number;
  title: string;
}
interface TierRow {
  id: number;
  tier: string;
  product_class: string;
  min_per_gram: number | null;
  max_per_gram: number | null;
  min_per_lb: number | null;
  max_per_lb: number | null;
}
interface ValuationRow {
  jar_id: string;
  strain: string | null;
  remaining_g: number;
  wholesale_low: number;
  wholesale_high: number;
  retail_low: number;
  retail_high: number;
}

export default async function CatalogPage() {
  const supabase = createServiceClient();
  const [products, collections, tiers, valuation] = await Promise.all([
    must<ProductRow[]>(
      supabase
        .from("products")
        .select("*, product_variants(title,price,inventory_quantity)")
        .order("name"),
      "load products",
    ),
    must<CollectionRow[]>(supabase.from("collections").select("*").order("title"), "load collections"),
    must<TierRow[]>(supabase.from("price_tiers").select("*"), "load price tiers"),
    must<ValuationRow[]>(supabase.from("v_inventory_valuation").select("*"), "load valuation"),
  ]);

  return (
    <>
      <div>
        <div className="eyebrow">Commerce</div>
        <h1 className="section">Catalog &amp; <em>pricing</em></h1>
        <p className="lead">
          Products, variants, collections, pricing tiers, and live dried-inventory valuation.
        </p>
      </div>

      <Card title="Products & variants">
        {products.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No products in the catalog yet.</p>
        ) : (
          <table>
            <caption className="sr-only">Products</caption>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Status</th>
                <th scope="col">Variants</th>
                <th scope="col" className="right">Price</th>
                <th scope="col" className="right">On hand</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.name}</b>
                    <br />
                    <span className="muted">{p.sku ?? "—"}</span>
                  </td>
                  <td>
                    <Badge tone={p.status === "active" ? "green" : "muted"}>{p.status}</Badge>
                  </td>
                  <td className="muted">
                    {p.product_variants?.map((v) => v.title).join(", ") || "—"}
                  </td>
                  <td className="right">{money(p.price)}</td>
                  <td className="right">{p.inventory_quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="grid two">
        <Card title="Dried inventory valuation (by jar)">
          {valuation.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No dried inventory recorded.</p>
          ) : (
            <table>
              <caption className="sr-only">Dried inventory valuation</caption>
              <thead>
                <tr>
                  <th scope="col">Jar</th>
                  <th scope="col">Strain</th>
                  <th scope="col" className="right">g</th>
                  <th scope="col" className="right">Wholesale</th>
                  <th scope="col" className="right">Retail</th>
                </tr>
              </thead>
              <tbody>
                {valuation.map((v) => (
                  <tr key={v.jar_id}>
                    <td><b>{v.jar_id}</b></td>
                    <td>{v.strain ?? "—"}</td>
                    <td className="right">{v.remaining_g}</td>
                    <td className="right">
                      {money(v.wholesale_low)}–{money(v.wholesale_high)}
                    </td>
                    <td className="right">
                      {money(v.retail_low)}–{money(v.retail_high)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Pricing tiers">
          <table>
            <caption className="sr-only">Pricing tiers</caption>
            <thead>
              <tr>
                <th scope="col">Tier</th>
                <th scope="col">Class</th>
                <th scope="col" className="right">$/g</th>
                <th scope="col" className="right">$/lb</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.id}>
                  <td>{t.tier}</td>
                  <td className="muted">{t.product_class}</td>
                  <td className="right">
                    {t.min_per_gram ? `$${t.min_per_gram}–${t.max_per_gram}` : "—"}
                  </td>
                  <td className="right">
                    {t.min_per_lb ? `$${t.min_per_lb}–${t.max_per_lb}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Collections">
        {collections.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No collections yet.</p>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {collections.map((c) => (
              <Badge key={c.id} tone="blue">{c.title}</Badge>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
