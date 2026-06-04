import { createServiceClient } from "@/utils/supabase/service";
import { Badge, Card, stageTone } from "@/components/ui";
import GenerateTasks from "@/components/GenerateTasks";
import { must } from "@/lib/query";

export const dynamic = "force-dynamic";

const STAGES = [
  "inoculation",
  "colonization",
  "spawn_to_bulk",
  "fruiting",
  "harvesting",
  "spent",
] as const;
type Stage = (typeof STAGES)[number];

const STAGE_LABEL: Record<Stage, string> = {
  inoculation: "Inoculation",
  colonization: "Colonization",
  spawn_to_bulk: "Spawn to bulk",
  fruiting: "Fruiting",
  harvesting: "Harvesting",
  spent: "Spent",
};

interface BatchRow {
  id: number;
  lot_code: string;
  stage: Stage;
  block_count: number;
  substrate_weight_kg: number;
  inoculated_on: string | null;
  container_id: string | null;
  container_type: string | null;
  contamination_flag: boolean;
  rating: number | null;
  strains: { name: string } | null;
  rooms: { name: string } | null;
}

interface ProtocolRow {
  id: number;
  name: string;
}

export default async function BatchesPage() {
  const supabase = createServiceClient();
  const [batches, protocols] = await Promise.all([
    must<BatchRow[]>(
      supabase
        .from("batches")
        .select("*, strains(name), rooms(name)")
        .order("created_at", { ascending: false }),
      "load batches",
    ),
    must<ProtocolRow[]>(supabase.from("protocols").select("id,name").order("name"), "load protocols"),
  ]);

  const byStage = (s: Stage) => batches.filter((b) => b.stage === s);

  return (
    <>
      <div>
        <div className="eyebrow">Production</div>
        <h1 className="section">Batches in <em>cycle</em></h1>
        <p className="lead">
          Each batch is a traceable lot moving container-by-container through the lifecycle.
        </p>
      </div>

      <Card title="Tub / bag board" variant="featured">
        <div className="kanban">
          {STAGES.map((s) => {
            const items = byStage(s);
            return (
              <div className="col" key={s}>
                <h4>
                  {STAGE_LABEL[s]} <span className="muted">· {items.length}</span>
                </h4>
                {items.length === 0 ? (
                  <p className="muted" style={{ fontSize: 12, margin: 0 }}>—</p>
                ) : (
                  items.map((b) => (
                    <div className="chip" key={b.id}>
                      <b>{b.container_id || b.lot_code}</b>{" "}
                      {b.contamination_flag && (
                        <Badge tone="red">
                          <span className="sr-only">Contaminated</span>!
                        </Badge>
                      )}
                      <div className="meta">
                        {b.strains?.name ?? "?"} · {b.lot_code}
                      </div>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Spawn task templates">
        <GenerateTasks
          protocols={protocols}
          batches={batches.map((b) => ({
            id: b.id,
            name: `${b.container_id || b.lot_code} — ${b.strains?.name ?? ""}`,
          }))}
        />
      </Card>

      <Card title="All batches">
        {batches.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No batches recorded. Inoculate your first lot to start the lifecycle.
          </p>
        ) : (
          <table>
            <caption className="sr-only">All batches</caption>
            <thead>
              <tr>
                <th scope="col">Lot</th>
                <th scope="col">Container</th>
                <th scope="col">Strain</th>
                <th scope="col">Stage</th>
                <th scope="col">Room</th>
                <th scope="col" className="right">Units</th>
                <th scope="col" className="right">Substrate</th>
                <th scope="col">Inoculated</th>
                <th scope="col" className="right">Rating</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td><b>{b.lot_code}</b></td>
                  <td>
                    {b.container_id || "—"}
                    <span className="muted"> {b.container_type}</span>
                  </td>
                  <td>{b.strains?.name ?? "?"}</td>
                  <td>
                    <Badge tone={stageTone(b.stage)}>{b.stage}</Badge>
                  </td>
                  <td>{b.rooms?.name ?? "—"}</td>
                  <td className="right">{b.block_count}</td>
                  <td className="right">{b.substrate_weight_kg} kg</td>
                  <td>{b.inoculated_on ?? "—"}</td>
                  <td className="right">{b.rating ? `${b.rating}/10` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
