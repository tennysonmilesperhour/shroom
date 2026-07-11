"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Renders children into <body>, escaping the current DOM subtree. Modals must
// portal to the body because `main > *` carries a lingering `transform` (the
// fade-up entrance animation holds its end frame via `fill: both`). A non-none
// transform makes that element the containing block for any `position: fixed`
// descendant, so an overlay rendered inline would be sized/offset to that box
// instead of the viewport — clipping the panel and letting the page bleed
// through. Portaling to <body> keeps `position: fixed` relative to the viewport.
export default function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
