"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

interface InViewOptions {
  /** Fire once then stop observing. Default true. */
  once?: boolean;
  /** IntersectionObserver threshold. Default 0.2. */
  threshold?: number;
  /** rootMargin, e.g. "0px 0px -10% 0px". */
  rootMargin?: string;
  /**
   * Safety: force `inView` true after this many ms even if the observer never
   * fires (hidden tab, headless renderer, link-preview bot). Prevents the
   * "reveal-gated content ships blank" bug. Default 1800. Set 0 to disable.
   */
  safetyMs?: number;
}

// Returns a ref to attach and whether it has entered the viewport. Content
// should be visible by default and merely *enhanced* when inView flips true;
// never gate visibility solely on this, but the safety timer guarantees it
// resolves regardless.
export function useInView<T extends Element = HTMLDivElement>(
  options: InViewOptions = {},
): [RefObject<T | null>, boolean] {
  const { once = true, threshold = 0.2, rootMargin, safetyMs = 1800 } = options;
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(el);

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (safetyMs > 0) {
      timer = setTimeout(() => {
        setInView(true);
        observer.disconnect();
      }, safetyMs);
    }

    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [once, threshold, rootMargin, safetyMs]);

  return [ref, inView];
}
