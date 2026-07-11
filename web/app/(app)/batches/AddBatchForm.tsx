"use client";

import { useId, useState } from "react";
import EntityForm from "@/components/EntityForm";
import { addBatch } from "./actions";
import { STAGE_ORDER, STAGE_LABEL } from "@/lib/stages";
import { kgToLb } from "@/lib/format";

interface Option {
  id: number;
  name: string;
}

export interface PresetOption {
  id: number;
  name: string;
  strain_id: number | null;
  room_id: number | null;
  container_type: string;
  tub_size: string;
  spawn_type: string;
  substrate_type: string;
  bag_type: string;
  block_count: number;
  substrate_weight_kg: number;
  material_count: number;
}

interface AddBatchFormProps {
  strains: Option[];
  rooms: Option[];
  presets: PresetOption[];
}

export default function AddBatchForm({ strains, rooms, presets }: AddBatchFormProps) {
  const ids = {
    preset: useId(), lot: useId(), strain: useId(), room: useId(), stage: useId(),
    container: useId(), containerId: useId(), blocks: useId(), tubSize: useId(),
    spawn: useId(), substrateType: useId(), bag: useId(), substrate: useId(),
    inoc: useId(), notes: useId(), deduct: useId(),
  };

  // The picked preset id drives prefill. Bumping it as the EntityForm `key`
  // remounts the (uncontrolled) inputs so they pick up the new defaultValues —
  // every field stays editable afterward, and reset-on-success still works.
  const [presetId, setPresetId] = useState<string>("");
  const preset = presets.find((p) => String(p.id) === presetId) ?? null;

  return (
    <>
      {presets.length > 0 && (
        <div className="add-panel-preset">
          <label htmlFor={ids.preset}>Start from preset</label>
          <select
            id={ids.preset}
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
          >
            <option value="">(blank — fill in manually)</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <EntityForm key={presetId || "blank"} action={addBatch} submitLabel="Add batch">
        <input type="hidden" name="preset_id" defaultValue={preset ? String(preset.id) : ""} />
        <div>
          <label htmlFor={ids.lot}>Lot code</label>
          <input id={ids.lot} name="lot_code" type="text" required placeholder="QB-2026-001" />
        </div>
        <div>
          <label htmlFor={ids.strain}>Strain</label>
          <select
            id={ids.strain}
            name="strain_id"
            required
            defaultValue={preset?.strain_id != null ? String(preset.strain_id) : ""}
          >
            <option value="" disabled>Pick a strain…</option>
            {strains.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={ids.room}>Room</label>
          <select
            id={ids.room}
            name="room_id"
            defaultValue={preset?.room_id != null ? String(preset.room_id) : ""}
          >
            <option value="">(unassigned)</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={ids.stage}>Stage</label>
          <select id={ids.stage} name="stage" defaultValue="colonization">
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>{STAGE_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={ids.container}>Container type</label>
          <select
            id={ids.container}
            name="container_type"
            defaultValue={preset?.container_type || "tub"}
          >
            <option value="tub">tub</option>
            <option value="grain_bag">grain_bag</option>
            <option value="aio">aio</option>
          </select>
        </div>
        <div>
          <label htmlFor={ids.containerId}>Container ID</label>
          <input id={ids.containerId} name="container_id" type="text" placeholder="T-12 / GB-04" />
        </div>
        <div>
          <label htmlFor={ids.tubSize}>Tub size</label>
          <input
            id={ids.tubSize}
            name="tub_size"
            type="text"
            placeholder="32 qt monotub"
            defaultValue={preset?.tub_size ?? ""}
          />
        </div>
        <div>
          <label htmlFor={ids.spawn}>Spawn type</label>
          <input
            id={ids.spawn}
            name="spawn_type"
            type="text"
            placeholder="rye berries"
            defaultValue={preset?.spawn_type ?? ""}
          />
        </div>
        <div>
          <label htmlFor={ids.substrateType}>Substrate type</label>
          <input
            id={ids.substrateType}
            name="substrate_type"
            type="text"
            placeholder="CVG"
            defaultValue={preset?.substrate_type ?? ""}
          />
        </div>
        <div>
          <label htmlFor={ids.bag}>Bag type</label>
          <input
            id={ids.bag}
            name="bag_type"
            type="text"
            placeholder="Unicorn 3T"
            defaultValue={preset?.bag_type ?? ""}
          />
        </div>
        <div>
          <label htmlFor={ids.blocks}>Units</label>
          <input
            id={ids.blocks}
            name="block_count"
            type="number"
            min={0}
            defaultValue={preset?.block_count ?? 0}
          />
        </div>
        <div>
          <label htmlFor={ids.substrate}>Substrate (lb)</label>
          <input
            id={ids.substrate}
            name="substrate_weight_lb"
            type="number"
            min={0}
            step="0.1"
            defaultValue={kgToLb(preset?.substrate_weight_kg ?? 0)}
          />
        </div>
        <div>
          <label htmlFor={ids.inoc}>Inoculated on</label>
          <input id={ids.inoc} name="inoculated_on" type="date" />
        </div>
        <div className="full">
          <label htmlFor={ids.notes}>Notes</label>
          <textarea id={ids.notes} name="notes" rows={2} />
        </div>

        {preset && preset.material_count > 0 && (
          <div className="full preset-deduct">
            <label htmlFor={ids.deduct}>
              <input id={ids.deduct} name="deduct_materials" type="checkbox" defaultChecked />
              {" "}Draw {preset.material_count} material
              {preset.material_count === 1 ? "" : "s"} from inventory and log them on this batch
            </label>
          </div>
        )}
      </EntityForm>
    </>
  );
}
