"use client";

import { useId } from "react";
import EntityForm from "@/components/EntityForm";
import { addVendor } from "./actions";

export default function AddVendorForm() {
  const nameId = useId();
  const catId = useId();
  const prodId = useId();
  const urlId = useId();
  const ratingId = useId();
  const priorityId = useId();
  const notesId = useId();

  return (
    <EntityForm action={addVendor} submitLabel="Add vendor">
      <div>
        <label htmlFor={nameId}>Name</label>
        <input id={nameId} name="name" type="text" required />
      </div>
      <div>
        <label htmlFor={catId}>Category</label>
        <select id={catId} name="category" defaultValue="supplies">
          <option value="spores">Spores &amp; genetics</option>
          <option value="functional">Functional spawn</option>
          <option value="supplies">Supplies</option>
          <option value="sourcing">Wild-harvest sourcing</option>
        </select>
      </div>
      <div className="full">
        <label htmlFor={prodId}>Products</label>
        <input id={prodId} name="products" type="text" placeholder="Comma-separated" />
      </div>
      <div>
        <label htmlFor={urlId}>URL</label>
        <input id={urlId} name="url" type="text" placeholder="northspore.com" />
      </div>
      <div>
        <label htmlFor={ratingId}>Rating (0-5)</label>
        <input id={ratingId} name="rating" type="number" min={0} max={5} step={1} />
      </div>
      <div>
        <label htmlFor={priorityId}>Priority</label>
        <input id={priorityId} name="contact_priority" type="text" placeholder="primary / backup" />
      </div>
      <div className="full">
        <label htmlFor={notesId}>Notes</label>
        <textarea id={notesId} name="notes" rows={2} />
      </div>
    </EntityForm>
  );
}
