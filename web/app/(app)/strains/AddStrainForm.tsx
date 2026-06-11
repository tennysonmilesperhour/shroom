"use client";

import { useId } from "react";
import EntityForm from "@/components/EntityForm";
import { addStrain } from "./actions";

export default function AddStrainForm() {
  const ids = {
    name: useId(), type: useId(), species: useId(), code: useId(),
    vendor: useId(), genetics: useId(), potency: useId(), ease: useId(),
    temp: useId(), hum: useId(), co2: useId(), be: useId(),
    syringes: useId(), status: useId(), priority: useId(), notes: useId(),
  };
  return (
    <EntityForm action={addStrain} submitLabel="Add strain">
      <div>
        <label htmlFor={ids.name}>Name</label>
        <input id={ids.name} name="name" type="text" required />
      </div>
      <div>
        <label htmlFor={ids.type}>Type</label>
        <select id={ids.type} name="mushroom_type" defaultValue="functional">
          <option value="psychedelic">psychedelic</option>
          <option value="functional">functional</option>
          <option value="gourmet">gourmet</option>
        </select>
      </div>
      <div>
        <label htmlFor={ids.species}>Species</label>
        <input id={ids.species} name="species" type="text" />
      </div>
      <div>
        <label htmlFor={ids.code}>Code</label>
        <input id={ids.code} name="strain_code" type="text" />
      </div>
      <div>
        <label htmlFor={ids.vendor}>Vendor</label>
        <input id={ids.vendor} name="vendor" type="text" />
      </div>
      <div>
        <label htmlFor={ids.genetics}>Genetics / lineage</label>
        <input id={ids.genetics} name="genetics" type="text" />
      </div>
      <div>
        <label htmlFor={ids.potency}>Potency</label>
        <input id={ids.potency} name="potency" type="text" />
      </div>
      <div>
        <label htmlFor={ids.ease}>Ease (1-10)</label>
        <input id={ids.ease} name="ease_rating" type="number" min={1} max={10} defaultValue={5} />
      </div>
      <div>
        <label htmlFor={ids.temp}>Target temp (°F)</label>
        <input id={ids.temp} name="target_temp_f" type="number" min={50} max={95} defaultValue={70} />
      </div>
      <div>
        <label htmlFor={ids.hum}>Target humidity (%)</label>
        <input id={ids.hum} name="target_humidity" type="number" min={0} max={100} defaultValue={90} />
      </div>
      <div>
        <label htmlFor={ids.co2}>Target CO₂ (ppm)</label>
        <input id={ids.co2} name="target_co2_ppm" type="number" min={300} max={5000} defaultValue={800} />
      </div>
      <div>
        <label htmlFor={ids.be}>Typical BE (%)</label>
        <input id={ids.be} name="typical_be" type="number" min={0} max={200} defaultValue={75} />
      </div>
      <div>
        <label htmlFor={ids.syringes}>Syringes on hand</label>
        <input id={ids.syringes} name="syringes_on_hand" type="number" min={0} defaultValue={0} />
      </div>
      <div>
        <label htmlFor={ids.status}>Library status</label>
        <select id={ids.status} name="library_status" defaultValue="active">
          <option value="active">active</option>
          <option value="colonizing">colonizing</option>
          <option value="inoculating">inoculating</option>
          <option value="fridge">fridge</option>
          <option value="awaiting">awaiting</option>
          <option value="ordered">ordered</option>
          <option value="en_route">en route</option>
          <option value="unknown">unknown — auto-search sources</option>
        </select>
      </div>
      <div>
        <label htmlFor={ids.priority}>Priority (1-5)</label>
        <input id={ids.priority} name="priority" type="number" min={1} max={5} />
      </div>
      <div className="full">
        <label htmlFor={ids.notes}>Notes</label>
        <textarea id={ids.notes} name="notes" rows={2} />
      </div>
    </EntityForm>
  );
}
