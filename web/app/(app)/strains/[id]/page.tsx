import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Kpi } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { createServiceClient } from "@/utils/supabase/service";
import { must, maybe, soft } from "@/lib/query";
import { cToF, ease } from "@/lib/format";
import { QualityBars, strainQualities } from "@/components/QualityBars";
import { normalizeUrl, displayUrl } from "@/lib/external";
import RunSporeCrawlButton from "../RunSporeCrawlButton";
import { alkaloidSplit, evidenceTone, evidenceLabel, hueColor } from "@/lib/spectrum";

export const dynamic = "force-dynamic";

interface StrainRow {
  id: number;
  name: string;
  species: string | null;
  strain_code: string | null;
  mushroom_type: string;
  vendor: string | null;
  genetics: string | null;
  potency: string | null;
  ease_rating: number | null;
  grow_again: boolean;
  generation: number;
  typical_be: number | null;
  typical_flushes: number | null;
  target_temp_c: number;
  target_humidity: number;
  target_co2_ppm: number;
  syringes_on_hand: number | null;
  library_status: string | null;
  priority: number | null;
  notes: string | null;
  potency_tier: string | null;
  alkaloid_total_pct: number | null;
  alkaloid_total_low_pct: number | null;
  alkaloid_total_high_pct: number | null;
  psilocin_psilocybin_ratio: number | null;
  spectrum_hue: number | null;
  evidence_grade: string | null;
  experience_summary: string | null;
  experience_tags: string[] | null;
  onset_min: number | null;
  peak_hr: number | null;
  duration_hr: number | null;
  profile_source: string | null;
}

interface BatchRow {
  id: number;
  lot_code: string;
  stage: string;
  container_id: string | null;
  block_count: number;
  inoculated_on: string | null;
  rating: number | null;
}

interface HarvestRow {
  harvest_id: number;
  lot_code: string | null;
  harvested_on: string;
  flush_number: number;
  fresh_g: number | null;
  dry_g: number | null;
  dry_ratio_pct: number | null;
  below_floor: boolean | null;
}

interface YieldRow {
  fresh_kg: number | null;
  biological_efficiency_pct: number | null;
  batches: number;
}

interface SporeListingRow {
  id: number;
  vendor_name: string;
  source_url: string;
  product_title: string;
  in_stock: boolean;
  price: string;
  found_at: string;
}

function typeTone(t: string): BadgeTone {
  if (t === "psychedelic") return "blue";
  if (t === "functional") return "green";
  return "amber";
}

export default async function StrainDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const supabase = createServiceClient();
  const [strain, batches, harvests, yieldRow, sporeListings] = await Promise.all([
    maybe<StrainRow>(
      supabase.from("strains").select("*").eq("id", id).single(),
      "load strain",
    ),
    must<BatchRow[]>(
      supabase
        .from("batches")
        .select("id,lot_code,stage,container_id,block_count,inoculated_on,rating")
        .eq("strain_id", id)
        .order("created_at", { ascending: false }),
      "load batches for strain",
    ),
    must<HarvestRow[]>(
      supabase
        .from("v_dry_ratio")
        .select("*")
        .eq("strain_id", id)
        .order("harvested_on", { ascending: false })
        .limit(20),
      "load harvests for strain",
    ),
    maybe<YieldRow>(
      supabase
        .from("v_yield_by_strain")
        .select("fresh_kg,biological_efficiency_pct,batches")
        .eq("strain_id", id)
        .single(),
      "load yield for strain",
    ),
    soft<SporeListingRow>(
      supabase
        .from("spore_source_listings")
        .select("id,vendor_name,source_url,product_title,in_stock,price,found_at")
        .eq("strain_id", id)
        .order("in_stock", { ascending: false })
        .order("found_at", { ascending: false }),
    ),
  ]);

  if (!strain) notFound();

  const totalFresh = harvests.reduce((s, h) => s + (h.fresh_g ?? 0), 0);
  const totalDry = harvests.reduce((s, h) => s + (h.dry_g ?? 0), 0);
  const lifetimeRatio = totalFresh > 0 ? Math.round((totalDry / totalFresh) * 1000) / 10 : 0;

  return (
    <>
      <Link href="/strains" className="back-link">
        &larr; Strain library
      </Link>

      <div>
        <div className="eyebrow">Genetics</div>
        <h1 className="section">{strain.name}</h1>
        <div className="hero-meta">
          <Badge tone={typeTone(strain.mushroom_type)}>{strain.mushroom_type}</Badge>
          {strain.library_status === "unknown" ? (
            <Badge tone="violet">source: searching</Badge>
          ) : (
            strain.library_status && <Badge tone="muted">{strain.library_status}</Badge>
          )}
          {strain.grow_again ? (
            <Badge tone="green">grow again</Badge>
          ) : (
            <Badge tone="red">retire</Badge>
          )}
        </div>
      </div>

      <div className="card quality-card">
        <QualityBars qualities={strainQualities(strain)} />
      </div>

      <div className="kpi-row">
        <Kpi label="Lifetime fresh" countTo={Math.round(totalFresh)} unit="g" feature />
        <Kpi label="Lifetime dry ratio" countTo={lifetimeRatio} decimals={1} unit="%" />
        <Kpi label="Bio-efficiency" value={yieldRow?.biological_efficiency_pct ?? "—"} unit="%" />
        <Kpi label="Batches grown" countTo={yieldRow?.batches ?? batches.length} />
      </div>

      {strain.mushroom_type === "psychedelic" && strain.alkaloid_total_pct != null && (() => {
        const split = alkaloidSplit(strain.alkaloid_total_pct, strain.psilocin_psilocybin_ratio);
        const pbPct = split ? (split.psilocybin / (split.psilocybin + split.psilocin)) * 100 : 0;
        const hue = strain.spectrum_hue ?? 295;
        return (
          <Card title="Alkaloid profile & reported experience" className="profile-card">
            <div className="profile-head">
              <span className="profile-swatch" style={{ background: hueColor(hue, 74, 0.18) }} aria-hidden />
              {strain.potency_tier && <Badge tone="violet">{strain.potency_tier}</Badge>}
              <Badge tone={evidenceTone(strain.evidence_grade)}>
                {evidenceLabel(strain.evidence_grade)}
              </Badge>
            </div>

            <div className="profile-bar-block">
              <div className="profile-bar-label">
                <span>Total tryptamine</span>
                <span>
                  <b>{strain.alkaloid_total_pct}%</b>{" "}
                  <span className="muted">
                    ({strain.alkaloid_total_low_pct}–{strain.alkaloid_total_high_pct}% dry wt)
                  </span>
                </span>
              </div>
              {split && (
                <>
                  <div className="profile-split" role="img"
                    aria-label={`Roughly ${pbPct.toFixed(0)}% psilocybin, ${(100 - pbPct).toFixed(0)}% psilocin`}>
                    <span className="profile-split-pb" style={{ width: `${pbPct}%` }} />
                    <span className="profile-split-pc" style={{ width: `${100 - pbPct}%` }} />
                  </div>
                  <div className="profile-split-key">
                    <span><i className="dot pb" /> Psilocybin ≈ {split.psilocybin.toFixed(2)}%</span>
                    <span><i className="dot pc" /> Psilocin ≈ {split.psilocin.toFixed(2)}%</span>
                  </div>
                </>
              )}
            </div>

            {strain.experience_summary && (
              <p className="profile-summary">{strain.experience_summary}</p>
            )}

            {strain.experience_tags && strain.experience_tags.length > 0 && (
              <div className="profile-tags">
                {strain.experience_tags.map((t) => (
                  <Badge key={t} tone="muted">{t}</Badge>
                ))}
              </div>
            )}

            <dl className="kv kv-3 profile-timing">
              <dt>Onset</dt><dd>{strain.onset_min != null ? `~${strain.onset_min} min` : "—"}</dd>
              <dt>Peak</dt><dd>{strain.peak_hr != null ? `~${strain.peak_hr} h` : "—"}</dd>
              <dt>Duration</dt><dd>{strain.duration_hr != null ? `~${strain.duration_hr} h` : "—"}</dd>
            </dl>

            <p className="profile-caveat muted">
              Potency is lab-grounded; the experiential &ldquo;character&rdquo; is anecdotal and shaped
              heavily by dose, set and setting. Sample-to-sample potency within a strain can vary by
              up to ~100%.
              {strain.profile_source ? ` Source: ${strain.profile_source}` : ""}
            </p>
          </Card>
        );
      })()}

      <div className="grid two">
        <Card title="Genetics & sourcing">
          <dl className="kv">
            <dt>Species</dt><dd>{strain.species || "—"}</dd>
            <dt>Code</dt><dd>{strain.strain_code || "—"}</dd>
            <dt>Vendor</dt><dd>{strain.vendor || "—"}</dd>
            <dt>Lineage</dt><dd>{strain.genetics || "—"}</dd>
            <dt>Potency</dt><dd>{strain.potency || "—"}</dd>
            <dt>Generation</dt><dd>F{strain.generation}</dd>
            <dt>Syringes on hand</dt><dd>{strain.syringes_on_hand ?? 0}</dd>
            <dt>Ease</dt><dd>{ease(strain.ease_rating)}</dd>
          </dl>
        </Card>

        <Card title="Grow targets">
          <dl className="kv">
            <dt>Temperature</dt><dd>{cToF(strain.target_temp_c)}°F</dd>
            <dt>Humidity</dt><dd>{strain.target_humidity}%</dd>
            <dt>CO₂</dt><dd>{strain.target_co2_ppm} ppm</dd>
            <dt>Typical BE</dt><dd>{strain.typical_be}%</dd>
            <dt>Typical flushes</dt><dd>{strain.typical_flushes}</dd>
          </dl>
        </Card>
      </div>

      {(strain.library_status === "unknown" || sporeListings.length > 0) && (
        <Card title="Spore sourcing">
          {strain.library_status === "unknown" ? (
            <p className="muted" style={{ marginTop: 0 }}>
              Source marked <b>unknown</b>. A weekly crawler scans tracked spore
              vendors for this strain in stock and available for purchase.
            </p>
          ) : (
            <p className="muted" style={{ marginTop: 0 }}>
              Most recent sources found by the sourcing crawler.
            </p>
          )}

          {sporeListings.length === 0 ? (
            <p className="muted" style={{ margin: "0 0 12px" }}>
              No sources found yet. Run a search to scan vendors now.
            </p>
          ) : (
            <table>
              <caption className="sr-only">Spore sources for {strain.name}</caption>
              <thead>
                <tr>
                  <th scope="col">Vendor</th>
                  <th scope="col">Listing</th>
                  <th scope="col">Status</th>
                  <th scope="col">Found</th>
                </tr>
              </thead>
              <tbody>
                {sporeListings.map((l) => {
                  const href = normalizeUrl(l.source_url);
                  return (
                    <tr key={l.id}>
                      <td><b>{l.vendor_name || "—"}</b></td>
                      <td>
                        {href ? (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="row-anchor">
                            {displayUrl(l.source_url)} ↗
                          </a>
                        ) : (
                          l.product_title || "—"
                        )}
                      </td>
                      <td>
                        {l.in_stock ? (
                          <Badge tone="green">in stock{l.price ? ` · ${l.price}` : ""}</Badge>
                        ) : (
                          <Badge tone="muted">listed</Badge>
                        )}
                      </td>
                      <td className="muted">{l.found_at?.slice(0, 10) ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div style={{ marginTop: 12 }}>
            <RunSporeCrawlButton strainId={strain.id} />
          </div>
        </Card>
      )}

      <Card title="Batches">
        {batches.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No batches recorded for this strain.</p>
        ) : (
          <table>
            <caption className="sr-only">Batches for {strain.name}</caption>
            <thead>
              <tr>
                <th scope="col">Lot</th>
                <th scope="col">Container</th>
                <th scope="col">Stage</th>
                <th scope="col" className="right">Units</th>
                <th scope="col">Inoculated</th>
                <th scope="col" className="right">Rating</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="row-link">
                  <td>
                    <Link href={`/batches/${b.id}`} className="row-anchor">
                      <b>{b.lot_code}</b>
                    </Link>
                  </td>
                  <td>{b.container_id || "—"}</td>
                  <td><Badge tone="muted">{b.stage}</Badge></td>
                  <td className="right">{b.block_count}</td>
                  <td>{b.inoculated_on ?? "—"}</td>
                  <td className="right">{b.rating ? `${b.rating}/10` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Recent harvests">
        {harvests.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No harvests recorded.</p>
        ) : (
          <table>
            <caption className="sr-only">Recent harvests for {strain.name}</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Lot</th>
                <th scope="col" className="right">Flush</th>
                <th scope="col" className="right">Fresh (g)</th>
                <th scope="col" className="right">Dry (g)</th>
                <th scope="col" className="right">Ratio</th>
              </tr>
            </thead>
            <tbody>
              {harvests.map((h) => (
                <tr key={h.harvest_id} className={h.below_floor ? "flag-low" : ""}>
                  <td>{h.harvested_on}</td>
                  <td>{h.lot_code ?? "—"}</td>
                  <td className="right">F{h.flush_number}</td>
                  <td className="right">{h.fresh_g}</td>
                  <td className="right">{h.dry_g}</td>
                  <td className="right">
                    {h.dry_ratio_pct}%{h.below_floor ? " ⚠" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {strain.notes && (
        <Card title="Notes" variant="quiet">
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{strain.notes}</p>
        </Card>
      )}
    </>
  );
}
