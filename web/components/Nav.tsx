"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS: { label: string; items: [string, string][] }[] = [
  { label: "Grow", items: [
    ["/", "Dashboard"], ["/batches", "Batches"], ["/strains", "Strains"],
    ["/harvests", "Harvests"], ["/environment", "Environment"], ["/contamination", "Contamination"],
  ]},
  { label: "Sell", items: [
    ["/orders", "Orders"], ["/customers", "Customers"], ["/catalog", "Catalog"],
    ["/marketing", "Marketing"], ["/subscriptions", "Subscriptions"],
  ]},
  { label: "Source", items: [
    ["/vendors", "Vendors"], ["/purchase-orders", "Purchase Orders"], ["/supplies", "Supplies"],
  ]},
  { label: "Comply", items: [
    ["/traceability", "Traceability"], ["/food-safety", "Food Safety"], ["/guides", "SOPs & Guides"],
  ]},
  { label: "Intelligence", items: [
    ["/advisor", "Advisor"], ["/reports", "Reports"],
  ]},
];

export default function Nav() {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <nav className="side">
      {GROUPS.map((g) => (
        <div className="grp-block" key={g.label}>
          <div className="grp">{g.label}</div>
          {g.items.map(([href, label]) => (
            <Link key={href} href={href} className={isActive(href) ? "active" : ""}>
              {label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
