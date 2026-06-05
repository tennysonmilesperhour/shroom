"use client";

import { useState, type ReactNode } from "react";

interface AddPanelProps {
  label: string;
  /** Text shown on the toggle button when closed. */
  buttonLabel?: string;
  children: ReactNode;
  /** Optional onOpen hook (e.g. to focus first input). */
  defaultOpen?: boolean;
}

// A disclosure panel for inline "Add X" forms. Toggle stays inside the
// list page; no modal overlay. Keyboard-reachable, reduced-motion safe.
export default function AddPanel({
  label,
  buttonLabel,
  children,
  defaultOpen = false,
}: AddPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="add-panel">
      <button
        type="button"
        className="add-panel-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="add-panel-icon" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
        {open ? "Close" : (buttonLabel ?? `Add ${label.toLowerCase()}`)}
      </button>
      {open && (
        <div className="add-panel-body">
          <div className="eyebrow">{label}</div>
          {children}
        </div>
      )}
    </div>
  );
}
