import Link from "next/link";
import { createServiceClient } from "@/utils/supabase/service";
import { Badge } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { ease, stars } from "@/lib/format";
import { must } from "@/lib/query";
import AddPanel from "@/components/AddPanel";
import AddStrainForm from "./AddStrainForm";
import RowActions from "@/components/RowActions";

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
  typical_be: number | null;
  typical_flushes: number | null;
  syringes_on_hand: number | null;
  library_status: string | null;
  grow_again: boolean;
  active: boolean | null;
  notes: string | null;
  generation: number;
  priority: number | null;
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
        "id,name,species,strain_code,mushroom_type,vendor,genetics,potency,ease_rating,typical_be,typical_flushes,syringes_on_hand,library_status,grow_again,active,notes,generation,priority",
      )
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

      <AddPanel label="New strain">
        <AddStrainForm />
      </AddPanel>

      {strains.length === 0 ? (
        <div className="card quiet">
          <p className="muted" style={{ margin: 0 }}>The strain library is empty.</p>
        </div>
      ) : (
        <div className="strain-grid">
          {strains.map((s) => (
            <div key={s.id} className="strain-card-wrap">
            <Link href={`/strains/${s.id}`} className="strain-card">
              <div className="strain-card-top">
                <span className="strain-card-name">{s.name}</span>
                <Badge tone={typeTone(s.mushroom_type)}>{s.mushroom_type}</Badge>
              </div>
              <div className="strain-card-meta">
                <span>F{s.generation}</span>
                <span>Ease {ease(s.ease_rating)}</span>
                <span>BE {s.typical_be ?? "-"}%</span>
                <span>{s.syringes_on_hand ?? 0} syringes</span>
              </div>
              <div className="strain-card-bottom">
                <span
                  className="stars"
                  aria-label={`Priority ${s.priority ?? 0} of 5`}
                >
                  {stars(s.priority)}
                </span>
                {s.library_status && <Badge tone="muted">{s.library_status}</Badge>}
                {s.grow_again ? (
                  <Badge tone="green">grow again</Badge>
                ) : (
                  <Badge tone="red">retire</Badge>
                )}
              </div>
            </Link>
            <div className="strain-card-actions">
              <RowActions
                entity="strain"
                id={s.id}
                label={s.name}
                viewHref={`/strains/${s.id}`}
                initial={{
                  name: s.name,
                  species: s.species,
                  strain_code: s.strain_code,
                  mushroom_type: s.mushroom_type,
                  vendor: s.vendor,
                  genetics: s.genetics,
                  potency: s.potency,
                  ease_rating: s.ease_rating,
                  typical_be: s.typical_be,
                  typical_flushes: s.typical_flushes,
                  syringes_on_hand: s.syringes_on_hand,
                  library_status: s.library_status,
                  grow_again: s.grow_again,
                  active: s.active,
                  notes: s.notes,
                }}
              />
            </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
