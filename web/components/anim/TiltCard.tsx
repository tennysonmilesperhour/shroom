"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
}

// Wraps content in a magnetic 3D tilt + a cursor-following glow. Purely
// presentational. On coarse pointers or reduced motion it renders a plain
// container with the same className (no listeners, no transform).
export default function TiltCard({ children, className = "" }: TiltCardProps) {
  const reduced = useReducedMotion();
  const [fine, setFine] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFine(window.matchMedia("(pointer: fine)").matches);
  }, []);

  const interactive = fine && !reduced;

  useEffect(() => {
    const el = ref.current;
    if (!el || !interactive) return;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty("--rx", ((0.5 - py) * 6).toFixed(2) + "deg");
      el.style.setProperty("--ry", ((px - 0.5) * 7).toFixed(2) + "deg");
      el.style.setProperty("--gx", (px * 100).toFixed(1) + "%");
      el.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
    };
    const onLeave = () => {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [interactive]);

  return (
    <div ref={ref} className={`${interactive ? "tilt " : ""}${className}`}>
      {children}
    </div>
  );
}
