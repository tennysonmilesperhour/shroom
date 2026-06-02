import { ReactNode } from "react";

type BadgeTone = "green" | "amber" | "red" | "blue" | "muted";

export function Badge({ tone = "muted", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`card ${className}`}>
      {title && <h3>{title}</h3>}
      {children}
    </div>
  );
}

export function Kpi({ label, value, unit }: { label: string; value: ReactNode; unit?: string }) {
  return (
    <div className="card kpi">
      <div className="label">{label}</div>
      <div className="value">
        {value}
        {unit && <span className="unit"> {unit}</span>}
      </div>
    </div>
  );
}

export const stageTone = (s: string): BadgeTone => {
  const map: Record<string, BadgeTone> = {
    harvesting: "green", fruiting: "green", colonization: "amber",
    inoculation: "amber", spawn_to_bulk: "amber", spent: "muted", contaminated: "red",
  };
  return map[s] ?? "muted";
};
