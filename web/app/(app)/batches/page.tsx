import Link from "next/link";
import { createServiceClient } from "@/utils/supabase/service";
import { Badge, Card, stageTone } from "@/components/ui";
import GenerateTasks from "@/components/GenerateTasks";
import { must } from "@/lib/query";
import AddPanel from "@/components/AddPanel";
import AddBatchForm from "./AddBatchForm";
import RowActions from "@/components/RowActions";
import { STAGE_ORDER, STAGE_LABEL, normalizeStage, type Stage } from "@/lib/stages";

export const dynamic = "force-dynamic";

const STAGES = STAGE_ORDER;

interface BatchRow {
  id: number;
  lot_code: string;
  stage: string;
  block_count: number;
  substrate_weight_kg: number;
  inoculated_on: string | null;
  room_id: number | null;
  strain_id: number;
  container_id: string | null;
  container_type: string | null;
  contamination_flag: boolean;
  rating: number | null;
  notes: string | null;
  strains: { name: string } | null;
  rooms: { name: string } | null;
}

interface ProtocolRow {
  id: number;
  name: string;
}

interface StrainOpt {
  id: number;
  name: string;
}
interface RoomOpt {
  id: number;
  name: string;
}

export default async function BatchesPage() {
  const supabase = createServiceClient();
  const [batches, protocols, strainOpts, roomOpts] = await Promise.all([
    must<BatchRow[]>(
      supabase
        .from("batches")
        .select("*, strains(name), rooms(name)")
        .order("created_at", { ascending: false }),
      "load batches",
    ),
    must<ProtocolRow[]>(supabase.from("protocols").select("id,name").order("name"), "load protocols"),
    must<StrainOpt[]>(supabase.from("strains").select("id,name").order("name"), "load strains"),
    must<RoomOpt[]>(supabase.from("rooms").select("id,name").order("name"), "load rooms"),
  ]);

  const byStage = (s: Stage) => batches.filter((b) => normalizeStage(b.stage) === s);

  const strainOptions = strainOpts.map((s) => ({ value: String(s.id), label: s.name }));
  const roomOptions = [
    { value: "", label: "(unassigned)" },
    ...roomOpts.map((r) => ({ value: String(r.id), label: r.name })),
  ];

  return (
    <>
      <div>
        <div className="eyebrow">Production</div>
        <h1 className="section">Batches in cycle</h1>
        <p className="lead">
          Each batch is a traceable lot moving container-by-container through the lifecycle.
        </p>
      </div>

      <AddPanel label="New batch" buttonLabel="Inoculate new batch">
        <AddBatchForm strains={strainOpts} rooms={roomOpts} />
      </AddPanel>

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
                  <p className="muted" style={{ fontSize: 12, margin: 0 }}>-</p>
                ) : (
                  items.map((b) => (
                    <Link
                      key={b.id}
                      href={`/batches/${b.id}`}
                      className="chip chip-link"
                    >
                      <b>{b.container_id || b.lot_code}</b>{" "}
                      {b.contamination_flag && (
                        <Badge tone="red">
                          <span className="sr-only">Contaminated</span>!
                        </Badge>
                      )}
                      <div className="meta">
                        {b.strains?.name ?? "?"} · {b.lot_code}
                      </div>
                    </Link>
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
            name: `${b.container_id || b.lot_code} - ${b.strains?.name ?? ""}`,
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
                <th scope="col" className="actions-col"><span className="sr-only">Actions</span></th>
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
                  <td>
                    {b.container_id || "-"}
                    <span className="muted"> {b.container_type}</span>
                  </td>
                  <td>{b.strains?.name ?? "?"}</td>
                  <td>
                    <Badge tone={stageTone(normalizeStage(b.stage))}>{normalizeStage(b.stage)}</Badge>
                  </td>
                  <td>{b.rooms?.name ?? "-"}</td>
                  <td className="right">{b.block_count}</td>
                  <td className="right">{b.substrate_weight_kg} kg</td>
                  <td>{b.inoculated_on ?? "-"}</td>
                  <td className="right">{b.rating ? `${b.rating}/10` : "-"}</td>
                  <td className="actions-col">
                    <RowActions
                      entity="batch"
                      id={b.id}
                      viewHref={`/batches/${b.id}`}
                      label={b.lot_code}
                      options={{ strain_id: strainOptions, room_id: roomOptions }}
                      initial={{
                        lot_code: b.lot_code,
                        strain_id: b.strain_id,
                        room_id: b.room_id,
                        stage: normalizeStage(b.stage),
                        container_type: b.container_type,
                        container_id: b.container_id,
                        block_count: b.block_count,
                        substrate_weight_kg: b.substrate_weight_kg,
                        inoculated_on: b.inoculated_on,
                        rating: b.rating,
                        notes: b.notes,
                      }}
                    />
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
