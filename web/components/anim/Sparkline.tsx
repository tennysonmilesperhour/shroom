"use client";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useInView } from "@/hooks/useInView";

interface SparklineProps {
  /** Real numeric series, oldest → newest. Needs ≥ 2 points to render. */
  series: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  /** Show a glowing dot on the latest point. Default true. */
  showHead?: boolean;
  className?: string;
}

// Draws a real data series as a glowing line that animates in (stroke draw via
// the normalized pathLength trick — no getTotalLength JS). Renders nothing for
// empty/degenerate series rather than faking a line. Reduced-motion → drawn.
export default function Sparkline({
  series,
  width = 100,
  height = 30,
  strokeWidth = 2,
  showHead = true,
  className,
}: SparklineProps) {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<SVGSVGElement>();

  if (!series || series.length < 2) return null;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const pad = strokeWidth;
  const innerH = height - pad * 2;
  const stepX = width / (series.length - 1);

  const points = series.map((v, i) => {
    const x = i * stepX;
    const y = pad + innerH * (1 - (v - min) / span);
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const [hx, hy] = points[points.length - 1];
  const drawn = inView || reduced;

  return (
    <svg
      ref={ref}
      className={`sparkline ${className ?? ""}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path className="sparkline-area" d={area} />
      <path
        className={`sparkline-line ${drawn ? "in" : ""}`}
        d={line}
        pathLength={1}
        strokeWidth={strokeWidth}
      />
      {showHead && (
        <circle className={`sparkline-head ${drawn ? "in" : ""}`} cx={hx} cy={hy} r={2.4} />
      )}
    </svg>
  );
}
