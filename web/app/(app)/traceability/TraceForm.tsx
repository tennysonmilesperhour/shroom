"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { Kpi, Card } from "@/components/ui";
import { traceLot, type TraceResult, type TraceShipment } from "./actions";

interface LotOption {
  lot_code: string;
  stage: string;
}

interface TraceFormProps {
  lots: LotOption[];
  initial: TraceResult | null;
}

export default function TraceForm({ lots, initial }: TraceFormProps) {
  const selectId = useId();
  const [lot, setLot] = useState<string>(lots[0]?.lot_code ?? "");
  const [result, setResult] = useState<TraceResult | null>(initial);
  const [pending, startTransition] = useTransition();

  function run(code: string) {
    if (!code) return;
    startTransition(async () => {
      const r = await traceLot(code);
      setResult(r);
    });
  }

  // Auto-trace whenever lot selection changes.
  useEffect(() => {
    if (lot) run(lot);
  }, [lot]);

  const affected: TraceShipment[] = result?.data?.affected_orders ?? [];
  const customers = new Set(affected.map((o) => o.customer)).size;

  return (
    <>
      <Card>
        <div style={{ display: "flex", gap: 10, maxWidth: 520, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label htmlFor={selectId} className="eyebrow" style={{ display: "block", marginBottom: 4 }}>
              Lot
            </label>
            <select
              id={selectId}
              value={lot}
              onChange={(e) => setLot(e.target.value)}
              disabled={lots.length === 0}
            >
              {lots.length === 0 ? (
                <option value="">No lots available</option>
              ) : (
                lots.map((l) => (
                  <option key={l.lot_code} value={l.lot_code}>
                    {l.lot_code} - {l.stage}
                  </option>
                ))
              )}
            </select>
          </div>
          <button
            type="button"
            className="primary"
            onClick={() => run(lot)}
            disabled={pending || !lot}
          >
            {pending ? "Tracing…" : "Trace"}
          </button>
        </div>
        {result && !result.ok && (
          <p className="err" style={{ marginTop: 10 }}>{result.message}</p>
        )}
      </Card>

      {result?.ok && result.data && (
        <>
          <div className="kpi-row">
            <Kpi label="Orders hit" value={affected.length} feature />
            <Kpi label="Harvests" value={result.data.harvests ?? 0} />
            <Kpi label="Customers hit" value={customers} />
            <Kpi label="Strain" value={result.data.strain ?? "-"} />
          </div>

          <Card title="Affected shipments">
            {affected.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No shipments traced to this lot yet.
              </p>
            ) : (
              <table>
                <caption className="sr-only">Shipments affected by this lot</caption>
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Channel</th>
                    <th scope="col">Product</th>
                    <th scope="col" className="right">Qty</th>
                    <th scope="col">Fulfilled</th>
                  </tr>
                </thead>
                <tbody>
                  {affected.map((o) => (
                    <tr key={`${o.order_number}-${o.product}`}>
                      <td>{o.order_number}</td>
                      <td>{o.customer}</td>
                      <td>{o.channel}</td>
                      <td>{o.product}</td>
                      <td className="right">{o.quantity}</td>
                      <td>{o.fulfillment_date ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </>
  );
}
