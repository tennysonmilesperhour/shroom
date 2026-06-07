"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface SegmentedTab {
  key: string;
  label: string;
  panel: ReactNode;
}

interface SegmentedProps {
  tabs: SegmentedTab[];
  ariaLabel: string;
  /** Initial active key. Defaults to the first tab. */
  defaultKey?: string;
}

// Tab control with a sliding active indicator and crossfading panels.
// SSR-safe: the indicator is positioned after mount; panels are always in the
// DOM (the inactive ones hidden), so content is never gated behind animation.
export default function Segmented({ tabs, ariaLabel, defaultKey }: SegmentedProps) {
  const [active, setActive] = useState(defaultKey ?? tabs[0]?.key);
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  const moveIndicator = () => {
    const list = listRef.current;
    if (!list) return;
    const btn = list.querySelector<HTMLButtonElement>(`[data-key="${active}"]`);
    if (!btn) return;
    setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
  };

  useEffect(() => {
    moveIndicator();
    window.addEventListener("resize", moveIndicator);
    return () => window.removeEventListener("resize", moveIndicator);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tabs.length]);

  return (
    <div className="segmented">
      <div className="seg" role="tablist" aria-label={ariaLabel} ref={listRef}>
        {indicator && (
          <span
            className="seg-ind"
            aria-hidden="true"
            style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
          />
        )}
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            data-key={t.key}
            aria-selected={t.key === active}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="seg-panels">
        {tabs.map((t) => (
          <div
            key={t.key}
            role="tabpanel"
            hidden={t.key !== active}
            className={`seg-panel ${t.key === active ? "active" : ""}`}
          >
            {t.panel}
          </div>
        ))}
      </div>
    </div>
  );
}
