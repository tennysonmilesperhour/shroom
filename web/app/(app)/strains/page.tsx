import Link from "next/link";
import { createServiceClient } from "@/utils/supabase/service";
import { Badge } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { must } from "@/lib/query";
import { QualityBars, strainQualities } from "@/components/QualityBars";
import AddPanel from "@/components/AddPanel";
import AddStrainForm from "./AddStrainForm";

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
        "id,name,mushroom_type,vendor,potency,ease_rating,grow_again,generation,typical_be,syringes_on_hand,library_status,priority",
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
