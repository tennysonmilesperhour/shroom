import Link from "next/link";
import { createServiceClient } from "@/utils/supabase/service";
import { Badge } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { must } from "@/lib/query";
import { QualityBars, strainQualities } from "@/components/QualityBars";
import AddPanel from "@/components/AddPanel";
import AddStrainForm from "./AddStrainForm";
import AlkaloidSpectrum from "@/components/AlkaloidSpectrum";
import type { SpectrumStrain } from "@/lib/spectrum";

export const dynamic = "force-dynamic";

interface StrainRow {
  id: number;
  name: string;
  mushroom_type: string;
  vendor: string | null;
  potency: string | null;
  ease_rating: number | null;
  grow_again: boolean;
  generation: number;
  typical_be: number | null;
  syringes_on_hand: number | null;
  library_status: string | null;
  priority: number | null;
  potency_tier: string | null;
  alkaloid_total_pct: number | null;
  alkaloid_total_low_pct: number | null;
  alkaloid_total_high_pct: number | null;
  spectrum_hue: number | null;
  evidence_grade: string | null;
  experience_tags: string[] | null;
}

function typeTone(t: string): BadgeTone {
  if (t === "psychedelic") return "blue";
  if (t === "functional") return "green";
  return "amber";
}

export default async function StrainsPage() {
  const supabase = createServiceClient();
  const strains = await must<StrainRow[]>(
    supabase
      .from("strains")
      .select(
        "id,name,mushroom_type,vendor,potency,ease_rating,grow_again,generation,typical_be,syringes_on_hand,library_status,priority,potency_tier,alkaloid_total_pct,alkaloid_total_low_pct,alkaloid_total_high_pct,spectrum_hue,evidence_grade,experience_tags",
      )
      .order("library_status")
      .order("name"),
    "load strain library",
  );

  const spectrum: SpectrumStrain[] = strains
    .filter((s) => s.mushroom_type === "psychedelic" && s.spectrum_hue != null)
    .map((s) => ({
      id: s.id,
      name: s.name,
      totalPct: s.alkaloid_total_pct,
      lowPct: s.alkaloid_total_low_pct,
      highPct: s.alkaloid_total_high_pct,
      hue: s.spectrum_hue as number,
      potencyTier: s.potency_tier,
      evidenceGrade: s.evidence_grade,
      tags: s.experience_tags ?? [],
    }));

  return (
    <>
      <div>
        <div className="eyebrow">Genetics</div>
        <h1 className="section">Strain library</h1>
        <p className="lead">
          {strains.length} strains tracked across vendor, genetics, potency, ease, grow-again status, and spore stock.
        </p>
      </div>

      <AddPanel label="New strain">
        <AddStrainForm />
      </AddPanel>

      {spectrum.length > 0 && (
        <section className="card spectrum-card">
          <div className="spectrum-head">
            <div>
              <div className="eyebrow">Medicinal spectrum</div>
              <h3 style={{ margin: "2px 0 0" }}>Psilocybe alkaloid &amp; experience wheel</h3>
            </div>
            <p className="muted spectrum-blurb">
              The {spectrum.length} psychedelic strains arranged by reported character (angle/color) and
              measured potency (distance from center). Total-potency differences between cubensis strains
              are small and dominated by cultivation; the &ldquo;character&rdquo; arc is community lore, not
              proven pharmacology.
            </p>
          </div>
          <AlkaloidSpectrum strains={spectrum} />
          <details className="spectrum-sources">
            <summary>How to read this &amp; sources</summary>
            <p>
              Potency tiers are grounded in lab assays and the Oakland Hyphae <em>Psilocybin Cup</em>
              datasets; experiential &ldquo;personalities&rdquo; are anecdotal and confounded by dose, set
              and setting. Within a single strain, sample-to-sample potency can vary by up to ~100%.
            </p>
            <ul>
              <li>Goff et al., <em>Anal. Chim. Acta</em> 2023 — 5-strain LC-MS/MS cubensis assay (totals 0.88–1.36% w/w).</li>
              <li>Cohen et al., <em>Sci. Rep.</em> 2025 — 42-strain metabolomics; strains cluster by species, each with a distinct minor-alkaloid profile.</li>
              <li>Cooper et al., <em>Eur. Psychiatry</em> 2022 — aeruginascin / entourage-effect review (minor-alkaloid contribution likely limited).</li>
              <li>Oakland Hyphae Psilocybin Cup — record 3.82% total tryptamines (Tidal Wave, 2021).</li>
            </ul>
          </details>
        </section>
      )}

      {strains.length === 0 ? (
        <div className="card quiet">
          <p className="muted" style={{ margin: 0 }}>The strain library is empty.</p>
        </div>
      ) : (
        <div className="strain-grid">
          {strains.map((s) => (
            <Link key={s.id} href={`/strains/${s.id}`} className="strain-card">
              <div className="strain-card-top">
                <span className="strain-card-name">{s.name}</span>
                <Badge tone={typeTone(s.mushroom_type)}>{s.mushroom_type}</Badge>
              </div>
              <div className="strain-card-meta">
                <span>F{s.generation}</span>
                {s.vendor && <span>{s.vendor}</span>}
                <span>{s.syringes_on_hand ?? 0} syringes</span>
              </div>
              <QualityBars qualities={strainQualities(s)} />
              <div className="strain-card-bottom">
                {s.potency_tier && <Badge tone="violet">{s.potency_tier}</Badge>}
                {s.library_status === "unknown" ? (
                  <Badge tone="violet">source: searching</Badge>
                ) : (
                  s.library_status && <Badge tone="muted">{s.library_status}</Badge>
                )}
                {s.grow_again ? (
                  <Badge tone="green">grow again</Badge>
                ) : (
                  <Badge tone="red">retire</Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
