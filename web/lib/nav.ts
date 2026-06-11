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
      ["/presets", "Tub Presets"],
      ["/strains", "Strains"],
      ["/cultures", "Cultures & Spores"],
      ["/harvests", "Harvests"],
      ["/tasks", "Tasks"],
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
      ["/truth-source", "Truth Source"],
      ["/sync", "Sheet sync"],
    ],
  },
];

export function isActive(href: string, currentPath: string): boolean {
  return href === "/" ? currentPath === "/" : currentPath.startsWith(href);
}

/** Human-readable label for a pathname, used to tag feedback notes with the
    screen they were filed from. Falls back to a Title-Cased first segment for
    routes not in the nav (e.g. detail pages like /batches/12). */
export function labelForPath(path: string): string {
  if (path === "/") return "Dashboard";
  let best: { href: string; label: string } | null = null;
  for (const group of NAV_GROUPS) {
    for (const [href, label] of group.items) {
      if (href === "/") continue;
      if (path === href || path.startsWith(href + "/") || path.startsWith(href)) {
        if (!best || href.length > best.href.length) best = { href, label };
      }
    }
  }
  if (best) return best.label;
  const seg = path.split("/").filter(Boolean)[0] ?? "App";
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
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
