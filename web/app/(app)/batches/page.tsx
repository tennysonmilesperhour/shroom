import { createClient } from "@/utils/supabase/server";
import { Badge, stageTone } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BatchesPage() {
  const supabase = await createClient();
  const { data: batches } = await supabase
    .from("batches")
    .select("*, strains(name), rooms(name)")
    .order("created_at", { ascending: false });

  return (
    <>
      <h2 className="section">Production Batches</h2>
      <p className="lead">Each batch is a traceable lot through the grain-bag-to-tub lifecycle.</p>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Lot</th><th>Container</th><th>Strain</th><th>Stage</th><th>Room</th>
              <th className="right">Units</th><th className="right">Substrate</th><th>Inoculated</th><th className="right">Rating</th>
            </tr>
          </thead>
          <tbody>
            {(batches ?? []).map((b: any) => (
              <tr key={b.id}>
                <td><b>{b.lot_code}</b>{b.contamination_flag && <> <Badge tone="red">contam</Badge></>}</td>
                <td>{b.container_id || "—"}<span className="muted"> {b.container_type}</span></td>
                <td>{b.strains?.name ?? "?"}</td>
                <td><Badge tone={stageTone(b.stage)}>{b.stage}</Badge></td>
                <td>{b.rooms?.name ?? "—"}</td>
                <td className="right">{b.block_count}</td>
                <td className="right">{b.substrate_weight_kg} kg</td>
                <td>{b.inoculated_on ?? "—"}</td>
                <td className="right">{b.rating ? `${b.rating}/10` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
