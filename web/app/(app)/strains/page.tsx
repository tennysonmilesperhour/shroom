import { createServiceClient } from "@/utils/supabase/service";
import { Badge } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { cToF, ease, stars } from "@/lib/format";
import { must } from "@/lib/query";

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
  parent: { name: string; generation: number } | null;
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
      .select("*, parent:strains!lineage_parent_id(name, generation)")
      .order("library_status")
      .order("name"),
    "load strain library",
  );

  return (
    <>
      <div>
        <div className="eyebrow">Genetics</div>
        <h1 className="section">Strain library</h1>
        <p className="lead">
          {strains.length} strains tracked across vendor, genetics, potency, ease, grow-again status, and spore stock.
        </p>
      </div>

      {strains.length === 0 ? (
        <div className="card quiet">
          <p className="muted" style={{ margin: 0 }}>The strain library is empty.</p>
        </div>
      ) : (
        strains.map((s) => (
          <details className="acc" key={s.id}>
            <summary>
              {s.name}
              <Badge tone={typeTone(s.mushroom_type)}>{s.mushroom_type}</Badge>
              {s.library_status && <Badge tone="muted">{s.library_status}</Badge>}
              <span
                className="stars"
                aria-label={`Priority ${s.priority ?? 0} of 5`}
              >
                {stars(s.priority)}
              </span>
              {s.grow_again ? (
                <Badge tone="green">grow again</Badge>
              ) : (
                <Badge tone="red">retire</Badge>
              )}
            </summary>
            <div className="body">
              <div>Species: <b>{s.species || "-"}</b></div>
              <div>Code: <b>{s.strain_code || "-"}</b></div>
              <div>Vendor: <b>{s.vendor || "-"}</b></div>
              <div>Genetics: <b>{s.genetics || "-"}</b></div>
              <div>Potency: <b>{s.potency || "-"}</b></div>
              <div>Ease: <b>{ease(s.ease_rating)}</b></div>
              <div>Generation: <b>F{s.generation}</b></div>
              <div>Syringes on hand: <b>{s.syringes_on_hand ?? 0}</b></div>
              <div>
                Target:{" "}
                <b>
                  {cToF(s.target_temp_c)}°F / {s.target_humidity}% / {s.target_co2_ppm}ppm
                </b>
              </div>
              <div>
                Typical BE: <b>{s.typical_be}%</b> over <b>{s.typical_flushes}</b> flushes
              </div>
              <div>
                Lineage:{" "}
                <b>
                  {s.parent
                    ? `cloned from ${s.parent.name} (F${s.parent.generation})`
                    : "founder"}
                </b>
              </div>
              <div style={{ gridColumn: "1/3" }}>
                Notes: <b>{s.notes || "-"}</b>
              </div>
            </div>
          </details>
        ))
      )}
    </>
  );
}
