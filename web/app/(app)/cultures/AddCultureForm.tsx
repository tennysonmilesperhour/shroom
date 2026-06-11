"use client";

import { useId } from "react";
import EntityForm from "@/components/EntityForm";
import { addCulture } from "./actions";
import { CULTURE_STATUSES, CULTURE_TYPES } from "./constants";

interface StrainOption {
  id: number;
  name: string;
}

export default function AddCultureForm({ strains }: { strains: StrainOption[] }) {
  const labelId = useId();
  const typeId = useId();
  const strainId = useId();
  const statusId = useId();
  const qtyId = useId();
  const unitId = useId();
  const threshId = useId();
  const locId = useId();
  const sourceId = useId();
  const acquiredId = useId();
  const expiresId = useId();
  const notesId = useId();

  return (
    <EntityForm action={addCulture} submitLabel="Add culture">
      <div>
        <label htmlFor={labelId}>Label</label>
        <input id={labelId} name="label" type="text" placeholder="GT spore syringe #1" required />
      </div>
      <div>
        <label htmlFor={typeId}>Type</label>
        <select id={typeId} name="culture_type" defaultValue="spore_syringe">
          {CULTURE_TYPES.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={strainId}>Strain</label>
        <select id={strainId} name="strain_id" defaultValue="">
          <option value="">— Unassigned —</option>
          {strains.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={statusId}>Stage</label>
        <select id={statusId} name="status" defaultValue="stored">
          {CULTURE_STATUSES.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={qtyId}>On hand</label>
        <input id={qtyId} name="quantity_on_hand" type="number" min={0} step="0.01" defaultValue={1} />
      </div>
      <div>
        <label htmlFor={unitId}>Unit</label>
        <input id={unitId} name="unit" type="text" defaultValue="unit" />
      </div>
      <div>
        <label htmlFor={threshId}>Reorder at</label>
        <input id={threshId} name="reorder_threshold" type="number" min={0} step="0.01" defaultValue={0} />
      </div>
      <div>
        <label htmlFor={locId}>Location</label>
        <input id={locId} name="location" type="text" placeholder="fridge shelf A / incubator" />
      </div>
      <div>
        <label htmlFor={sourceId}>Source</label>
        <input id={sourceId} name="source" type="text" placeholder="vendor or clone parent" />
      </div>
      <div>
        <label htmlFor={acquiredId}>Acquired</label>
        <input id={acquiredId} name="acquired_on" type="date" />
      </div>
      <div>
        <label htmlFor={expiresId}>Use by</label>
        <input id={expiresId} name="expires_on" type="date" />
      </div>
      <div>
        <label htmlFor={notesId}>Notes</label>
        <input id={notesId} name="notes" type="text" />
      </div>
    </EntityForm>
  );
}
