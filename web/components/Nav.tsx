"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: [string, string][] = [
  ["/", "Dashboard"],
  ["/strains", "Strains"],
  ["/batches", "Batches"],
  ["/harvests", "Harvests"],
  ["/environment", "Environment"],
  ["/contamination", "Contamination"],
  ["/business", "Business"],
  ["/commerce", "Commerce"],
  ["/traceability", "Traceability"],
  ["/reference", "Reference"],
  ["/advisor", "Advisor"],
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="side">
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
