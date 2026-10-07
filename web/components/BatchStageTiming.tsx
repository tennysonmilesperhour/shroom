import { Badge, Card } from "@/components/ui";
import StageTimingPrompt, { type TimingPromptData } from "@/components/StageTimingPrompt";
import { createServiceClient } from "@/utils/supabase/service";
import { loadStrainTiming, strainBaselines, today, type StrainTimingBatch } from "@/lib/stage-timing-data";
import {
  baselineFor,
  batchDepartures,
  batchTimeline,
  factorSummary,
  FACTOR_LABEL,
  MIN_SAMPLES,
  transitionKey,
  transitionLabel,
  type TimingStats,
} from "@/lib/stage-timing";
import { STAGE_LABEL, STAGE_ORDER, type Stage } from "@/lib/stages";

function usual(stats: TimingStats | null | undefined): string {
  if (!stats) return "—";
  const range = stats.low === stats.high ? "" : ` (${stats.low}–${stats.high})`;
  return `${stats.median} d${range}`;
}

function mode<T>(values: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** Where this batch's setup differs from what its cohort usually uses. */
function setupDifferences(
  batch: StrainTimingBatch,
  peers: StrainTimingBatch[],
  roomName: (id: number | null) => string,
): { factor: string; hint: string }[] {
  if (peers.length < MIN_SAMPLES) return [];
  const checks: { factor: string; field: keyof StrainTimingBatch; label: string; show?: (v: unknown) => string }[] = [
    { factor: "substrate", field: "substrate_type", label: "substrate" },
    { factor: "spawn", field: "spawn_type", label: "spawn" },
    { factor: "container", field: "tub_size", label: "tub size" },
    { factor: "room", field: "room_id", label: "room", show: (v) => roomName(v as number | null) },
  ];
  const out: { factor: string; hint: string }[] = [];
  for (const check of checks) {
    const mine = batch[check.field];
    const usualValue = mode(peers.map((p) => p[check.field]).filter((v) => v != null && v !== ""));
    if (mine == null || mine === "" || usualValue === undefined || mine === usualValue) continue;
    const show = check.show ?? String;
    out.push({ factor: check.factor, hint: `${check.label} ${show(mine)} (usually ${show(usualValue)})` });
  }
  return out;
}

export default async function BatchStageTiming({
  batchId,
  strainId,
  strainName,
  rooms,
}: {
  batchId: number;
  strainId: number;
  strainName: string;
  rooms: { id: number; name: string }[];
}) {
  const supabase = createServiceClient();
  const data = await loadStrainTiming(supabase, [strainId]);
  const batch = data.batches.find((b) => b.id === batchId);
  if (!batch) return null;

  const baselines = strainBaselines(data, strainId, batchId);
  const timeline = batchTimeline(batch, data.eventsByBatch.get(batchId) ?? [], today());
  const answered = new Set(data.notes.filter((n) => n.batch_id === batchId).map((n) => n.from_stage));
  const roomName = (id: number | null) => rooms.find((r) => r.id === id)?.name ?? "none";
  const peers = data.batches.filter((b) => b.id !== batchId && !b.contamination_flag);
  const containerPeers = peers.filter((b) => b.container_type === batch.container_type);
  const containerLabel = (batch.container_type ?? "").replace(/_/g, " ");

  const deps = batchDepartures(batch, timeline, baselines);
  // Latest stage first; only one prompt shows at a time so the card stays quiet.
  const prompts: TimingPromptData[] = deps
    .filter((d) => !answered.has(d.from))
    .sort((a, b) => STAGE_ORDER.indexOf(b.from) - STAGE_ORDER.indexOf(a.from))
    .map((d) => {
      const cohort = d.scope === "container" && containerLabel ? `${strainName} ${containerLabel}s` : strainName;
      const step = d.to ? transitionLabel(d.from, d.to) : STAGE_LABEL[d.from];
      return {
        fromStage: d.from,
        headline: d.to
          ? `${step} took ${d.days} days, ${d.direction === "slow" ? "longer" : "shorter"} than usual.`
          : `${step} is on day ${d.days}, past the usual range.`,
        expected: `${cohort} usually take ${d.expected.median} days (${d.expected.low}–${d.expected.high}, ${d.expected.n} runs).`,
        direction: d.direction,
        suggested: setupDifferences(batch, d.scope === "container" ? containerPeers : peers, roomName),
        likely: factorSummary(data.notes, d.direction).slice(0, 3),
      };
    });
  const flagged = new Map(deps.map((d) => [d.from, d.direction]));
  const notesByStage = new Map(data.notes.filter((n) => n.batch_id === batchId).map((n) => [n.from_stage, n]));

  const rows = [
    ...timeline.transitions.map((t) => {
      const { baseline } = baselineFor(baselines, batch.container_type, t.from);
      return { key: `${t.from}>${t.to}`, from: t.from, label: transitionLabel(t.from, t.to), days: t.days, stats: baseline.transitions.get(transitionKey(t.from, t.to))?.stats, open: false };
    }),
    ...(timeline.open
      ? [(() => {
          const open = timeline.open;
          const { baseline } = baselineFor(baselines, batch.container_type, open.from);
          const stats = baseline.byFrom.get(open.from);
          return { key: `${open.from}>open`, from: open.from, label: `${STAGE_LABEL[open.from]} (in progress)`, days: open.days, stats, open: true };
        })()]
      : []),
  ].sort((a, b) => STAGE_ORDER.indexOf(a.from as Stage) - STAGE_ORDER.indexOf(b.from as Stage));

  if (rows.length === 0) return null;
  const hasBaseline = rows.some((r) => (r.stats?.n ?? 0) >= MIN_SAMPLES);

  return (
    <Card title="Stage timing" tour="batch-stage-timing">
      {prompts[0] && <StageTimingPrompt key={prompts[0].fromStage} batchId={batchId} prompt={prompts[0]} more={prompts.length - 1} />}
      <ul className="timing-rows" aria-label="Days this batch spent in each stage compared with its strain">
        {rows.map((row) => {
          const direction = flagged.get(row.from);
          const note = notesByStage.get(row.from);
          const enough = (row.stats?.n ?? 0) >= MIN_SAMPLES;
          return (
            <li key={row.key} className="timing-row batch">
              <span className="timing-step">{row.label}</span>
              <span><span className="k">This batch</span>{row.open ? `day ${row.days}` : `${row.days} d`}</span>
              <span>
                <span className="k">Usual</span>
                {enough ? usual(row.stats) : <span className="muted">{row.stats ? `${row.stats.n} run${row.stats.n === 1 ? "" : "s"} so far` : "no data"}</span>}
              </span>
              <span>
                {!enough ? (
                  <Badge tone="muted">learning</Badge>
                ) : direction ? (
                  <Badge tone={direction === "slow" ? "amber" : "blue"}>
                    {direction === "slow" ? "slower" : "faster"}
                    {note?.response === "changed" && note.factors.length > 0
                      ? ` · ${note.factors.map((f) => FACTOR_LABEL[f] ?? f).join(", ").toLowerCase()}`
                      : ""}
                  </Badge>
                ) : (
                  <Badge tone="green">{row.open ? "on track" : "typical"}</Badge>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {!hasBaseline && (
        <p className="muted form-help">
          Averages appear once {MIN_SAMPLES} {strainName} batches have completed a step.
        </p>
      )}
    </Card>
  );
}
