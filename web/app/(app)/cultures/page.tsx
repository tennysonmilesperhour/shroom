import { createServiceClient } from "@/utils/supabase/service";
import { Badge, Card } from "@/components/ui";
import { soft } from "@/lib/query";
import AddPanel from "@/components/AddPanel";
import AddCultureForm from "./AddCultureForm";
import QuickAdjust from "./QuickAdjust";
import StatusSelect from "./StatusSelect";
import {
  CULTURE_STATUSES,
  cultureStatusOrder,
  cultureTypeLabel,
} from "./constants";

export const dynamic = "force-dynamic";

interface CultureRow {
  id: number;
  label: string;
  culture_type: string;
  strain_id: number | null;
  status: string;
  quantity_on_hand: number;
  unit: string;
  reorder_threshold: number;
  location: string;
  source: string;
  acquired_on: string | null;
  expires_on: string | null;
  notes: string;
}

interface StrainRow {
  id: number;
  name: string;
}

export default async function CulturesPage() {
  const supabase = createServiceClient();
  // soft() so the page degrades to an empty register if migration 14 hasn't
  // been applied to this environment yet, instead of taking the route down.
  const [cultures, strains] = await Promise.all([
    soft<CultureRow>(supabase.from("culture_inventory").select("*").order("label")),
    soft<StrainRow>(supabase.from("strains").select("id,name").order("name")),
  ]);

  const strainName = new Map(strains.map((s) => [s.id, s.name]));
  const today = new Date().toISOString().slice(0, 10);

  const isLow = (c: CultureRow) =>
    c.reorder_threshold > 0 && c.quantity_on_hand <= c.reorder_threshold;
  const isAging = (c: CultureRow) => !!c.expires_on && c.expires_on < today;

  // Pipeline order, then alphabetical, so the table reads like the workflow.
  const ordered = [...cultures].sort((a, b) => {
    const d = cultureStatusOrder(a.status) - cultureStatusOrder(b.status);
    return d !== 0 ? d : a.label.localeCompare(b.label);
  });

  const counts = new Map<string, number>();
  for (const c of cultures) counts.set(c.status, (counts.get(c.status) ?? 0) + 1);
  const lowCount = cultures.filter(isLow).length;
  const agingCount = cultures.filter(isAging).length;

  return (
    <>
      <div>
        <div className="eyebrow">Cultivation</div>
        <h1 className="section">Cultures &amp; spores</h1>
        <p className="lead">
          Every spore syringe, print, agar plate, liquid culture and grain-spawn jar,
          tracked through its lifecycle — from ordered and in-transit, to in the fridge
          ready to inoculate, to colonizing and ready to use.
          {lowCount > 0 && (
            <>
              {" "}
              <span style={{ color: "var(--ember)" }}>
                {lowCount} need reorder.
              </span>
            </>
          )}
          {agingCount > 0 && (
            <>
              {" "}
              <span style={{ color: "var(--ember)" }}>
                {agingCount} aging out.
              </span>
            </>
          )}
        </p>
      </div>

      <div className="pipeline-strip" role="list" aria-label="Lifecycle pipeline">
        {CULTURE_STATUSES.map(([value, label, tone]) => (
          <div className="pipeline-chip" role="listitem" key={value}>
            <Badge tone={tone}>{label}</Badge>
            <span className="pipeline-count">{counts.get(value) ?? 0}</span>
          </div>
        ))}
      </div>

      <AddPanel label="New culture">
        <AddCultureForm strains={strains} />
      </AddPanel>

      <Card title="Culture & spore library">
        {ordered.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No cultures or spores tracked yet. Add your first unit above.
          </p>
        ) : (
          <table>
            <caption className="sr-only">Culture and spore inventory by lifecycle stage</caption>
            <thead>
              <tr>
                <th scope="col">Unit</th>
                <th scope="col">Type</th>
                <th scope="col">Strain</th>
                <th scope="col">Stage</th>
                <th scope="col" className="right">On hand</th>
                <th scope="col">Location</th>
                <th scope="col">Use by</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((c) => (
                <tr key={c.id} className={isLow(c) ? "flag-low" : ""}>
                  <td>
                    <b>{c.label}</b>
                    {c.notes && (
                      <div className="muted" style={{ fontSize: 11 }}>{c.notes}</div>
                    )}
                  </td>
                  <td className="muted">{cultureTypeLabel(c.culture_type)}</td>
                  <td className="muted">
                    {c.strain_id !== null ? strainName.get(c.strain_id) ?? "?" : "-"}
                  </td>
                  <td><StatusSelect cultureId={c.id} status={c.status} /></td>
                  <td className="right">
                    {c.quantity_on_hand} {c.unit}
                    <QuickAdjust cultureId={c.id} />
                  </td>
                  <td className="muted">{c.location || "-"}</td>
                  <td>
                    {c.expires_on ? (
                      isAging(c) ? (
                        <Badge tone="red">aging · {c.expires_on}</Badge>
                      ) : (
                        <span className="muted">{c.expires_on}</span>
                      )
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td className="muted">{c.source || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
