"use client";

import Link from "next/link";
import { useEffect } from "react";

// Screen-only toolbar for the label print page. Injects an @page rule matching
// the chosen label size so the browser's print dialog targets the right stock
// (Dymo/Zebra/thermal), and offers one-click print + size presets. Everything
// here is hidden by the print stylesheet, so only the label itself prints.
export interface LabelSize {
  key: string;
  label: string;
  w: number; // inches
  h: number; // inches
}

export const LABEL_SIZES: LabelSize[] = [
  { key: "sm", label: '2.0 × 1.0"', w: 2.0, h: 1.0 },
  { key: "md", label: '2.25 × 1.25"', w: 2.25, h: 1.25 },
  { key: "lg", label: '4.0 × 2.0"', w: 4.0, h: 2.0 },
];

export function sizeFor(key: string | undefined): LabelSize {
  return LABEL_SIZES.find((s) => s.key === key) ?? LABEL_SIZES[1];
}

export default function PrintLabel({
  size,
  basePath,
}: {
  size: LabelSize;
  basePath: string;
}) {
  useEffect(() => {
    const id = "label-page-size";
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = id;
      document.head.appendChild(style);
    }
    style.textContent = `@page { size: ${size.w}in ${size.h}in; margin: 0; }`;
    return () => {
      style?.remove();
    };
  }, [size.w, size.h]);

  return (
    <div className="label-toolbar no-print">
      <div className="label-sizes" role="group" aria-label="Label size">
        {LABEL_SIZES.map((s) => (
          <Link
            key={s.key}
            href={`${basePath}?size=${s.key}`}
            className={`label-size-btn ${s.key === size.key ? "active" : ""}`}
            aria-current={s.key === size.key ? "true" : undefined}
          >
            {s.label}
          </Link>
        ))}
      </div>
      <button type="button" className="primary" onClick={() => window.print()}>
        Print label
      </button>
    </div>
  );
}
