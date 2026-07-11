"use client";

import { useId } from "react";
import EntityForm from "@/components/EntityForm";
import { addRoom } from "./actions";

// Add a real tent / room. Temperature is entered in °F to match the rest of
// the app; the server action converts it to °C for storage. Newly added rooms
// appear immediately on the board and in the per-room table (the environment
// view left-joins readings, so a room with no sensor data still shows up).
export default function AddRoomForm() {
  const ids = {
    name: useId(),
    type: useId(),
    cap: useId(),
    temp: useId(),
    rh: useId(),
    co2: useId(),
    fae: useId(),
    notes: useId(),
  };

  return (
    <EntityForm action={addRoom} submitLabel="Add room">
      <div>
        <label htmlFor={ids.name}>Name</label>
        <input id={ids.name} name="name" type="text" required placeholder="BoomRoom II #1" />
      </div>
      <div>
        <label htmlFor={ids.type}>Type</label>
        <select id={ids.type} name="room_type" defaultValue="fruiting">
          <option value="fruiting">fruiting</option>
          <option value="incubation">incubation</option>
          <option value="drying">drying</option>
          <option value="lab">lab</option>
          <option value="storage">storage</option>
        </select>
      </div>
      <div>
        <label htmlFor={ids.cap}>Capacity (blocks)</label>
        <input id={ids.cap} name="capacity_blocks" type="number" min={0} defaultValue={0} />
      </div>
      <div>
        <label htmlFor={ids.temp}>Target temp °F</label>
        <input id={ids.temp} name="target_temp_f" type="number" step="1" placeholder="64" />
      </div>
      <div>
        <label htmlFor={ids.rh}>Target humidity %</label>
        <input id={ids.rh} name="target_humidity" type="number" step="1" defaultValue={90} />
      </div>
      <div>
        <label htmlFor={ids.co2}>Target CO₂ ppm</label>
        <input id={ids.co2} name="target_co2_ppm" type="number" defaultValue={800} />
      </div>
      <div>
        <label htmlFor={ids.fae}>Target FAE /hr</label>
        <input id={ids.fae} name="target_fae_per_hr" type="number" step="0.1" defaultValue={4} />
      </div>
      <div className="full">
        <label htmlFor={ids.notes}>Notes</label>
        <textarea id={ids.notes} name="notes" rows={2} placeholder="60–68°F. Heavy FAE." />
      </div>
    </EntityForm>
  );
}
