"use client";

import { useId, useState } from "react";
import EntityForm from "@/components/EntityForm";
import { money } from "@/lib/format";
import { addOrderLine } from "../actions";

export interface ProductOption {
  id: number;
  name: string;
  unit: string;
  listPrice: number;
}

export interface HarvestOption {
  id: number;
  label: string;
}

interface AddLineFormProps {
  orderId: number;
  products: ProductOption[];
  harvests: HarvestOption[];
}

export default function AddLineForm({ orderId, products, harvests }: AddLineFormProps) {
  const ids = { product: useId(), harvest: useId(), qty: useId(), price: useId() };
  const [productId, setProductId] = useState("");
  const selected = products.find((p) => String(p.id) === productId);

  return (
    <EntityForm action={addOrderLine.bind(null, orderId)} submitLabel="Add line">
      <div>
        <label htmlFor={ids.product}>Product</label>
        <select
          id={ids.product}
          name="product_id"
          required
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        >
          <option value="" disabled>Pick a product…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={ids.harvest}>Fulfilled from harvest (lot)</label>
        <select id={ids.harvest} name="harvest_id" defaultValue="">
          <option value="">Not linked yet</option>
          {harvests.map((h) => (
            <option key={h.id} value={h.id}>{h.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={ids.qty}>Quantity{selected ? ` (${selected.unit})` : ""}</label>
        <input id={ids.qty} name="quantity" type="number" inputMode="decimal" min="0" step="any" required defaultValue="1" />
      </div>
      <div>
        <label htmlFor={ids.price}>Unit price</label>
        <input
          id={ids.price}
          name="unit_price"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder={selected ? `${money(selected.listPrice)} list` : "List price"}
        />
      </div>
    </EntityForm>
  );
}
