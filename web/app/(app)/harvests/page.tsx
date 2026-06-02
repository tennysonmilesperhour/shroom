import { createClient } from "@/utils/supabase/server";
import { Kpi, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HarvestsPage() {
  const supabase = await createClient();
  const [{ data: rows }, { data: jars }] = await Promise.all([
    supabase.from("v_dry_ratio").select("*").order("harvested_on", { ascending: false }),
    supabase.from("dry_inventory").select("*, strains(name)").order("jar_id"),
  ]);

  const data = rows ?? [];
  const fresh = data.reduce((s, r) => s + (r.fresh_g ?? 0), 0);
  const dry = data.reduce((s, r) => s + (r.dry_g ?? 0), 0);
  const overall = fresh > 0 ? Math.round((dry / fresh) * 1000) / 10 : 0;
  const flagged = data.filter((r) => r.below_floor).length;

  return (
    <>
      <h2 className="section">Harvests & Dry Ratio</h2>
      <p className="lead">Flush-by-flush. Rows flagged when dry ratio falls below the 7.5% floor.</p>
      <div className="grid kpis">
        <Kpi label="Total fresh" value={Math.round(fresh)} unit="g" />
        <Kpi label="Total dry" value={Math.round(dry * 10) / 10} unit="g" />
        <Kpi label="Overall ratio" value={overall} unit="%" />
        <Kpi label="Below floor" value={`${flagged} / ${data.length}`} />
      </div>
      <div className="card">
        <table>
          <thead>
            <tr><th>Date</th><th>Strain</th><th>Lot</th><th className="right">Flush</th><th className="right">Fresh (g)</th><th className="right">Dry (g)</th><th className="right">Ratio</th></tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.harvest_id} className={r.below_floor ? "flag-low" : ""}>
                <td>{r.harvested_on}</td>
                <td>{r.strain ?? "?"}</td>
                <td>{r.lot_code ?? "—"}</td>
                <td className="right">F{r.flush_number}</td>
                <td className="right">{r.fresh_g}</td>
                <td className="right">{r.dry_g}</td>
                <td className="right">{r.dry_ratio_pct}%{r.below_floor ? " ⚠" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Card title="Dried inventory (jars)">
        {(jars ?? []).length === 0 ? (
          <div className="muted">No dried jars recorded.</div>
        ) : (
          <table>
            <thead><tr><th>Jar</th><th>Strain</th><th className="right">Flush</th><th className="right">Dry (g)</th><th className="right">Used</th><th className="right">Remaining</th><th>Location</th></tr></thead>
            <tbody>
              {(jars ?? []).map((j: any) => (
                <tr key={j.id}>
                  <td><b>{j.jar_id}</b></td>
                  <td>{j.strains?.name ?? "—"}</td>
                  <td className="right">F{j.flush_number}</td>
                  <td className="right">{j.dry_weight_g}</td>
                  <td className="right">{j.used_g}</td>
                  <td className="right">{j.remaining_g}</td>
                  <td className="muted">{j.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
