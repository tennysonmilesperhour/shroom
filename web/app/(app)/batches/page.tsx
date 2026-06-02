import { createClient } from "@/utils/supabase/server";
import { Badge, Card, stageTone } from "@/components/ui";
import GenerateTasks from "@/components/GenerateTasks";

export const dynamic = "force-dynamic";

const STAGES = ["inoculation", "colonization", "spawn_to_bulk", "fruiting", "harvesting", "spent"];

export default async function BatchesPage() {
  const supabase = await createClient();
  const [{ data: batches }, { data: protocols }] = await Promise.all([
    supabase.from("batches").select("*, strains(name), rooms(name)").order("created_at", { ascending: false }),
    supabase.from("protocols").select("id,name").order("name"),
  ]);

  const all = batches ?? [];
  const byStage = (s: string) => all.filter((b: any) => b.stage === s);

  return (
    <>
      <h2 className="section">Production Batches</h2>
      <p className="lead">Each batch is a traceable lot moving container-by-container through the lifecycle.</p>

      <Card title="Tub / bag board">
        <div className="kanban">
          {STAGES.map((s) => (
            <div className="col" key={s}>
              <h4>{s.replace(/_/g, " ")} · {byStage(s).length}</h4>
              {byStage(s).map((b: any) => (
                <div className="chip" key={b.id}>
                  <b>{b.container_id || b.lot_code}</b> {b.contamination_flag && <Badge tone="red">!</Badge>}
                  <div className="meta">{b.strains?.name ?? "?"} · {b.lot_code}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Generate SOP tasks (#7)">
        <GenerateTasks
          protocols={protocols ?? []}
          batches={all.map((b: any) => ({ id: b.id, name: `${b.container_id || b.lot_code} — ${b.strains?.name ?? ""}` }))}
        />
      </Card>

      <Card title="All batches">
        <table>
          <thead>
            <tr>
              <th>Lot</th><th>Container</th><th>Strain</th><th>Stage</th><th>Room</th>
              <th className="right">Units</th><th className="right">Substrate</th><th>Inoculated</th><th className="right">Rating</th>
            </tr>
          </thead>
          <tbody>
            {all.map((b: any) => (
              <tr key={b.id}>
                <td><b>{b.lot_code}</b></td>
                <td>{b.container_id || "—"}<span className="muted"> {b.container_type}</span></td>
                <td>{b.strains?.name ?? "?"}</td>
                <td><Badge tone={stageTone(b.stage)}>{b.stage}</Badge></td>
                <td>{b.rooms?.name ?? "—"}</td>
                <td className="right">{b.block_count}</td>
                <td className="right">{b.substrate_weight_kg} kg</td>
                <td>{b.inoculated_on ?? "—"}</td>
                <td className="right">{b.rating ? `${b.rating}/10` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
