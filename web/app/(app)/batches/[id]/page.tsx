import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Kpi } from "@/components/ui";
import { createServiceClient } from "@/utils/supabase/service";
import { must } from "@/lib/query";
import { stageTone } from "@/components/ui";
import LifecycleRing from "@/components/LifecycleRing";
import AddPanel from "@/components/AddPanel";
import AddHarvestForm from "../../harvests/AddHarvestForm";
import AdvanceStage from "./AdvanceStage";

export const dynamic = "force-dynamic";

interface BatchDetailRow {
  id: number;
  lot_code: string;
  stage: string;
  block_count: number;
  substrate_weight_kg: number;
  container_id: string | null;
  container_type: string | null;
  inoculated_on: string | null;
  colonized_on: string | null;
  fruiting_on: string | null;
  spent_on: string | null;
  contamination_flag: boolean;
  rating: number | null;
  notes: string | null;
  strains: { id: number; name: string } | null;
  rooms: { id: number; name: string } | null;
}

interface HarvestRow {
  id: number;
  harvested_on: string;
  flush_number: number;
  weight_kg: number;
  dry_weight_kg: number;
  dry_ratio_pct: number | null;
  grade: string | null;
}

interface ContamRow {
  id: number;
  observed_on: string;
  contam_type: string;
  severity: "low" | "med" | "high";
  action_taken: string | null;
}

interface OrderLineRow {
  id: number;
  quantity: number;
  unit_price: number;
  harvest_id: number;
  orders: {
    id: number;
    order_number: string;
    order_date: string;
    customers: { id: number; name: string } | null;
  } | null;
  products: { name: string } | null;
}

function daysBetween(a: string | null, b: string | null = null): number | null {
  if (!a) return null;
  const start = new Date(a).getTime();
  const end = b ? new Date(b).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const supabase = createServiceClient();
  const [batchRows, harvests, contam] = await Promise.all([
    must<BatchDetailRow[]>(
      supabase
        .from("batches")
        .select("*, strains(id,name), rooms(id,name)")
        .eq("id", id)
        .returns<BatchDetailRow[]>(),
      "load batch",
    ),
    must<HarvestRow[]>(
      supabase
        .from("harvests")
        .select("*")
        .eq("batch_id", id)
        .order("harvested_on", { ascending: false }),
      "load harvests for batch",
    ),
    must<ContamRow[]>(
      supabase
        .from("contamination_logs")
        .select("*")
        .eq("batch_id", id)
        .order("observed_on", { ascending: false }),
      "load contamination log for batch",
    ),
  ]);

  const batch = batchRows[0];
  if (!batch) notFound();

  // Downstream orders: order_lines linked to one of this batch's harvests.
  const harvestIds = harvests.map((h) => h.id);
  const downstream =
    harvestIds.length > 0
      ? await must<OrderLineRow[]>(
          supabase
            .from("order_lines")
            .select(
              "id,quantity,unit_price,harvest_id, orders(id,order_number,order_date, customers(id,name)), products(name)",
            )
            .in("harvest_id", harvestIds)
            .returns<OrderLineRow[]>(),
          "load downstream orders",
        )
      : [];

  const elapsedSinceInoc = daysBetween(batch.inoculated_on);
  const elapsedInStage =
    batch.stage === "fruiting"
      ? daysBetween(batch.fruiting_on)
      : batch.stage === "colonization"
        ? daysBetween(batch.colonized_on)
        : batch.stage === "spent"
          ? null
          : daysBetween(batch.inoculated_on);

  const totalFresh = harvests.reduce((s, h) => s + (h.weight_kg ?? 0), 0);
  const totalDry = harvests.reduce((s, h) => s + (h.dry_weight_kg ?? 0), 0);
  const overallRatio = totalFresh > 0 ? Math.round((totalDry / totalFresh) * 1000) / 10 : 0;
  const overallBe =
    batch.substrate_weight_kg > 0
      ? Math.round((totalFresh / batch.substrate_weight_kg) * 1000) / 10
      : 0;

  const effectiveStage = batch.contamination_flag ? "contaminated" : batch.stage;

  return (
    <>
      <Link href="/batches" className="back-link">
        &larr; Batches
      </Link>

      <div>
        <div className="eyebrow">Production</div>
        <h1 className="section">Lot {batch.lot_code}</h1>
        <div className="hero-meta">
          <Badge tone={stageTone(effectiveStage)}>{effectiveStage}</Badge>
          {batch.contamination_flag && <Badge tone="red">contamination flagged</Badge>}
          {batch.strains && (
            <Link href={`/strains/${batch.strains.id}`} className="badge muted">
              {batch.strains.name}
            </Link>
          )}
          {batch.rooms && <Badge tone="muted">{batch.rooms.name}</Badge>}
          {batch.container_id && <Badge tone="muted">{batch.container_id}</Badge>}
        </div>
      </div>

      <div className="batch-hero">
        <LifecycleRing
          stage={effectiveStage}
          centerLabel={elapsedInStage != null ? "Days in stage" : "Stage"}
          centerValue={elapsedInStage != null ? elapsedInStage : undefined}
        />
        <div className="batch-hero-stats">
          <Kpi label="Units" countTo={batch.block_count} />
          <Kpi label="Substrate" countTo={batch.substrate_weight_kg ?? 0} decimals={1} unit="kg" />
          <Kpi
            label="Fresh harvested"
            countTo={Math.round(totalFresh * 1000)}
            unit="g"
            feature
          />
          <Kpi label="Dry ratio" countTo={overallRatio} decimals={1} unit="%" />
          <Kpi label="Bio-efficiency" countTo={overallBe} decimals={1} unit="%" />
          <Kpi label="Elapsed" value={elapsedSinceInoc ?? "—"} unit="d" />
        </div>
      </div>

      <Card title="Lifecycle log">
        <dl className="kv kv-3">
          <dt>Inoculated</dt><dd>{batch.inoculated_on ?? "—"}</dd>
          <dt>Colonized</dt><dd>{batch.colonized_on ?? "—"}</dd>
          <dt>Fruiting</dt><dd>{batch.fruiting_on ?? "—"}</dd>
          <dt>Spent</dt><dd>{batch.spent_on ?? "—"}</dd>
          <dt>Container</dt><dd>{batch.container_type ?? "—"}</dd>
          <dt>Rating</dt><dd>{batch.rating ? `${batch.rating}/10` : "—"}</dd>
        </dl>
        <div style={{ marginTop: "var(--space-3)" }}>
          <AdvanceStage batchId={batch.id} currentStage={effectiveStage} />
        </div>
      </Card>

      <AddPanel label="Log harvest from this batch" buttonLabel="Log harvest from this batch">
        <AddHarvestForm
          batches={[{
            id: batch.id,
            lot_code: batch.lot_code,
            strain: batch.strains?.name ?? null,
          }]}
          defaultBatchId={batch.id}
        />
      </AddPanel>

      <Card title="Harvests">
        {harvests.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No harvests yet. Once this batch enters fruiting, flushes are recorded here.
          </p>
        ) : (
          <table>
            <caption className="sr-only">Harvests for this batch</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col" className="right">Flush</th>
                <th scope="col" className="right">Fresh (g)</th>
                <th scope="col" className="right">Dry (g)</th>
                <th scope="col" className="right">Ratio</th>
                <th scope="col">Grade</th>
              </tr>
            </thead>
            <tbody>
              {harvests.map((h) => (
                <tr key={h.id}>
                  <td>{h.harvested_on}</td>
                  <td className="right">F{h.flush_number}</td>
                  <td className="right">{Math.round(h.weight_kg * 1000)}</td>
                  <td className="right">{Math.round(h.dry_weight_kg * 1000)}</td>
                  <td className="right">{h.dry_ratio_pct ?? "—"}%</td>
                  <td><Badge tone="muted">{h.grade ?? "—"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {contam.length > 0 && (
        <Card title="Contamination sightings">
          <table>
            <caption className="sr-only">Contamination log for this batch</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Type</th>
                <th scope="col">Severity</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {contam.map((c) => (
                <tr key={c.id}>
                  <td className="muted">{c.observed_on}</td>
                  <td>{c.contam_type}</td>
                  <td>
                    <Badge
                      tone={
                        c.severity === "high"
                          ? "red"
                          : c.severity === "med"
                            ? "amber"
                            : "muted"
                      }
                    >
                      {c.severity}
                    </Badge>
                  </td>
                  <td>{c.action_taken ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card title="Downstream orders">
        {downstream.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No order lines have been linked to this batch&rsquo;s harvests yet.
          </p>
        ) : (
          <table>
            <caption className="sr-only">Orders fulfilled from this batch</caption>
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Customer</th>
                <th scope="col">Product</th>
                <th scope="col">Date</th>
                <th scope="col" className="right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {downstream.map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.orders ? (
                      <Link href={`/orders`} className="row-anchor">
                        <b>{d.orders.order_number}</b>
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {d.orders?.customers ? (
                      <Link
                        href={`/customers/${d.orders.customers.id}`}
                        className="row-anchor"
                      >
                        {d.orders.customers.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{d.products?.name ?? "—"}</td>
                  <td>{d.orders?.order_date ?? "—"}</td>
                  <td className="right">{d.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {batch.notes && (
        <Card title="Notes" variant="quiet">
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{batch.notes}</p>
        </Card>
      )}
    </>
  );
}
