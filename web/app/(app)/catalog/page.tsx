import { createClient } from "@/utils/supabase/server";
import { Badge, Card } from "@/components/ui";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const supabase = await createClient();
  const [products, collections, tiers, valuation] = await Promise.all([
    supabase.from("products").select("*, product_variants(title,price,inventory_quantity)").order("name"),
    supabase.from("collections").select("*").order("title"),
    supabase.from("price_tiers").select("*"),
    supabase.from("v_inventory_valuation").select("*"),
  ]);

  return (
    <>
      <h2 className="section">Catalog</h2>
      <p className="lead">Products, variants, collections, pricing tiers, and live dried-inventory valuation.</p>

      <Card title="Products & variants">
        <table>
          <thead><tr><th>Product</th><th>Status</th><th>Variants</th><th className="right">Price</th><th className="right">On hand</th></tr></thead>
          <tbody>
            {(products.data ?? []).map((p: any) => (
              <tr key={p.id}>
                <td><b>{p.name}</b><br /><span className="muted">{p.sku}</span></td>
                <td><Badge tone={p.status === "active" ? "green" : "muted"}>{p.status}</Badge></td>
                <td className="muted">{(p.product_variants ?? []).map((v: any) => v.title).join(", ") || "—"}</td>
                <td className="right">{money(p.price)}</td>
                <td className="right">{p.inventory_quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid two">
        <Card title="Dried inventory valuation (by jar)">
          {(valuation.data ?? []).length === 0 ? <div className="muted">No dried inventory recorded.</div> : (
            <table>
              <thead><tr><th>Jar</th><th>Strain</th><th className="right">g</th><th className="right">Wholesale</th><th className="right">Retail</th></tr></thead>
              <tbody>{(valuation.data ?? []).map((v) => (
                <tr key={v.jar_id}><td><b>{v.jar_id}</b></td><td>{v.strain}</td><td className="right">{v.remaining_g}</td>
                  <td className="right">{money(v.wholesale_low)}–{money(v.wholesale_high)}</td>
                  <td className="right">{money(v.retail_low)}–{money(v.retail_high)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>
        <Card title="Pricing tiers">
          <table>
            <thead><tr><th>Tier</th><th>Class</th><th className="right">$/g</th><th className="right">$/lb</th></tr></thead>
            <tbody>{(tiers.data ?? []).map((t) => (
              <tr key={t.id}><td>{t.tier}</td><td className="muted">{t.product_class}</td>
                <td className="right">{t.min_per_gram ? `$${t.min_per_gram}–${t.max_per_gram}` : "—"}</td>
                <td className="right">{t.min_per_lb ? `$${t.min_per_lb}–${t.max_per_lb}` : "—"}</td></tr>
            ))}</tbody>
          </table>
        </Card>
      </div>

      <Card title="Collections">
        {(collections.data ?? []).length === 0 ? <div className="muted">No collections yet.</div> : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(collections.data ?? []).map((c) => <Badge key={c.id} tone="blue">{c.title}</Badge>)}
          </div>
        )}
      </Card>
    </>
  );
}
