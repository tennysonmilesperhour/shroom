import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { createServiceClient } from "@/utils/supabase/service";
import { loadUpcomingStages, today } from "@/lib/stage-timing-data";
import { AUTOMATION_CONFIDENCE, daysBetween } from "@/lib/stage-timing";
import { STAGE_LABEL } from "@/lib/stages";

const shortDate = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function when(daysUntil: number): string {
  if (daysUntil < 0) return `${-daysUntil} d overdue`;
  if (daysUntil === 0) return "today";
  if (daysUntil === 1) return "tomorrow";
  return `in ${daysUntil} d`;
}

/**
 * Batches of strains with automation switched on that are expected to change
 * stage within two days. Renders nothing until a strain is automated.
 */
export default async function UpcomingStageChanges({ strainIds }: { strainIds: number[] }) {
  const upcoming = await loadUpcomingStages(createServiceClient(), strainIds, 2, AUTOMATION_CONFIDENCE);
  if (upcoming.length === 0) return null;
  const now = today();
  // Stickers only for batches still inside their usual window.
  const labelled = upcoming.filter((u) => u.labels && u.daysUntil <= 1 && daysBetween(now, u.latestOn) >= 0);
  const labelIds = labelled.map((u) => u.batchId);

  return (
    <Card title="Upcoming stage changes">
      <ul className="timing-upcoming">
        {upcoming.map((u) => (
          <li key={u.batchId}>
            <Link href={`/batches/${u.batchId}`} className="row-anchor"><b>{u.lotCode}</b></Link>
            <span>{STAGE_LABEL[u.next]} {when(u.daysUntil)}</span>
            <span className="muted">usually {shortDate(u.earliestOn)}{u.earliestOn === u.latestOn ? "" : ` – ${shortDate(u.latestOn)}`}</span>
            {u.daysUntil < 0 && <Badge tone="amber">check</Badge>}
          </li>
        ))}
      </ul>
      {labelIds.length > 0 && (
        <a
          className="timing-print-link"
          href={`/label/batches?ids=${labelIds.join(",")}&next=${labelled.map((u) => u.next).join(",")}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Print {labelIds.length} next-stage label{labelIds.length === 1 ? "" : "s"} ↗
        </a>
      )}
    </Card>
  );
}
