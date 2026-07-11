"use client";

import { useId } from "react";
import EntityForm from "@/components/EntityForm";
import { addOrder } from "./actions";
import { SALES_CHANNELS, channelLabel } from "@/lib/channels";

interface CustomerOption {
  id: number;
  name: string;
}

interface AddOrderFormProps {
  customers: CustomerOption[];
}

export default function AddOrderForm({ customers }: AddOrderFormProps) {
  const ids = {
    num: useId(), cust: useId(), channel: useId(), date: useId(),
    pay: useId(), ful: useId(), notes: useId(),
  };
  const today = new Date().toISOString().slice(0, 10);
  return (
    <EntityForm action={addOrder} submitLabel="Add order">
      <div>
        <label htmlFor={ids.num}>Order number</label>
        <input id={ids.num} name="order_number" type="text" required placeholder="2026-001" />
      </div>
      <div>
        <label htmlFor={ids.cust}>Customer</label>
        <select id={ids.cust} name="customer_id" required defaultValue="">
          <option value="" disabled>Pick a customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={ids.channel}>Channel</label>
        <select id={ids.channel} name="channel" defaultValue="wholesale">
          {SALES_CHANNELS.map((c) => (
            <option key={c} value={c}>{channelLabel(c)}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={ids.date}>Order date</label>
        <input id={ids.date} name="order_date" type="date" required defaultValue={today} />
      </div>
      <div>
        <label htmlFor={ids.pay}>Payment</label>
        <select id={ids.pay} name="financial_status" defaultValue="pending">
          <option value="pending">pending</option>
          <option value="paid">paid</option>
          <option value="refunded">refunded</option>
        </select>
      </div>
      <div>
        <label htmlFor={ids.ful}>Fulfillment</label>
        <select id={ids.ful} name="fulfillment_status" defaultValue="unfulfilled">
          <option value="unfulfilled">unfulfilled</option>
          <option value="partial">partial</option>
          <option value="fulfilled">fulfilled</option>
        </select>
      </div>
      <div className="full">
        <label htmlFor={ids.notes}>Notes</label>
        <textarea id={ids.notes} name="notes" rows={2} />
      </div>
    </EntityForm>
  );
}
