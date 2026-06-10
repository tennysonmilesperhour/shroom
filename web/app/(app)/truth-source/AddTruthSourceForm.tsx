"use client";

import { useId } from "react";
import EntityForm from "@/components/EntityForm";
import { addTruthSource } from "./actions";

export default function AddTruthSourceForm() {
  const labelId = useId();
  const urlId = useId();
  const catId = useId();
  const heightId = useId();
  const notesId = useId();

  return (
    <EntityForm action={addTruthSource} submitLabel="Add source">
      <div>
        <label htmlFor={labelId}>Label</label>
        <input id={labelId} name="label" type="text" required placeholder="Master cultivation sheet" />
      </div>
      <div>
        <label htmlFor={catId}>Category</label>
        <select id={catId} name="category" defaultValue="general">
          <option value="general">General</option>
          <option value="cultivation">Cultivation</option>
          <option value="sales">Sales</option>
          <option value="finance">Finance</option>
          <option value="inventory">Inventory</option>
        </select>
      </div>
      <div className="full">
        <label htmlFor={urlId}>Google Sheets URL</label>
        <input
          id={urlId}
          name="url"
          type="url"
          required
          placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
        />
      </div>
      <div>
        <label htmlFor={heightId}>Embed height (px)</label>
        <input id={heightId} name="height" type="number" min={160} max={2000} step={20} defaultValue={540} />
      </div>
      <div className="full">
        <label htmlFor={notesId}>Notes</label>
        <textarea id={notesId} name="notes" rows={2} placeholder="What this source feeds" />
      </div>
    </EntityForm>
  );
}
