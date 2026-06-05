"use client";

import { useId } from "react";
import EntityForm from "@/components/EntityForm";
import { addBatch } from "./actions";

interface Option {
  id: number;
  name: string;
}

interface AddBatchFormProps {
  strains: Option[];
  rooms: Option[];
}

export default function AddBatchForm({ strains, rooms }: AddBatchFormProps) {
  const ids = {
    lot: useId(), strain: useId(), room: useId(), stage: useId(),
    container: useId(), containerId: useId(), blocks: useId(),
    substrate: useId(), inoc: useId(), notes: useId(),
  };
  return (
    <EntityForm action={addBatch} submitLabel="Add batch">
      <div>
        <label htmlFor={ids.lot}>Lot code</label>
        <input id={ids.lot} name="lot_code" type="text" required placeholder="QB-2026-001" />
      </div>
      <div>
        <label htmlFor={ids.strain}>Strain</label>
        <select id={ids.strain} name="strain_id" required defaultValue="">
          <option value="" disabled>Pick a strain…</option>
          {strains.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={ids.room}>Room</label>
        <select id={ids.room} name="room_id" defaultValue="">
          <option value="">(unassigned)</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={ids.stage}>Stage</label>
        <select id={ids.stage} name="stage" defaultValue="inoculation">
          <option value="inoculation">inoculation</option>
          <option value="colonization">colonization</option>
          <option value="spawn_to_bulk">spawn_to_bulk</option>
          <option value="fruiting">fruiting</option>
          <option value="harvesting">harvesting</option>
          <option value="spent">spent</option>
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
        <label htmlFor={ids.containerId}>Container ID</label>
        <input id={ids.containerId} name="container_id" type="text" placeholder="T-12 / GB-04" />
      </div>
      <div>
        <label htmlFor={ids.blocks}>Units</label>
        <input id={ids.blocks} name="block_count" type="number" min={0} defaultValue={0} />
      </div>
      <div>
        <label htmlFor={ids.substrate}>Substrate (kg)</label>
        <input
          id={ids.substrate}
          name="substrate_weight_kg"
          type="number"
          min={0}
          step="0.01"
          defaultValue={0}
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
    </EntityForm>
  );
}
