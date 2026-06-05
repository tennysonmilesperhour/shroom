"use client";

import { useId } from "react";
import EntityForm from "@/components/EntityForm";
import { addPurchaseOrder } from "./actions";

interface VendorOption {
  id: number;
  name: string;
}

interface AddPurchaseOrderFormProps {
  vendors: VendorOption[];
}

export default function AddPurchaseOrderForm({ vendors }: AddPurchaseOrderFormProps) {
  const ids = {
    ref: useId(), vendor: useId(), status: useId(),
    ordered: useId(), expected: useId(), total: useId(), notes: useId(),
  };
  const today = new Date().toISOString().slice(0, 10);
  return (
    <EntityForm action={addPurchaseOrder} submitLabel="Add PO">
      <div>
        <label htmlFor={ids.ref}>Reference</label>
        <input id={ids.ref} name="reference" type="text" required placeholder="PO-2026-001" />
      </div>
      <div>
        <label htmlFor={ids.vendor}>Vendor</label>
        <select id={ids.vendor} name="vendor_id" required defaultValue="">
          <option value="" disabled>Pick a vendor…</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={ids.status}>Status</label>
        <select id={ids.status} name="status" defaultValue="ordered">
          <option value="ordered">ordered</option>
          <option value="partial">partial</option>
          <option value="received">received</option>
          <option value="cancelled">cancelled</option>
        </select>
      </div>
      <div>
        <label htmlFor={ids.total}>Total ($)</label>
        <input id={ids.total} name="total" type="number" min={0} step="0.01" defaultValue={0} />
      </div>
      <div>
        <label htmlFor={ids.ordered}>Ordered on</label>
        <input id={ids.ordered} name="ordered_at" type="date" defaultValue={today} />
      </div>
      <div>
        <label htmlFor={ids.expected}>Expected on</label>
        <input id={ids.expected} name="expected_at" type="date" />
      </div>
      <div className="full">
        <label htmlFor={ids.notes}>Notes</label>
        <textarea id={ids.notes} name="notes" rows={2} />
      </div>
    </EntityForm>
  );
}
