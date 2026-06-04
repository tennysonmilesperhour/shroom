import Link from "next/link";
import { createServiceClient } from "@/utils/supabase/service";
import { Kpi, Card } from "@/components/ui";
import { must } from "@/lib/query";
import { DRY_FLOOR } from "@/lib/format";

export const dynamic = "force-dynamic";

interface HarvestRow {
  harvest_id: number;
  batch_id: number;
  lot_code: string | null;
  harvested_on: string;
  flush_number: number;
  strain_id: number | null;
  strain: string | null;
  fresh_g: number | null;
  dry_g: number | null;
  dry_ratio_pct: number | null;
  below_floor: boolean | null;
}

interface JarRow {
  id: number;
  jar_id: string;
  flush_number: number | null;
  dry_weight_g: number;
  used_g: number;
  remaining_g: number;
  location: string | null;
  strains: { name: string } | null;
}

export default async function HarvestsPage() {
  const supabase = createServiceClient();
  const [rows, jars] = await Promise.all([
    must<HarvestRow[]>(
      supabase.from("v_dry_ratio").select("*").order("harvested_on", { ascending: false }),
      "load harvests",
    ),
    must<JarRow[]>(
      supabase.from("dry_inventory").select("*, strains(name)").order("jar_id"),
      "load dried inventory",
    ),
  ]);

  const fresh = rows.reduce((s, r) => s + (r.fresh_g ?? 0), 0);
  const dry = rows.reduce((s, r) => s + (r.dry_g ?? 0), 0);
  const overall = fresh > 0 ? Math.round((dry / fresh) * 1000) / 10 : 0;
  const flagged = rows.filter((r) => r.below_floor).length;

  return (
    <>
      <div>
        <div className="eyebrow">Production</div>
        <h1 className="section">Harvests &amp; dry ratio</h1>
        <p className="lead">
          Flush-by-flush. Rows flagged when dry ratio falls below the {DRY_FLOOR}% floor.
        </p>
      </div>

      <div className="kpi-row">
        <Kpi label="Overall ratio" value={overall} unit="%" feature />
        <Kpi label="Total fresh" value={Math.round(fresh)} unit="g" />
        <Kpi label="Total dry" value={Math.round(dry * 10) / 10} unit="g" />
        <Kpi label="Below floor" value={`${flagged} / ${rows.length}`} />
      </div>

      {rows.length === 0 ? (
        <Card variant="quiet">
          <p className="muted" style={{ margin: 0 }}>
            No harvests logged yet. Once a batch transitions to harvesting, flushes
            will appear here with dry-ratio quality flags.
          </p>
        </Card>
      ) : (
        <div className="card">
          <table>
            <caption className="sr-only">All harvests by date</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Strain</th>
                <th scope="col">Lot</th>
                <th scope="col" className="right">Flush</th>
                <th scope="col" className="right">Fresh (g)</th>
                <th scope="col" className="right">Dry (g)</th>
                <th scope="col" className="right">Ratio</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.harvest_id}
                  className={`row-link ${r.below_floor ? "flag-low" : ""}`}
                >
                  <td>{r.harvested_on}</td>
                  <td>
                    {r.strain_id ? (
                      <Link href={`/strains/${r.strain_id}`} className="row-anchor">
                        {r.strain ?? "?"}
                      </Link>
                    ) : (
                      r.strain ?? "?"
                    )}
                  </td>
                  <td>
                    {r.batch_id ? (
                      <Link href={`/batches/${r.batch_id}`} className="row-anchor">
                        {r.lot_code ?? "-"}
                      </Link>
                    ) : (
                      r.lot_code ?? "-"
                    )}
                  </td>
                  <td className="right">F{r.flush_number}</td>
                  <td className="right">{r.fresh_g}</td>
                  <td className="right">{r.dry_g}</td>
                  <td className="right">
                    {r.dry_ratio_pct}%{r.below_floor ? " ⚠" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Card title="Dried inventory (jars)">
        {jars.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No dried jars recorded.
          </p>
        ) : (
          <table>
            <caption className="sr-only">Dried inventory jars</caption>
            <thead>
              <tr>
                <th scope="col">Jar</th>
                <th scope="col">Strain</th>
                <th scope="col" className="right">Flush</th>
                <th scope="col" className="right">Dry (g)</th>
                <th scope="col" className="right">Used</th>
                <th scope="col" className="right">Remaining</th>
                <th scope="col">Location</th>
              </tr>
            </thead>
            <tbody>
              {jars.map((j) => (
                <tr key={j.id}>
                  <td><b>{j.jar_id}</b></td>
                  <td>{j.strains?.name ?? "-"}</td>
                  <td className="right">F{j.flush_number ?? "-"}</td>
                  <td className="right">{j.dry_weight_g}</td>
                  <td className="right">{j.used_g}</td>
                  <td className="right">{j.remaining_g}</td>
                  <td className="muted">{j.location ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
