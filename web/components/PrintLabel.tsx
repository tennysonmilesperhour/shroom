"use client";

import Link from "next/link";
import { useEffect } from "react";
import { LABEL_SIZES, type LabelSize } from "@/lib/label-size";

// Screen-only toolbar for the label print page. Injects an @page rule matching
// the chosen label size so the browser's print dialog targets the right stock
// (Dymo/Zebra/thermal), and offers one-click print + size presets. Everything
// here is hidden by the print stylesheet, so only the label itself prints.
export default function PrintLabel({
  size,
  basePath,
}: {
  size: LabelSize;
  basePath: string;
}) {
  function hrefForSize(key: string): string {
    const [path, rawQuery = ""] = basePath.split("?");
    const params = new URLSearchParams(rawQuery);
    params.set("size", key);
    return `${path}?${params.toString()}`;
  }

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
            href={hrefForSize(s.key)}
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
