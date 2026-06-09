"use client";

import { useId, useState } from "react";

export interface InventoryOption {
  id: number;
  name: string;
  unit: string;
}

interface Row {
  key: string;
  inventory_item_id: string; // "" = manual / unlinked
  name: string;
  quantity: string;
  unit: string;
}

let seq = 0;
const blankRow = (): Row => ({
  key: `mat-${seq++}`,
  inventory_item_id: "",
  name: "",
  quantity: "",
  unit: "unit",
});

// Dynamic bill-of-materials editor. Each row links an inventory item (or is a
// free-typed material) plus the quantity one tub of this preset consumes. The
// rows are serialised into a hidden `materials_json` input that the server
// action parses — keeping everything inside the single EntityForm submit.
export default function PresetMaterialsField({ items }: { items: InventoryOption[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const headingId = useId();

  const patch = (key: string, next: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...next } : r)));
  const remove = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));

  // When an inventory item is picked, default the label + unit from it so the
  // operator rarely has to type anything.
  const onPickItem = (key: string, value: string) => {
    const item = items.find((i) => String(i.id) === value);
    patch(key, {
      inventory_item_id: value,
      ...(item ? { name: item.name, unit: item.unit || "unit" } : {}),
    });
  };

  const payload = rows
    .filter((r) => r.inventory_item_id || r.name.trim())
    .map((r) => ({
      inventory_item_id: r.inventory_item_id ? Number(r.inventory_item_id) : null,
      name: r.name.trim(),
      quantity: Number(r.quantity || 0),
      unit: r.unit.trim() || "unit",
    }));

  return (
    <div className="full">
      <label id={headingId}>Materials per tub</label>
      <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>
        What one tub from this preset consumes. Link an inventory item to draw it
        down when you start a batch, or type a material that isn&rsquo;t tracked yet.
      </p>
      <input type="hidden" name="materials_json" value={JSON.stringify(payload)} />

      {rows.length > 0 && (
        <div className="preset-materials" role="group" aria-labelledby={headingId}>
          {rows.map((r) => (
            <div className="preset-material-row" key={r.key}>
              <select
                aria-label="Inventory item"
                value={r.inventory_item_id}
                onChange={(e) => onPickItem(r.key, e.target.value)}
              >
                <option value="">(manual entry)</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                aria-label="Material name"
                placeholder="Material"
                value={r.name}
                onChange={(e) => patch(r.key, { name: e.target.value })}
              />
              <input
                type="number"
                aria-label="Quantity"
                placeholder="Qty"
                min={0}
                step="0.01"
                value={r.quantity}
                onChange={(e) => patch(r.key, { quantity: e.target.value })}
              />
              <input
                type="text"
                aria-label="Unit"
                placeholder="unit"
                value={r.unit}
                onChange={(e) => patch(r.key, { unit: e.target.value })}
              />
              <button
                type="button"
                className="preset-material-remove"
                aria-label="Remove material"
                onClick={() => remove(r.key)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="add-panel-toggle"
        style={{ marginTop: 8 }}
        onClick={() => setRows((rs) => [...rs, blankRow()])}
      >
        <span className="add-panel-icon" aria-hidden="true">
          +
        </span>
        Add material
      </button>
    </div>
  );
}
