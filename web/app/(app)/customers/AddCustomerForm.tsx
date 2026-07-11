"use client";

import { useId } from "react";
import EntityForm from "@/components/EntityForm";
import { addCustomer } from "./actions";
import { SALES_CHANNELS, channelLabel } from "@/lib/channels";

export default function AddCustomerForm() {
  const nameId = useId();
  const channelId = useId();
  const emailId = useId();
  const phoneId = useId();
  const statusId = useId();
  const roleId = useId();
  const tierId = useId();
  const regionId = useId();
  const priId = useId();
  const notesId = useId();

  return (
    <EntityForm action={addCustomer} submitLabel="Add customer">
      <div>
        <label htmlFor={nameId}>Name</label>
        <input id={nameId} name="name" type="text" required />
      </div>
      <div>
        <label htmlFor={channelId}>Channel</label>
        <select id={channelId} name="channel" defaultValue="wholesale">
          {SALES_CHANNELS.map((c) => (
            <option key={c} value={c}>{channelLabel(c)}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={emailId}>Email</label>
        <input id={emailId} name="contact_email" type="email" />
      </div>
      <div>
        <label htmlFor={phoneId}>Phone</label>
        <input id={phoneId} name="phone" type="tel" />
      </div>
      <div>
        <label htmlFor={statusId}>Status</label>
        <select id={statusId} name="status" defaultValue="active">
          <option value="lead">lead</option>
          <option value="warm">warm</option>
          <option value="active">active</option>
          <option value="integrated">integrated</option>
          <option value="not_contacted">not_contacted</option>
        </select>
      </div>
      <div>
        <label htmlFor={roleId}>Role</label>
        <input id={roleId} name="role" type="text" placeholder="buyer / chef / owner" />
      </div>
      <div>
        <label htmlFor={tierId}>Price tier</label>
        <input id={tierId} name="price_tier" type="text" placeholder="wholesale / distributor / retail" />
      </div>
      <div>
        <label htmlFor={regionId}>Region</label>
        <input id={regionId} name="region" type="text" />
      </div>
      <div>
        <label htmlFor={priId}>Priority (1-5)</label>
        <input id={priId} name="priority" type="number" min={1} max={5} step={1} />
      </div>
      <div className="full">
        <label htmlFor={notesId}>Notes</label>
        <textarea id={notesId} name="notes" rows={2} />
      </div>
    </EntityForm>
  );
}
