import { currentCollection } from "@/lib/collection";
import { createServiceClient } from "@/utils/supabase/service";
import { Card } from "@/components/ui";
import GenerateTasks from "@/components/GenerateTasks";
import { must, soft } from "@/lib/query";
import AddPanel from "@/components/AddPanel";
import AddBatchForm, { type PresetOption } from "./AddBatchForm";
import BatchBoard from "./BatchBoard";
import BatchTable, { type SavedBatchView } from "@/components/BatchTable";
import { STAGE_ORDER, STAGE_LABEL, normalizeStage } from "@/lib/stages";

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
  const collection = await currentCollection();
  const [batches, protocols, strainOpts, roomOpts, presetRaw, savedViews] = await Promise.all([
    must<BatchRow[]>(
      supabase
        .from("batches")
        .select("*, strains(name), rooms(name)").in("strain_id", collection.strainIds)
        .order("created_at", { ascending: false }),
      "load batches",
    ),
    must<ProtocolRow[]>(supabase.from("protocols").select("id,name").order("name"), "load protocols"),
    must<StrainOpt[]>(supabase.from("strains").select("id,name").in("id", collection.strainIds).order("name"), "load strains"),
    must<RoomOpt[]>(supabase.from("rooms").select("id,name").order("name"), "load rooms"),
    // soft: degrades to [] if the presets migration hasn't been applied yet, so
    // batch creation never breaks on a not-yet-migrated database.
    soft<PresetRaw>(
      supabase
        .from("batch_presets")
        .select(
          "id,name,strain_id,room_id,container_type,tub_size,spawn_type,substrate_type,bag_type,block_count,substrate_weight_kg, preset_materials(count)",
        )
        .eq("active", true).or(`strain_id.is.null,strain_id.in.(${collection.strainIds.join(",")})`)
        .order("name"),
    ),
    soft<SavedBatchView>(
      supabase
        .from("saved_batch_views")
        .select("id,name,filters,is_favorite")
        .eq("is_favorite", true)
        .order("position")
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
          <BatchTable
            batches={batches.map((b) => ({
              ...b,
              strain: b.strains?.name ?? null,
              room: b.rooms?.name ?? null,
            }))}
            savedViews={savedViews}
            strainOptions={strainOptions}
            roomOptions={roomOptions}
          />
        )}
      </Card>
    </>
  );
}
