import Link from "next/link";
import { createServiceClient } from "@/utils/supabase/service";
import { Kpi, Card } from "@/components/ui";
import { must } from "@/lib/query";
import { DRY_FLOOR } from "@/lib/format";
import AddPanel from "@/components/AddPanel";
import AddHarvestForm from "./AddHarvestForm";
import RowActions from "@/components/RowActions";

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
  strain_id: number | null;
  flush_number: number | null;
  dry_weight_g: number;
  used_g: number;
  remaining_g: number;
  location: string | null;
  notes: string | null;
  strains: { name: string } | null;
}

interface BatchOptionRow {
  id: number;
  lot_code: string;
  strains: { name: string } | null;
}

interface BaseHarvestRow {
  id: number;
  batch_id: number;
  harvested_on: string;
  flush_number: number | null;
  sku: string | null;
  weight_kg: number | null;
  dry_weight_kg: number | null;
  grade: string | null;
  labor_minutes: number | null;
  notes: string | null;
}

interface StrainOptionRow {
  id: number;
  name: string;
}

export default async function HarvestsPage() {
  const supabase = createServiceClient();
  const [rows, jars, batchOpts, baseHarvests, strainOpts] = await Promise.all([
    must<HarvestRow[]>(
      supabase.from("v_dry_ratio").select("*").order("harvested_on", { ascending: false }),
      "load harvests",
    ),
    must<JarRow[]>(
      supabase.from("dry_inventory").select("*, strains(name)").order("jar_id"),
      "load dried inventory",
    ),
    must<BatchOptionRow[]>(
      supabase
        .from("batches")
        .select("id,lot_code,strains(name)")
        .order("created_at", { ascending: false })
        .returns<BatchOptionRow[]>(),
      "load batch options",
    ),
    must<BaseHarvestRow[]>(
      supabase.from("harvests").select("*"),
      "load harvest records",
    ),
    must<StrainOptionRow[]>(
      supabase.from("strains").select("id,name").order("name"),
      "load strain options",
    ),
  ]);

  const batchOptions = batchOpts.map((b) => ({
    id: b.id,
    lot_code: b.lot_code,
    strain: b.strains?.name ?? null,
  }));

  const batchSelectOptions = batchOpts.map((b) => ({
    value: String(b.id),
    label: b.lot_code,
  }));
  const strainSelectOptions = strainOpts.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));
  const baseHarvestById = new Map(baseHarvests.map((h) => [h.id, h]));

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
        <Kpi label="Overall ratio" countTo={overall} decimals={1} unit="%" feature />
        <Kpi label="Total fresh" countTo={Math.round(fresh)} unit="g" />
        <Kpi label="Total dry" countTo={Math.round(dry * 10) / 10} decimals={1} unit="g" />
        <Kpi label="Below floor" value={`${flagged} / ${rows.length}`} />
      </div>

      <AddPanel label="Log harvest" buttonLabel="Log harvest">
        <AddHarvestForm batches={batchOptions} />
      </AddPanel>

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
                <th scope="col">SKU</th>
                <th scope="col" className="right">Fresh (g)</th>
                <th scope="col" className="right">Dry (g)</th>
                <th scope="col" className="right">Ratio</th>
                <th scope="col">Label</th>
                <th scope="col" className="actions-col"><span className="sr-only">Actions</span></th>
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
                  <td className="mono">
                    {baseHarvestById.get(r.harvest_id)?.sku?.trim() || (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="right">{r.fresh_g}</td>
                  <td className="right">{r.dry_g}</td>
                  <td className="right">
                    {r.dry_ratio_pct}%{r.below_floor ? " ⚠" : ""}
                  </td>
                  <td>
                    <a
                      href={`/label/harvest/${r.harvest_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="row-anchor"
                    >
                      Print ↗
                    </a>
                  </td>
                  <td className="actions-col">
                    {(() => {
                      const base = baseHarvestById.get(r.harvest_id);
                      return base ? (
                        <RowActions
                          entity="harvest"
                          id={r.harvest_id}
                          label={r.lot_code ?? `Flush ${r.flush_number}`}
                          initial={{
                            batch_id: base.batch_id,
                            harvested_on: base.harvested_on,
                            flush_number: base.flush_number,
                            weight_kg: base.weight_kg,
                            dry_weight_kg: base.dry_weight_kg,
                            grade: base.grade,
                            labor_minutes: base.labor_minutes,
                            notes: base.notes,
                          }}
                          options={{ batch_id: batchSelectOptions }}
                        />
                      ) : null;
                    })()}
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
                <th scope="col" className="actions-col"><span className="sr-only">Actions</span></th>
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
                  <td className="actions-col">
                    <RowActions
                      entity="jar"
                      id={j.id}
                      label={j.jar_id}
                      initial={{
                        jar_id: j.jar_id,
                        strain_id: j.strain_id,
                        flush_number: j.flush_number,
                        dry_weight_g: j.dry_weight_g,
                        used_g: j.used_g,
                        location: j.location,
                        notes: j.notes,
                      }}
                      options={{ strain_id: strainSelectOptions }}
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
