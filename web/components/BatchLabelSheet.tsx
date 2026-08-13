import Image from "next/image";
import type { LabelSize } from "@/components/PrintLabel";

export interface BatchLabelData {
  id: number;
  lotCode: string;
  containerId: string | null;
  containerType: string | null;
  stage: string;
  inoculatedOn: string | null;
  strain: string | null;
  species: string | null;
  room: string | null;
  qrDataUrl: string;
}

export default function BatchLabelSheet({ data, size }: { data: BatchLabelData; size: LabelSize }) {
  return (
    <div
      className="label-sheet batch-label-sheet"
      style={{ width: `${size.w}in`, height: `${size.h}in` }}
    >
      <div className="batch-label-copy">
        <div className="label-row label-top">
          <span className="label-type">Batch · {data.stage.replace(/_/g, " ")}</span>
          {data.room && <span className="label-grade">{data.room}</span>}
        </div>
        <div className="label-strain">{data.strain ?? data.lotCode}</div>
        {data.species && <div className="label-species">{data.species}</div>}
        <div className="batch-label-lot">{data.lotCode}</div>
        <div className="label-meta">
          {data.containerId && <span>{data.containerId}</span>}
          {data.containerType && <span>{data.containerType.replace(/_/g, " ")}</span>}
          {data.inoculatedOn && <span>Inoc {data.inoculatedOn}</span>}
        </div>
      </div>
      <div className="batch-label-qr">
        <Image src={data.qrDataUrl} alt={`QR code for batch ${data.lotCode}`} width={360} height={360} unoptimized />
        <span>Scan to update</span>
      </div>
    </div>
  );
}
