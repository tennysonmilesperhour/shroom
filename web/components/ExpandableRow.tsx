"use client";

import { useId, useState, type ReactNode } from "react";

interface ExpandableRowProps {
  /** Cells for the always-visible summary row (a sequence of <td>). */
  summary: ReactNode;
  /** Detail content, revealed on toggle. */
  detail: ReactNode;
  /** Total column count, for the detail row's colSpan. */
  colSpan: number;
  defaultOpen?: boolean;
}

// A table row that expands to reveal detail. Renders two sibling <tr>s, so it
// must live directly inside <tbody>. The detail uses a grid-rows 0fr→1fr
// transition (no max-height guessing); keyboard operable, ARIA-wired.
export default function ExpandableRow({
  summary,
  detail,
  colSpan,
  defaultOpen = false,
}: ExpandableRowProps) {
  const [open, setOpen] = useState(defaultOpen);
  const detailId = useId();

  const toggle = () => setOpen((v) => !v);
  const onKey = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <>
      <tr
        className="exp-row"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={detailId}
        onClick={toggle}
        onKeyDown={onKey}
      >
        {summary}
      </tr>
      <tr className="exp-detail-row">
        <td colSpan={colSpan}>
          <div className={`exp-detail ${open ? "open" : ""}`} id={detailId} role="region">
            <div className="exp-detail-inner">{detail}</div>
          </div>
        </td>
      </tr>
    </>
  );
}
