"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["/", "Dashboard"],
  ["/strains", "Strains"],
  ["/batches", "Batches"],
  ["/harvests", "Harvests"],
  ["/environment", "Environment"],
  ["/contamination", "Contam"],
  ["/business", "Business"],
  ["/traceability", "Traceability"],
  ["/reference", "Reference"],
  ["/advisor", "Advisor"],
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="tabs">
      {TABS.map(([href, label]) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href} className={active ? "active" : ""}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
