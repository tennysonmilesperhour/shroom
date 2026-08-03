import Link from "next/link";
import { createServiceClient } from "@/utils/supabase/service";
import { Badge, Card, stageTone } from "@/components/ui";
import GenerateTasks from "@/components/GenerateTasks";
import { must, soft } from "@/lib/query";
import AddPanel from "@/components/AddPanel";
import AddBatchForm, { type PresetOption } from "./AddBatchForm";
import BatchBoard from "./BatchBoard";
import RowActions from "@/components/RowActions";
import { STAGE_ORDER, STAGE_LABEL, normalizeStage } from "@/lib/stages";
import { kgToLb } from "@/lib/format";

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
  tub_size: string | null;
  spawn_type: string | null;
  substrate_type: string | null;
  bag_type: string | null;
  colonized_on: string | null;
  fruiting_on: string | null;
  spent_on: string | null;
  contamination_flag: boolean;
  rating: number | null;
  issues: string | null;
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

// Shape returned by the presets read before mapping to the form's PresetOption.
interface PresetRaw {
  id: number;
  name: string;
  strain_id: number | null;
  room_id: number | null;
  container_type: string | null;
  tub_size: string | null;
  spawn_type: string | null;
  substrate_type: string | null;
  bag_type: string | null;
  block_count: number | null;
  substrate_weight_kg: number | null;
  preset_materials: { count: number }[];
}

export default async function BatchesPage() {
  const supabase = createServiceClient();
  const [batches, protocols, strainOpts, roomOpts, presetRaw] = await Promise.all([
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
    // soft: degrades to [] if the presets migration hasn't been applied yet, so
    // batch creation never breaks on a not-yet-migrated database.
    soft<PresetRaw>(
      supabase
        .from("batch_presets")
        .select(
          "id,name,strain_id,room_id,container_type,tub_size,spawn_type,substrate_type,bag_type,block_count,substrate_weight_kg, preset_materials(count)",
        )
        .eq("active", true)
        .order("name"),
    ),
  ]);

  const presets: PresetOption[] = presetRaw.map((p) => ({
    id: p.id,
    name: p.name,
    strain_id: p.strain_id,
    room_id: p.room_id,
    container_type: p.container_type ?? "tub",
    tub_size: p.tub_size ?? "",
    spawn_type: p.spawn_type ?? "",
    substrate_type: p.substrate_type ?? "",
    bag_type: p.bag_type ?? "",
    block_count: p.block_count ?? 0,
    substrate_weight_kg: p.substrate_weight_kg ?? 0,
    material_count: p.preset_materials?.[0]?.count ?? 0,
  }));

  const boardBatches = batches.map((b) => ({
    id: b.id,
    lot_code: b.lot_code,
    stage: normalizeStage(b.stage),
    container_id: b.container_id,
    contamination_flag: b.contamination_flag,
    strain: b.strains?.name ?? null,
  }));

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
        <AddBatchForm strains={strainOpts} rooms={roomOpts} presets={presets} />
      </AddPanel>

      <Card title="Tub / bag board" variant="featured">
        <p className="muted" style={{ marginTop: 0, fontSize: 12.5 }}>
          Drag a tub between columns to move it through the lifecycle. Click to open.
        </p>
        <BatchBoard batches={boardBatches} stages={STAGES} stageLabel={STAGE_LABEL} />
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
                  <td className="right">{kgToLb(b.substrate_weight_kg)} lb</td>
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
                        tub_size: b.tub_size,
                        spawn_type: b.spawn_type,
                        substrate_type: b.substrate_type,
                        bag_type: b.bag_type,
                        block_count: b.block_count,
                        substrate_weight_kg: b.substrate_weight_kg,
                        inoculated_on: b.inoculated_on,
                        colonized_on: b.colonized_on,
                        fruiting_on: b.fruiting_on,
                        spent_on: b.spent_on,
                        rating: b.rating,
                        contamination_flag: b.contamination_flag,
                        issues: b.issues,
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
