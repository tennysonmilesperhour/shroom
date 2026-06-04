// Shared navigation structure - consumed by desktop Nav and MobileNav so
// both surfaces always reflect the same IA.

export type NavItem = readonly [href: string, label: string];

export interface NavGroup {
  readonly key: "grow" | "sell" | "source" | "comply" | "intelligence";
  readonly label: string;
  readonly items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
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

export function isActive(href: string, currentPath: string): boolean {
  return href === "/" ? currentPath === "/" : currentPath.startsWith(href);
}

/** Resolve the section key for a given pathname so the shell can tint
    background gradients per IA group. */
export function sectionForPath(path: string): NavGroup["key"] {
  for (const group of NAV_GROUPS) {
    for (const [href] of group.items) {
      if (href === "/" ? path === "/" : path.startsWith(href)) {
        return group.key;
      }
    }
  }
  return "grow";
}
