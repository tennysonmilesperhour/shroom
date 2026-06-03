"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS, isActive } from "@/lib/nav";

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="side" aria-label="Primary">
      {NAV_GROUPS.map((g) => (
        <div className="grp-block" key={g.key} data-grp={g.key}>
          <div className="grp">{g.label}</div>
          {g.items.map(([href, label]) => {
            const active = isActive(href, path);
            return (
              <Link
                key={href}
                href={href}
                className={active ? "active" : ""}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
