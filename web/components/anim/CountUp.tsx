"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useInView } from "@/hooks/useInView";

interface CountUpProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
  className?: string;
}

// Animates a number up to `value` when it scrolls into view. SSR and the
// reduced-motion path render the final value immediately (no flash of blank,
// no hydration mismatch — state initializes to the final value).
export default function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  durationMs = 1100,
  className,
}: CountUpProps) {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLSpanElement>();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduced || !inView) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - k, 3);
      setDisplay(value * eased);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, inView, reduced, durationMs]);

  const text =
    prefix +
    display.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) +
    suffix;

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
