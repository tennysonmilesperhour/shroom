import { createServiceClient } from "@/utils/supabase/service";
import { Badge, Card } from "@/components/ui";
import { cToF } from "@/lib/format";
import { must } from "@/lib/query";
import TentBoard, { type TentRoom, type TentBatch } from "@/components/TentBoard";

export const dynamic = "force-dynamic";

type RoomStatus = TentRoom;

interface BatchRow {
  id: number;
  lot_code: string;
  container_id: string | null;
  container_type: string | null;
  stage: string;
  room_id: number | null;
  contamination_flag: boolean;
  strains: { name: string } | null;
}

// Lots that are still in cycle are the ones you place in a tent. Spent and
// contaminated lots have left the active grow, so keep them off the board.
const ACTIVE_STAGES = [
  "inoculation",
  "colonization",
  "spawn_to_bulk",
  "fruiting",
  "harvesting",
];

export default async function EnvironmentPage() {
  const supabase = createServiceClient();
  const [rooms, batchRows] = await Promise.all([
    must<RoomStatus[]>(
      supabase.from("v_environment_status").select("*").order("room"),
      "load environment status",
    ),
    must<BatchRow[]>(
      supabase
        .from("batches")
        .select("*, strains(name)")
        .in("stage", ACTIVE_STAGES)
        .order("created_at", { ascending: false }),
      "load batches",
    ),
  ]);

  const batches: TentBatch[] = batchRows.map((b) => ({
    id: b.id,
    lot_code: b.lot_code,
    container_id: b.container_id,
    container_type: b.container_type,
    stage: b.stage,
    room_id: b.room_id,
    contamination_flag: b.contamination_flag,
    strain: b.strains?.name ?? null,
  }));

  return (
    <>
      <div>
        <div className="eyebrow">Production</div>
        <h1 className="section">Environment monitoring</h1>
        <p className="lead">
          Your tents at a glance — temperature °F · relative humidity · CO₂ · fresh-air
          exchanges, each against target. Drag a lot from one tent to another to
          reassign it; the move syncs everywhere else.
        </p>
      </div>

      {rooms.length === 0 ? (
        <Card variant="quiet">
          <p className="muted" style={{ margin: 0 }}>
            No rooms configured yet, or no sensor readings recorded.
          </p>
        </Card>
      ) : (
        <TentBoard rooms={rooms} batches={batches} />
      )}

      <Card title="Per-room readings" variant="quiet">
        {rooms.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No rooms configured yet.
          </p>
        ) : (
          <table>
            <caption className="sr-only">Latest reading per room vs. target</caption>
            <thead>
              <tr>
                <th scope="col">Tent</th>
                <th scope="col">Type</th>
                <th scope="col" className="right">Temp °F</th>
                <th scope="col" className="right">RH %</th>
                <th scope="col" className="right">CO₂ ppm</th>
                <th scope="col" className="right">FAE /hr</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((e) => (
                <tr key={e.room_id}>
                  <td>
                    <b>{e.room}</b>
                  </td>
                  <td className="muted">{e.room_type.replace(/_/g, " ")}</td>
                  <td className="right">
                    {cToF(e.temp_c) ?? "-"}
                    <span className="muted"> / {cToF(e.target_temp_c)}</span>
                  </td>
                  <td className="right">
                    {e.humidity ?? "-"}
                    <span className="muted"> / {e.target_humidity}</span>
                  </td>
                  <td className="right">
                    {e.co2_ppm ?? "-"}
                    <span className="muted"> / {e.target_co2_ppm}</span>
                  </td>
                  <td className="right">
                    {e.fae_per_hr ?? "-"}
                    <span className="muted"> / {e.target_fae_per_hr}</span>
                  </td>
                  <td>
                    <Badge tone={e.in_spec === false ? "red" : e.in_spec ? "green" : "muted"}>
                      {e.in_spec === null ? "no data" : e.in_spec ? "in spec" : "alert"}
                    </Badge>
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
