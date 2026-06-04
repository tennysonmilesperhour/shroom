import { createServiceClient } from "@/utils/supabase/service";
import { must } from "@/lib/query";
import { traceLot } from "./actions";
import TraceForm from "./TraceForm";

export const dynamic = "force-dynamic";

interface LotRow {
  lot_code: string;
  stage: string;
}

export default async function TraceabilityPage() {
  const supabase = createServiceClient();
  const lots = await must<LotRow[]>(
    supabase.from("batches").select("lot_code,stage").order("created_at", { ascending: false }),
    "load lots",
  );

  // Pre-trace the most recent lot so the page lands populated.
  const initial = lots[0]?.lot_code ? await traceLot(lots[0].lot_code) : null;

  return (
    <>
      <div>
        <div className="eyebrow">Compliance</div>
        <h1 className="section">Lot traceability &amp; recall</h1>
        <p className="lead">
          FSMA-204 one-click trace: pick a lot to see every affected customer &amp; shipment.
        </p>
      </div>

      <TraceForm lots={lots} initial={initial} />
    </>
  );
}
