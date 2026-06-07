"use client";

import { useEffect, useState } from "react";

// Tracks the user's prefers-reduced-motion setting, reactively.
// Returns false during SSR / first paint so motion-capable clients don't flash
// a static state; flips to the real value on mount and on change.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}
