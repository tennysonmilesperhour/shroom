"use client";

import { useEffect, useRef, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import Portal from "@/components/Portal";
import { updateEntity } from "@/lib/crud";
import { getEntity, type FieldDef, type Option } from "@/lib/entities";
import { convertToDisplay } from "@/lib/format";

interface EditDialogProps {
  entity: string;
  id: number;
  label?: string;
  initial: Record<string, unknown>;
  /** FK select options, keyed by field name. */
  options?: Record<string, Option[]>;
  onClose: () => void;
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function Field({
  field,
  initial,
  options,
  fieldId,
}: {
  field: FieldDef;
  initial: Record<string, unknown>;
  options?: Record<string, Option[]>;
  fieldId: string;
}) {
  const v = initial[field.name];

  if (field.type === "checkbox") {
    return (
      <label className="checkbox-row" htmlFor={fieldId}>
        <input id={fieldId} type="checkbox" name={field.name} defaultChecked={Boolean(v)} />
        {field.label}
      </label>
    );
  }

  const inner = (() => {
    if (field.type === "textarea") {
      return <textarea id={fieldId} name={field.name} rows={3} defaultValue={str(v)} />;
    }
    if (field.type === "select") {
      const opts = field.fk ? options?.[field.name] ?? [] : field.options ?? [];
      return (
        <select id={fieldId} name={field.name} defaultValue={str(v)} required={field.required}>
          {!field.required && <option value="">—</option>}
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    // A numeric field can store one unit but be edited in another (kg↔lb,
    // °C↔°F). Show the operator's unit; lib/crud converts back on save.
    const shown =
      field.type === "number" && field.convert && v != null && v !== ""
        ? str(convertToDisplay(field.convert, Number(v)))
        : str(v);
    return (
      <input
        id={fieldId}
        name={field.name}
        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
        defaultValue={shown}
        required={field.required}
        step={field.step}
        min={field.min}
        placeholder={field.placeholder}
      />
    );
  })();

  return (
    <div className={field.full ? "full" : undefined}>
      <label htmlFor={fieldId}>{field.label}</label>
      {inner}
    </div>
  );
}

export default function EditDialog({
  entity,
  id,
  label,
  initial,
  options,
  onClose,
}: EditDialogProps) {
  const def = getEntity(entity);
  // Only edit fields the caller actually supplied a value for. This keeps
  // view-backed lists (which may not carry every column) from blanking
  // columns they never loaded.
  const fields = def.fields.filter((f) =>
    Object.prototype.hasOwnProperty.call(initial, f.name),
  );
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape; focus the panel on open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await updateEntity(entity, id, data);
      push({
        title: r.ok ? "Saved" : "Couldn’t save",
        body: r.message,
        tone: r.ok ? "moss" : "ember",
      });
      if (r.ok) {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <Portal>
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        ref={panelRef}
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${label ?? def.label}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <div className="eyebrow">Edit {def.label}</div>
            {label && <h3 style={{ margin: 0 }}>{label}</h3>}
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form onSubmit={onSubmit} className="form-grid">
          <input type="hidden" name="__fields" value={fields.map((f) => f.name).join(",")} />
          {fields.map((f) => (
            <Field
              key={f.name}
              field={f}
              initial={initial}
              options={options}
              fieldId={`edit-${entity}-${id}-${f.name}`}
            />
          ))}
          <div className="actions full">
            <button type="submit" className="primary" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </button>
            <button type="button" className="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
}
