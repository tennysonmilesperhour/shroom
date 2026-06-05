"use client";

import { useId } from "react";
import EntityForm from "@/components/EntityForm";
import { addEquipment } from "./actions";

export default function AddEquipmentForm() {
  const nameId = useId();
  const specId = useId();
  const statusId = useId();
  const checkedId = useId();

  return (
    <EntityForm action={addEquipment} submitLabel="Add equipment">
      <div>
        <label htmlFor={nameId}>Name</label>
        <input id={nameId} name="name" type="text" required />
      </div>
      <div>
        <label htmlFor={statusId}>Status</label>
        <select id={statusId} name="status" defaultValue="active">
          <option value="active">active</option>
          <option value="ordered">ordered</option>
          <option value="retired">retired</option>
        </select>
      </div>
      <div className="full">
        <label htmlFor={specId}>Spec / notes</label>
        <input id={specId} name="spec_notes" type="text" />
      </div>
      <div>
        <label htmlFor={checkedId}>Last checked</label>
        <input id={checkedId} name="last_checked" type="text" placeholder="2026-06-01 or note" />
      </div>
    </EntityForm>
  );
}
