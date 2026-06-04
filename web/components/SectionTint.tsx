"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { sectionForPath } from "@/lib/nav";

// Sets data-section on <html> based on the active route so CSS can tint the
// body gradients per IA group. Pure side effect; renders nothing.
export default function SectionTint() {
  const path = usePathname();
  useEffect(() => {
    document.documentElement.dataset.section = sectionForPath(path);
  }, [path]);
  return null;
}
