"use client";

import { useId } from "react";
import { kgToLb } from "@/lib/format";
import PresetMaterialsField, {
  type InventoryOption,
  type MaterialInitial,
} from "./PresetMaterialsField";

interface Option {
  id: number;
  name: string;
}

export interface PresetInitial {
  name: string;
  strain_id: number | null;
  recipe_id: number | null;
  room_id: number | null;
  container_type: string;
  tub_size: string | null;
  spawn_type: string | null;
  substrate_type: string | null;
  bag_type: string | null;
  block_count: number;
  substrate_weight_kg: number;
  spawn_weight_kg: number;
  notes: string | null;
  materials: MaterialInitial[];
}

interface PresetFieldsProps {
  strains: Option[];
  recipes: Option[];
  rooms: Option[];
  items: InventoryOption[];
  /** When set, every field is prefilled from the existing preset. */
  initial?: PresetInitial;
}

const fk = (v: number | null | undefined) => (v == null ? "" : String(v));

// The full labelled field set for a tub preset, shared by the add form and the
// edit dialog so the two can never drift apart.
export default function PresetFields({
  strains,
  recipes,
  rooms,
  items,
  initial,
}: PresetFieldsProps) {
  const ids = {
    name: useId(),
    strain: useId(),
    recipe: useId(),
    room: useId(),
    container: useId(),
    tubSize: useId(),
    spawn: useId(),
    spawnWeight: useId(),
    substrate: useId(),
    substrateWeight: useId(),
    bag: useId(),
    blocks: useId(),
    notes: useId(),
  };

  return (
    <>
      <div>
        <label htmlFor={ids.name}>Preset name</label>
        <input
          id={ids.name}
          name="name"
          type="text"
          required
          placeholder="Golden Teacher monotub"
          defaultValue={initial?.name ?? ""}
        />
      </div>
      <div>
        <label htmlFor={ids.strain}>Spores / strain</label>
        <select id={ids.strain} name="strain_id" defaultValue={fk(initial?.strain_id)}>
          <option value="">(pick when starting)</option>
          {strains.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={ids.recipe}>Substrate recipe</label>
        <select id={ids.recipe} name="recipe_id" defaultValue={fk(initial?.recipe_id)}>
          <option value="">(none)</option>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={ids.room}>Default room</label>
        <select id={ids.room} name="room_id" defaultValue={fk(initial?.room_id)}>
          <option value="">(unassigned)</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={ids.container}>Container type</label>
        <select
          id={ids.container}
          name="container_type"
          defaultValue={initial?.container_type ?? "tub"}
        >
          <option value="tub">tub</option>
          <option value="grain_bag">grain_bag</option>
          <option value="aio">aio</option>
        </select>
      </div>
      <div>
        <label htmlFor={ids.tubSize}>Tub size</label>
        <input
          id={ids.tubSize}
          name="tub_size"
          type="text"
          placeholder="32 qt monotub"
          defaultValue={initial?.tub_size ?? ""}
        />
      </div>
      <div>
        <label htmlFor={ids.spawn}>Spawn type</label>
        <input
          id={ids.spawn}
          name="spawn_type"
          type="text"
          placeholder="rye berries / WBS"
          defaultValue={initial?.spawn_type ?? ""}
        />
      </div>
      <div>
        <label htmlFor={ids.spawnWeight}>Spawn (lb)</label>
        <input
          id={ids.spawnWeight}
          name="spawn_weight_lb"
          type="number"
          min={0}
          step="0.1"
          defaultValue={initial ? kgToLb(initial.spawn_weight_kg) : 0}
        />
        {/* The shown pounds are rounded; carry the stored kg along so an
            untouched weight round-trips exactly (see weightKg in actions). */}
        {initial && (
          <input
            type="hidden"
            name="__orig_spawn_weight_kg"
            value={String(initial.spawn_weight_kg ?? 0)}
          />
        )}
      </div>
      <div>
        <label htmlFor={ids.substrate}>Substrate type</label>
        <input
          id={ids.substrate}
          name="substrate_type"
          type="text"
          placeholder="CVG / manure"
          defaultValue={initial?.substrate_type ?? ""}
        />
      </div>
      <div>
        <label htmlFor={ids.substrateWeight}>Substrate (lb)</label>
        <input
          id={ids.substrateWeight}
          name="substrate_weight_lb"
          type="number"
          min={0}
          step="0.1"
          defaultValue={initial ? kgToLb(initial.substrate_weight_kg) : 0}
        />
        {initial && (
          <input
            type="hidden"
            name="__orig_substrate_weight_kg"
            value={String(initial.substrate_weight_kg ?? 0)}
          />
        )}
      </div>
      <div>
        <label htmlFor={ids.bag}>Bag type</label>
        <input
          id={ids.bag}
          name="bag_type"
          type="text"
          placeholder="Unicorn 3T grain bag"
          defaultValue={initial?.bag_type ?? ""}
        />
      </div>
      <div>
        <label htmlFor={ids.blocks}>Units per batch</label>
        <input
          id={ids.blocks}
          name="block_count"
          type="number"
          min={0}
          defaultValue={initial?.block_count ?? 0}
        />
      </div>

      <PresetMaterialsField items={items} initial={initial?.materials} />

      <div className="full">
        <label htmlFor={ids.notes}>Notes</label>
        <textarea id={ids.notes} name="notes" rows={2} defaultValue={initial?.notes ?? ""} />
      </div>
    </>
  );
}
