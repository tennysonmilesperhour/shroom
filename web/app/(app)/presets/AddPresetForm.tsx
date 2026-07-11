"use client";

import { useId } from "react";
import EntityForm from "@/components/EntityForm";
import { addPreset } from "./actions";
import PresetMaterialsField, { type InventoryOption } from "./PresetMaterialsField";

interface Option {
  id: number;
  name: string;
}

interface AddPresetFormProps {
  strains: Option[];
  recipes: Option[];
  rooms: Option[];
  items: InventoryOption[];
}

export default function AddPresetForm({ strains, recipes, rooms, items }: AddPresetFormProps) {
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
    <EntityForm action={addPreset} submitLabel="Save preset">
      <div>
        <label htmlFor={ids.name}>Preset name</label>
        <input
          id={ids.name}
          name="name"
          type="text"
          required
          placeholder="Golden Teacher monotub"
        />
      </div>
      <div>
        <label htmlFor={ids.strain}>Spores / strain</label>
        <select id={ids.strain} name="strain_id" defaultValue="">
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
        <select id={ids.recipe} name="recipe_id" defaultValue="">
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
        <select id={ids.room} name="room_id" defaultValue="">
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
        <select id={ids.container} name="container_type" defaultValue="tub">
          <option value="tub">tub</option>
          <option value="grain_bag">grain_bag</option>
          <option value="aio">aio</option>
        </select>
      </div>
      <div>
        <label htmlFor={ids.tubSize}>Tub size</label>
        <input id={ids.tubSize} name="tub_size" type="text" placeholder="32 qt monotub" />
      </div>
      <div>
        <label htmlFor={ids.spawn}>Spawn type</label>
        <input id={ids.spawn} name="spawn_type" type="text" placeholder="rye berries / WBS" />
      </div>
      <div>
        <label htmlFor={ids.spawnWeight}>Spawn (lb)</label>
        <input
          id={ids.spawnWeight}
          name="spawn_weight_lb"
          type="number"
          min={0}
          step="0.1"
          defaultValue={0}
        />
      </div>
      <div>
        <label htmlFor={ids.substrate}>Substrate type</label>
        <input
          id={ids.substrate}
          name="substrate_type"
          type="text"
          placeholder="CVG / manure"
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
          defaultValue={0}
        />
      </div>
      <div>
        <label htmlFor={ids.bag}>Bag type</label>
        <input id={ids.bag} name="bag_type" type="text" placeholder="Unicorn 3T grain bag" />
      </div>
      <div>
        <label htmlFor={ids.blocks}>Units per batch</label>
        <input id={ids.blocks} name="block_count" type="number" min={0} defaultValue={0} />
      </div>

      <PresetMaterialsField items={items} />

      <div className="full">
        <label htmlFor={ids.notes}>Notes</label>
        <textarea id={ids.notes} name="notes" rows={2} />
      </div>
    </EntityForm>
  );
}
