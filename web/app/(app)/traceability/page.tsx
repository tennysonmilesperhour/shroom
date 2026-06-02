"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Kpi, Card } from "@/components/ui";

export default function TraceabilityPage() {
  const supabase = createClient();
  const [lots, setLots] = useState<{ lot_code: string; stage: string }[]>([]);
  const [lot, setLot] = useState("");
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("batches")
      .select("lot_code,stage")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setLots(data ?? []);
        if (data && data[0]) setLot(data[0].lot_code);
      });
  }, []);

  async function trace(code: string) {
    if (!code) return;
    setBusy(true);
    const { data } = await supabase.rpc("recall_trace", { p_lot: code });
    setResult(data);
    setBusy(false);
  }

  useEffect(() => {
    if (lot) trace(lot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot]);

  const affected = result?.affected_orders ?? [];
  const customers = new Set(affected.map((o: any) => o.customer)).size;

  return (
    <>
      <h2 className="section">Lot Traceability & Recall</h2>
      <p className="lead">FSMA-204 one-click trace: pick a lot to see every affected customer & shipment.</p>
      <Card>
        <div style={{ display: "flex", gap: 10, maxWidth: 480 }}>
          <select value={lot} onChange={(e) => setLot(e.target.value)}>
            {lots.map((l) => (
              <option key={l.lot_code} value={l.lot_code}>{l.lot_code} — {l.stage}</option>
            ))}
          </select>
          <button className="primary" onClick={() => trace(lot)} disabled={busy}>Trace</button>
        </div>
      </Card>

      {result && (
        <>
          <div className="grid kpis">
            <Kpi label="Harvests" value={result.harvests ?? 0} />
            <Kpi label="Orders hit" value={affected.length} />
            <Kpi label="Customers hit" value={customers} />
            <Kpi label="Strain" value={result.strain ?? "—"} />
          </div>
          <Card title="Affected shipments">
            {affected.length === 0 ? (
              <div className="muted">No shipments traced to this lot yet.</div>
            ) : (
              <table>
                <thead><tr><th>Order</th><th>Customer</th><th>Channel</th><th>Product</th><th className="right">Qty</th><th>Fulfilled</th></tr></thead>
                <tbody>
                  {affected.map((o: any, i: number) => (
                    <tr key={i}>
                      <td>{o.order_number}</td><td>{o.customer}</td><td>{o.channel}</td>
                      <td>{o.product}</td><td className="right">{o.quantity}</td><td>{o.fulfillment_date ?? "—"}</td>
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
