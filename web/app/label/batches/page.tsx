import Link from "next/link";
import { createServiceClient } from "@/utils/supabase/service";
import PrintLabel, { sizeFor } from "@/components/PrintLabel";
import BatchLabelSheet, { type BatchLabelData } from "@/components/BatchLabelSheet";
import { batchQrDataUrl } from "@/lib/label-qr";

export const dynamic = "force-dynamic";

interface BatchLabelRow {
  id: number;
  lot_code: string;
  container_id: string | null;
  container_type: string | null;
  stage: string;
  inoculated_on: string | null;
  strains: { name: string; species: string | null } | null;
  rooms: { name: string } | null;
}

export default async function BatchLabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; size?: string }>;
}) {
  const { ids: rawIds = "", size: sizeKey } = await searchParams;
  const ids = [...new Set(rawIds.split(",").map(Number).filter(Number.isFinite))].slice(0, 100);
  const size = sizeFor(sizeKey);
  const rows = ids.length
    ? ((await createServiceClient()
        .from("batches")
        .select("id,lot_code,container_id,container_type,stage,inoculated_on,strains(name,species),rooms(name)")
        .in("id", ids)
        .returns<BatchLabelRow[]>()).data ?? [])
    : [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = ids.map((id) => byId.get(id)).filter((row): row is BatchLabelRow => Boolean(row));
  const labels: BatchLabelData[] = await Promise.all(
    ordered.map(async (row) => ({
      id: row.id,
      lotCode: row.lot_code,
      containerId: row.container_id,
      containerType: row.container_type,
      stage: row.stage,
      inoculatedOn: row.inoculated_on,
      strain: row.strains?.name ?? null,
      species: row.strains?.species ?? null,
      room: row.rooms?.name ?? null,
      qrDataUrl: await batchQrDataUrl(row.id),
    })),
  );

  return (
    <div className="label-page batch-label-pages">
      <div className="label-toolbar-wrap no-print">
        <Link href="/batches" className="back-link">&larr; Back to batches</Link>
        {labels.length > 0 && <PrintLabel size={size} basePath={`/label/batches?ids=${ids.join(",")}`} />}
      </div>
      {labels.length === 0 ? (
        <p className="muted no-print">Select batches in Bulk actions, then choose Print QR labels.</p>
      ) : (
        labels.map((label) => <BatchLabelSheet key={label.id} data={label} size={size} />)
      )}
    </div>
  );
}
