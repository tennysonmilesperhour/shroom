"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Portal from "@/components/Portal";
import EntityForm from "@/components/EntityForm";
import { updatePreset } from "./actions";
import PresetFields, { type PresetInitial } from "./PresetFields";
import { type InventoryOption } from "./PresetMaterialsField";

interface Option {
  id: number;
  name: string;
}

interface EditPresetButtonProps {
  presetId: number;
  initial: PresetInitial;
  strains: Option[];
  recipes: Option[];
  rooms: Option[];
  items: InventoryOption[];
}

// "Edit" on a preset card. Opens the same field set as the add form, prefilled
// (materials included), and saves through updatePreset. The generic EditDialog
// can't host the bill-of-materials editor, hence this bespoke dialog.
export default function EditPresetButton({
  presetId,
  initial,
  strains,
  recipes,
  rooms,
  items,
}: EditPresetButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape; focus the panel on open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="ghost" onClick={() => setOpen(true)}>
        Edit
      </button>

      {open && (
        <Portal>
          <div className="modal-overlay" role="presentation" onClick={() => setOpen(false)}>
            <div
              ref={panelRef}
              className="modal-panel"
              role="dialog"
              aria-modal="true"
              aria-label={`Edit preset ${initial.name}`}
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-head">
                <div>
                  <div className="eyebrow">Edit preset</div>
                  <h3 style={{ margin: 0 }}>{initial.name}</h3>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                >
                  ✕
                </button>
              </div>
              <EntityForm
                action={updatePreset.bind(null, presetId)}
                submitLabel="Save changes"
                resetOnSuccess={false}
                onSuccess={() => {
                  setOpen(false);
                  router.refresh();
                }}
              >
                <PresetFields
                  strains={strains}
                  recipes={recipes}
                  rooms={rooms}
                  items={items}
                  initial={initial}
                />
              </EntityForm>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
