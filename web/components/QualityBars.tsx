import { potencyLevel } from "@/lib/format";

// Small multicolored strength bars that replace the old 5-star priority glyph
// on strain cards. Each quality gets its own brand color and a fill length
// proportional to its strength, so a card reads at a glance: how potent, how
// easy to grow, how productive, how high a priority.

export interface Quality {
  label: string;
  /** 0..1 fill strength, or null when the quality is unrated (empty track). */
  value: number | null;
  /** Short text shown beside the label, e.g. "High", "8/10", "92%". */
  display: string;
  /** CSS color (custom property or literal) for the filled portion. */
  color: string;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function QualityBars({ qualities }: { qualities: Quality[] }) {
  return (
    <div className="quality-bars">
      {qualities.map((q) => {
        const pct = q.value == null ? 0 : Math.round(clamp01(q.value) * 100);
        return (
          <div className="quality" key={q.label}>
            <div className="quality-head">
              <span className="quality-label">{q.label}</span>
              <span className="quality-val">{q.display}</span>
            </div>
            <div
              className={`quality-track${q.value == null ? " is-empty" : ""}`}
              role="meter"
              aria-label={`${q.label}: ${q.display}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
            >
              <span style={{ width: `${pct}%`, background: q.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Build the standard four-quality set from a strain row. Ease is scored out of
// 10 (matching the add-strain form), bio-efficiency out of 100%, priority out
// of 5; potency is mapped from its free-text label.
export function strainQualities(s: {
  potency: string | null;
  ease_rating: number | null;
  typical_be: number | null;
  priority: number | null;
}): Quality[] {
  return [
    {
      label: "Potency",
      value: potencyLevel(s.potency),
      display: s.potency && s.potency !== "—" && s.potency !== "-" ? s.potency : "—",
      color: "var(--bruise)",
    },
    {
      label: "Ease",
      value: s.ease_rating == null ? null : clamp01(s.ease_rating / 10),
      display: s.ease_rating == null ? "—" : `${s.ease_rating}/10`,
      color: "var(--moss)",
    },
    {
      label: "Bio-eff",
      value: s.typical_be == null ? null : clamp01(s.typical_be / 100),
      display: s.typical_be == null ? "—" : `${s.typical_be}%`,
      color: "var(--lumen)",
    },
    {
      label: "Priority",
      value: s.priority == null ? null : clamp01(s.priority / 5),
      display: s.priority == null ? "—" : `${s.priority}/5`,
      color: "var(--spore)",
    },
  ];
}
