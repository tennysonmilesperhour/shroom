"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";
import { deleteEntity } from "@/lib/crud";
import EditDialog from "@/components/EditDialog";
import Portal from "@/components/Portal";
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

/** Menu box, used to decide whether it fits below the trigger. */
const MENU_WIDTH = 160;
const MENU_MAX_HEIGHT = 160;

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
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Viewport coordinates for the portaled menu. The menu can't be a normal
  // absolutely-positioned child: on narrow screens the surrounding <table>
  // becomes `display:block; overflow-x:auto` (globals.css), which clips any
  // descendant that escapes its box — the menu was being cut off, leaving Edit
  // and Delete unreachable. Portaling to <body> with fixed coordinates keeps it
  // clear of every scroll container and stacking context on the page.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const height = menuRef.current?.offsetHeight ?? MENU_MAX_HEIGHT;
    const width = menuRef.current?.offsetWidth ?? MENU_WIDTH;
    // Flip above the trigger when there isn't room below.
    const below = r.bottom + 4;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, r.top - 4 - height) : below;
    // Right-align to the trigger, clamped into the viewport.
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // A fixed-position menu doesn't travel with its trigger, so re-anchor it
    // while the page (or the table it sits in) scrolls.
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

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
        ref={btnRef}
        type="button"
        className="icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label ? `Actions for ${label}` : "Row actions"}
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>

      {open && (
        <Portal>
          <div
            ref={menuRef}
            className="row-menu"
            role="menu"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? "visible" : "hidden" }}
          >
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
        </Portal>
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
        <Portal>
        <div className="modal-overlay" role="presentation" onClick={() => setConfirming(false)}>
          <div
            className="modal-panel confirm"
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm delete"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Delete {label ? `“${label}”` : "this record"}?</h3>
            <p className="muted">
              {entity === "batch"
                ? "This can’t be undone. Harvests, contamination logs, stage events, materials, and dry inventory from this batch will be removed too. Batches linked to orders won’t be deleted."
                : "This can’t be undone."}
            </p>
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
        </Portal>
      )}
    </div>
  );
}
