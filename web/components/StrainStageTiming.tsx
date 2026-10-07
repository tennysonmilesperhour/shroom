import { Badge, Card } from "@/components/ui";
import StageAutomationToggles from "@/components/StageAutomationToggles";
import { createServiceClient } from "@/utils/supabase/service";
import { loadAutomation, loadStrainTiming, strainBaselines } from "@/lib/stage-timing-data";
import {
  AUTOMATION_CONFIDENCE,
  baselineConfidence,
  factorSummary,
  MIN_SAMPLES,
  transitionLabel,
  type Baseline,
} from "@/lib/stage-timing";
import { STAGE_ORDER } from "@/lib/stages";

function sortedSteps(baseline: Baseline) {
  return [...baseline.transitions.values()].sort(
    (a, b) => STAGE_ORDER.indexOf(a.from) - STAGE_ORDER.indexOf(b.from) || STAGE_ORDER.indexOf(a.to) - STAGE_ORDER.indexOf(b.to),
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  const tone = value >= AUTOMATION_CONFIDENCE ? "tone-moss" : value >= 40 ? "tone-spore" : "tone-ember";
  return (
    <span className="timing-confidence" title={`${value}% confidence`}>
      <span className={`meter ${tone}`} aria-hidden="true">
        <span className="meter-fill" style={{ width: `${value}%` }} />
      </span>
      <span>{value}%</span>
    </span>
  );
}

function StepTable({ baseline, caption }: { baseline: Baseline; caption: string }) {
  return (
    <ul className="timing-rows" aria-label={caption}>
      {sortedSteps(baseline).map(({ from, to, stats }) => {
        const enough = stats.n >= MIN_SAMPLES;
        return (
          <li key={`${from}>${to}`} className="timing-row strain">
            <span className="timing-step">{transitionLabel(from, to)}</span>
            <span><span className="k">Runs</span>{stats.n}</span>
            <span><span className="k">Average</span>{enough ? `${stats.mean} d` : <span className="muted">—</span>}</span>
            <span><span className="k">Typical range</span>{enough ? `${stats.low}–${stats.high} d` : <span className="muted">needs {MIN_SAMPLES}</span>}</span>
            <span><span className="k">Confidence</span><ConfidenceMeter value={enough ? stats.confidence : 0} /></span>
          </li>
        );
      })}
    </ul>
  );
}

export default async function StrainStageTiming({ strainId }: { strainId: number }) {
  const supabase = createServiceClient();
  const [data, automation] = await Promise.all([
    loadStrainTiming(supabase, [strainId]),
    loadAutomation(supabase, [strainId]),
  ]);
  const baselines = strainBaselines(data, strainId);
  const confidence = baselineConfidence(baselines.strain);
  const unlocked = confidence >= AUTOMATION_CONFIDENCE;
  const auto = automation[0];
  const reasons = factorSummary(data.notes);
  const explained = data.notes.filter((n) => n.response === "changed").length;
  const containers = [...baselines.container.entries()]
    .filter(([key, b]) => key && b.transitions.size > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <Card title="Stage timing" tour="strain-stage-timing">
      {baselines.strain.transitions.size === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          No completed stage changes yet. Each time a batch moves to its next stage, the days it took are recorded here.
        </p>
      ) : (
        <>
          <StepTable baseline={baselines.strain} caption="Days between stages across every batch of this strain" />
          {containers.length > 1 && containers.map(([key, baseline]) => (
            <details key={key} className="timing-cohort">
              <summary>{key.replace(/_/g, " ")} only</summary>
              <StepTable baseline={baseline} caption={`Days between stages for ${key.replace(/_/g, " ")} batches`} />
            </details>
          ))}
          <p className="muted form-help">
            Contaminated runs{explained > 0 ? ` and ${explained} run${explained === 1 ? "" : "s"} where parameters changed` : ""} are left out of the averages.
          </p>
        </>
      )}

      {reasons.length > 0 && (
        <>
          <div className="eyebrow" style={{ marginTop: "var(--space-3)" }}>Recorded reasons for unusual runs</div>
          <div className="choice-chips compact">
            {reasons.map((r) => (
              <span key={r.factor} className="choice-chip static">
                {r.label} · {r.runs}× · {r.avgShift > 0 ? "+" : ""}{r.avgShift} d
              </span>
            ))}
          </div>
        </>
      )}

      <div data-tour="strain-automation">
        <div className="timing-automation-head">
          <div>
            <div className="eyebrow">Automation</div>
            <span className="muted form-help">
              {unlocked
                ? "Confidence is high enough to automate."
                : `Unlocks at ${AUTOMATION_CONFIDENCE}% confidence. More consistent runs raise it.`}
            </span>
          </div>
          {unlocked ? <Badge tone="green">ready</Badge> : <ConfidenceMeter value={confidence} />}
        </div>
        <StageAutomationToggles
          strainId={strainId}
          alerts={auto?.alerts_enabled ?? false}
          labels={auto?.labels_enabled ?? false}
          unlocked={unlocked}
        />
      </div>
    </Card>
  );
}
