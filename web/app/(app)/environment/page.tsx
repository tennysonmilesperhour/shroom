import { createServiceClient } from "@/utils/supabase/service";
import { Badge, Card } from "@/components/ui";
import { cToF } from "@/lib/format";
import { must, soft } from "@/lib/query";
import AddPanel from "@/components/AddPanel";
import RowActions from "@/components/RowActions";
import TentBoard, { type TentRoom, type TentBatch } from "@/components/TentBoard";
import AddRoomForm from "./AddRoomForm";

export const dynamic = "force-dynamic";

type RoomStatus = TentRoom;

interface RoomRow {
  id: number;
  name: string;
  room_type: string;
  capacity_blocks: number | null;
  target_temp_c: number | null;
  target_humidity: number | null;
  target_co2_ppm: number | null;
  target_fae_per_hr: number | null;
  notes: string | null;
}

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

  // Raw room rows back the edit dialog: the status view omits capacity/notes
  // and only carries computed fields, so pull the source rows for editing.
  const roomRows = await soft<RoomRow>(
    supabase
      .from("rooms")
      .select(
        "id,name,room_type,capacity_blocks,target_temp_c,target_humidity,target_co2_ppm,target_fae_per_hr,notes",
      ),
  );
  const roomsById = new Map(roomRows.map((r) => [r.id, r]));

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

      <AddPanel label="Add a room / tent" buttonLabel="Add a room / tent">
        <AddRoomForm />
      </AddPanel>

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
                <th scope="col"><span className="sr-only">Actions</span></th>
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
                  <td className="actions-col">
                    {(() => {
                      const r = roomsById.get(e.room_id);
                      if (!r) return null;
                      return (
                        <RowActions
                          entity="room"
                          id={r.id}
                          label={r.name}
                          initial={{
                            name: r.name,
                            room_type: r.room_type,
                            capacity_blocks: r.capacity_blocks,
                            target_temp_c: r.target_temp_c,
                            target_humidity: r.target_humidity,
                            target_co2_ppm: r.target_co2_ppm,
                            target_fae_per_hr: r.target_fae_per_hr,
                            notes: r.notes,
                          }}
                        />
                      );
                    })()}
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
