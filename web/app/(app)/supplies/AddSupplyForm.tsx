"use client";

import { useId } from "react";
import EntityForm from "@/components/EntityForm";
import { addSupply } from "./actions";

export default function AddSupplyForm() {
  const nameId = useId();
  const catId = useId();
  const unitId = useId();
  const qtyId = useId();
  const threshId = useId();
  const costId = useId();
  const supplierId = useId();
  const locId = useId();

  return (
    <EntityForm action={addSupply} submitLabel="Add supply">
      <div>
        <label htmlFor={nameId}>Name</label>
        <input id={nameId} name="name" type="text" required />
      </div>
      <div>
        <label htmlFor={catId}>Category</label>
        <input id={catId} name="category" type="text" placeholder="grain / substrate / lab" />
      </div>
      <div>
        <label htmlFor={unitId}>Unit</label>
        <input id={unitId} name="unit" type="text" defaultValue="unit" />
      </div>
      <div>
        <label htmlFor={qtyId}>On hand</label>
        <input id={qtyId} name="quantity_on_hand" type="number" min={0} step="0.01" defaultValue={0} />
      </div>
      <div>
        <label htmlFor={threshId}>Reorder threshold</label>
        <input id={threshId} name="reorder_threshold" type="number" min={0} step="0.01" defaultValue={0} />
      </div>
      <div>
        <label htmlFor={costId}>Unit cost</label>
        <input id={costId} name="unit_cost" type="number" min={0} step="0.01" defaultValue={0} />
      </div>
      <div>
        <label htmlFor={supplierId}>Supplier</label>
        <input id={supplierId} name="supplier" type="text" />
      </div>
      <div>
        <label htmlFor={locId}>Location</label>
        <input id={locId} name="location" type="text" />
      </div>
    </EntityForm>
  );
}
