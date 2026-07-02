import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/utils/supabase/service";
import PrintLabel, { sizeFor } from "@/components/PrintLabel";

export const dynamic = "force-dynamic";

// Printable flush label. Lives OUTSIDE the (app) group so it renders without the
// sidebar/chrome; the print stylesheet (globals.css §22) further strips
// everything but the label sheet. Format is monochrome and self-contained so it
// prints crisply on a thermal/label printer.

interface LabelHarvest {
  id: number;
  harvested_on: string;
  flush_number: number;
  sku: string | null;
  weight_kg: number | null;
  dry_weight_kg: number | null;
  grade: string | null;
  batches: {
    lot_code: string;
    container_id: string | null;
    strains: { name: string; species: string | null; mushroom_type: string } | null;
  } | null;
}

export default async function HarvestLabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ size?: string }>;
}) {
  const { id: idParam } = await params;
  const { size: sizeKey } = await searchParams;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("harvests")
    .select(
      "id,harvested_on,flush_number,sku,weight_kg,dry_weight_kg,grade, batches(lot_code,container_id, strains(name,species,mushroom_type))",
    )
    .eq("id", id)
    .single<LabelHarvest>();

  if (error || !data) notFound();

  const size = sizeFor(sizeKey);
  const batch = data.batches;
  const strain = batch?.strains ?? null;
  const dryG = Math.round((data.dry_weight_kg ?? 0) * 1000);
  const sku = (data.sku ?? "").trim() || `${batch?.lot_code ?? "LOT"}-F${data.flush_number}`;
  const typeLabel = strain?.mushroom_type ?? "";

  return (
    <div className="label-page">
      <div className="label-toolbar-wrap no-print">
        <Link href={`/batches`} className="back-link">
          &larr; Back to app
        </Link>
        <PrintLabel size={size} basePath={`/label/harvest/${id}`} />
      </div>

      <div
        className="label-sheet"
        style={{ width: `${size.w}in`, height: `${size.h}in` }}
      >
        <div className="label-row label-top">
          <span className="label-type">{typeLabel || "mushroom"}</span>
          {data.grade && <span className="label-grade">Grade {data.grade}</span>}
        </div>

        <div className="label-strain">{strain?.name ?? batch?.lot_code ?? "—"}</div>
        {strain?.species && <div className="label-species">{strain.species}</div>}

        <div className="label-meta">
          <span>Lot {batch?.lot_code ?? "—"}</span>
          <span>Flush {data.flush_number}</span>
          <span>{data.harvested_on}</span>
          {dryG > 0 && <span>{dryG} g net</span>}
        </div>

        <div className="label-sku-block">
          <span className="label-sku-caption">SKU</span>
          <span className="label-sku">{sku}</span>
        </div>
      </div>

      <p className="label-hint no-print">
        Choose your label size above, then Print. The print dialog is preset to the
        selected stock; set the printer to your label roll and scale to 100%.
      </p>
    </div>
  );
}
