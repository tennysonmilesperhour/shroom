import { ReactNode } from "react";

type BadgeTone = "green" | "amber" | "red" | "blue" | "violet" | "muted";
type CardVariant = "default" | "quiet" | "featured";

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
}

export function Badge({ tone = "muted", children }: BadgeProps) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

interface CardProps {
  title?: string;
  variant?: CardVariant;
  className?: string;
  children: ReactNode;
}

export function Card({ title, variant = "default", className = "", children }: CardProps) {
  const variantClass = variant === "default" ? "" : variant;
  const classes = ["card", variantClass, className].filter(Boolean).join(" ");
  return (
    <div className={classes}>
      {title && <h3>{title}</h3>}
      {children}
    </div>
  );
}

interface KpiProps {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: string;
  feature?: boolean;
}

export function Kpi({ label, value, unit, delta, feature }: KpiProps) {
  return (
    <div className={`card kpi${feature ? " feature" : ""}`}>
      <div className="label">{label}</div>
      <div>
        <span className="value">{value}</span>
        {unit && <span className="unit">{unit}</span>}
        {delta && <div className="delta">{delta}</div>}
      </div>
    </div>
  );
}

export const stageTone = (s: string): BadgeTone => {
  const map: Record<string, BadgeTone> = {
    harvesting: "green",
    fruiting: "green",
    colonization: "amber",
    inoculation: "amber",
    spawn_to_bulk: "amber",
    spent: "muted",
    contaminated: "red",
  };
  return map[s] ?? "muted";
};
