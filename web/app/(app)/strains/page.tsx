import { createClient } from "@/utils/supabase/server";
import { Badge } from "@/components/ui";
import { cToF, ease, stars } from "@/lib/format";

export const dynamic = "force-dynamic";

const typeTone = (t: string) => (t === "psychedelic" ? "blue" : t === "functional" ? "green" : "amber");

export default async function StrainsPage() {
  const supabase = await createClient();
  const { data: strains } = await supabase
    .from("strains")
    .select("*, parent:strains!lineage_parent_id(name, generation)")
    .order("library_status")
    .order("name");

  return (
    <>
      <h2 className="section">Strain Library</h2>
      <p className="lead">{strains?.length ?? 0} strains — vendor, genetics, potency, ease, grow-again, and spore stock.</p>
      {(strains ?? []).map((s) => (
        <details className="acc" key={s.id}>
          <summary>
            {s.name}
            <Badge tone={typeTone(s.mushroom_type) as any}>{s.mushroom_type}</Badge>
            {s.library_status && <Badge tone="muted">{s.library_status}</Badge>}
            <span className="stars">{stars(s.priority)}</span>
            {s.grow_again ? <Badge tone="green">grow again</Badge> : <Badge tone="red">retire</Badge>}
          </summary>
          <div className="body">
            <div>Species: <b>{s.species || "—"}</b></div>
            <div>Code: <b>{s.strain_code || "—"}</b></div>
            <div>Vendor: <b>{s.vendor || "—"}</b></div>
            <div>Genetics: <b>{s.genetics || "—"}</b></div>
            <div>Potency: <b>{s.potency || "—"}</b></div>
            <div>Ease: <b>{ease(s.ease_rating)}</b></div>
            <div>Generation: <b>F{s.generation}</b></div>
            <div>Syringes on hand: <b>{s.syringes_on_hand}</b></div>
            <div>Target: <b>{cToF(s.target_temp_c)}°F / {s.target_humidity}% / {s.target_co2_ppm}ppm</b></div>
            <div>Typical BE: <b>{s.typical_be}%</b> over <b>{s.typical_flushes}</b> flushes</div>
            <div>Lineage: <b>{s.parent ? `cloned from ${s.parent.name} (F${s.parent.generation})` : "founder"}</b></div>
            <div style={{ gridColumn: "1/3" }}>Notes: <b>{s.notes || "—"}</b></div>
          </div>
        </details>
      ))}
    </>
  );
}
