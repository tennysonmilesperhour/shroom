import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/utils/supabase/service";
import PrintLabel from "@/components/PrintLabel";
import BatchLabelSheet, { type BatchLabelData } from "@/components/BatchLabelSheet";
import { batchQrDataUrl } from "@/lib/label-qr";
import { sizeFor } from "@/lib/label-size";

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

export default async function BatchLabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ size?: string }>;
}) {
  const { id: rawId } = await params;
  const { size: sizeKey } = await searchParams;
  const id = Number(rawId);
  if (!Number.isFinite(id)) notFound();

  const { data, error } = await createServiceClient()
    .from("batches")
    .select("id,lot_code,container_id,container_type,stage,inoculated_on,strains(name,species),rooms(name)")
    .eq("id", id)
    .single<BatchLabelRow>();
  if (error || !data) notFound();

  const size = sizeFor(sizeKey);
  const label: BatchLabelData = {
    id: data.id,
    lotCode: data.lot_code,
    containerId: data.container_id,
    containerType: data.container_type,
    stage: data.stage,
    inoculatedOn: data.inoculated_on,
    strain: data.strains?.name ?? null,
    species: data.strains?.species ?? null,
    room: data.rooms?.name ?? null,
    qrDataUrl: await batchQrDataUrl(data.id),
  };

  return (
    <div className="label-page">
      <div className="label-toolbar-wrap no-print">
        <Link href={`/batches/${id}`} className="back-link">&larr; Back to batch</Link>
        <PrintLabel size={size} basePath={`/label/batch/${id}`} />
      </div>
      <BatchLabelSheet data={label} size={size} />
      <p className="label-hint no-print">The QR opens this batch’s live record, so the printed label stays current as its stage and room change.</p>
    </div>
  );
}
