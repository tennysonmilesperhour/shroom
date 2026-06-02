"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = readonly [href: string, label: string];
interface NavGroup {
  readonly key: string;
  readonly label: string;
  readonly items: readonly NavItem[];
}

const GROUPS: readonly NavGroup[] = [
  {
    key: "grow",
    label: "Grow",
    items: [
      ["/", "Dashboard"],
      ["/batches", "Batches"],
      ["/strains", "Strains"],
      ["/harvests", "Harvests"],
      ["/environment", "Environment"],
      ["/contamination", "Contamination"],
    ],
  },
  {
    key: "sell",
    label: "Sell",
    items: [
      ["/orders", "Orders"],
      ["/customers", "Customers"],
      ["/catalog", "Catalog"],
      ["/marketing", "Marketing"],
      ["/subscriptions", "Subscriptions"],
    ],
  },
  {
    key: "source",
    label: "Source",
    items: [
      ["/vendors", "Vendors"],
      ["/purchase-orders", "Purchase Orders"],
      ["/supplies", "Supplies"],
    ],
  },
  {
    key: "comply",
    label: "Comply",
    items: [
      ["/traceability", "Traceability"],
      ["/food-safety", "Food Safety"],
      ["/guides", "SOPs & Guides"],
    ],
  },
  {
    key: "intelligence",
    label: "Intelligence",
    items: [
      ["/advisor", "Advisor"],
      ["/reports", "Reports"],
    ],
  },
];

export default function Nav() {
  const path = usePathname();
  const isActive = (href: string): boolean =>
    href === "/" ? path === "/" : path.startsWith(href);

  return (
    <nav className="side" aria-label="Primary">
      {GROUPS.map((g) => (
        <div className="grp-block" key={g.key} data-grp={g.key}>
          <div className="grp">{g.label}</div>
          {g.items.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={isActive(href) ? "active" : ""}
              aria-current={isActive(href) ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
