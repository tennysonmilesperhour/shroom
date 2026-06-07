import { ReactNode } from "react";
import CountUp from "./anim/CountUp";
import Sparkline from "./anim/Sparkline";
import TiltCard from "./anim/TiltCard";

export type BadgeTone = "green" | "amber" | "red" | "blue" | "violet" | "muted";
export type CardVariant = "default" | "quiet" | "featured";

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
  /** Static value. Ignored when `countTo` is provided. */
  value?: ReactNode;
  unit?: string;
  delta?: string;
  feature?: boolean;
  /** Opt-in animation: count the value up from 0 on view. */
  countTo?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Opt-in real trend series (≥2 points) → glowing sparkline. */
  series?: number[];
  /** Opt-in magnetic tilt + cursor glow on the card. */
  tilt?: boolean;
}

export function Kpi({
  label,
  value,
  unit,
  delta,
  feature,
  countTo,
  decimals = 0,
  prefix,
  suffix,
  series,
  tilt = true,
}: KpiProps) {
  const valueNode =
    countTo != null ? (
      <CountUp value={countTo} decimals={decimals} prefix={prefix} suffix={suffix} />
    ) : (
      value
    );

  const inner = (
    <>
      <div className="label">{label}</div>
      <div>
        <span className="value">{valueNode}</span>
        {unit && <span className="unit">{unit}</span>}
        {delta && <div className="delta">{delta}</div>}
      </div>
      {series && series.length > 1 && <Sparkline series={series} />}
    </>
  );

  const className = `card kpi${feature ? " feature" : ""}`;
  return tilt ? (
    <TiltCard className={className}>{inner}</TiltCard>
  ) : (
    <div className={className}>{inner}</div>
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
