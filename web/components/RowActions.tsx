"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";
import { deleteEntity } from "@/lib/crud";
import EditDialog from "@/components/EditDialog";
import type { Option } from "@/lib/entities";

interface RowActionsProps {
  /** Entity key from lib/entities. */
  entity: string;
  id: number;
  /** Human label used in confirm + edit dialog (e.g. lot code, name). */
  label?: string;
  /** Optional "View" target. */
  viewHref?: string;
  /** Current field values; when provided, an Edit action is shown. */
  initial?: Record<string, unknown>;
  /** FK select options keyed by field name. */
  options?: Record<string, Option[]>;
  /** Navigate here after a successful delete (e.g. from a detail page). */
  afterDeleteHref?: string;
}

export default function RowActions({
  entity,
  id,
  label,
  viewHref,
  initial,
  options,
  afterDeleteHref,
}: RowActionsProps) {
  const router = useRouter();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function doDelete() {
    startTransition(async () => {
      const r = await deleteEntity(entity, id);
      push({
        title: r.ok ? "Deleted" : "Couldn’t delete",
        body: r.message,
        tone: r.ok ? "moss" : "ember",
      });
      if (r.ok) {
        setConfirming(false);
        setOpen(false);
        if (afterDeleteHref) router.push(afterDeleteHref);
        else router.refresh();
      }
    });
  }

  return (
    <div className="row-actions" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Row actions"
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>

      {open && (
        <div className="row-menu" role="menu">
          {viewHref && (
            <Link href={viewHref} role="menuitem" className="row-menu-item" onClick={() => setOpen(false)}>
              View
            </Link>
          )}
          {initial && (
            <button
              type="button"
              role="menuitem"
              className="row-menu-item"
              onClick={() => {
                setEditing(true);
                setOpen(false);
              }}
            >
              Edit
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="row-menu-item danger"
            onClick={() => {
              setConfirming(true);
              setOpen(false);
            }}
          >
            Delete
          </button>
        </div>
      )}

      {editing && initial && (
        <EditDialog
          entity={entity}
          id={id}
          label={label}
          initial={initial}
          options={options}
          onClose={() => setEditing(false)}
        />
      )}

      {confirming && (
        <div className="modal-overlay" role="presentation" onClick={() => setConfirming(false)}>
          <div
            className="modal-panel confirm"
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm delete"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Delete {label ? `“${label}”` : "this record"}?</h3>
            <p className="muted">This can’t be undone.</p>
            <div className="actions">
              <button type="button" className="danger-btn" onClick={doDelete} disabled={pending}>
                {pending ? "Deleting…" : "Delete"}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setConfirming(false)}
                disabled={pending}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
