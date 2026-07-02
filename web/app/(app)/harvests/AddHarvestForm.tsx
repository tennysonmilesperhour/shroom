"use client";

import { useId, useState } from "react";
import EntityForm from "@/components/EntityForm";
import { addHarvest } from "./actions";

interface BatchOption {
  id: number;
  lot_code: string;
  strain: string | null;
}

interface AddHarvestFormProps {
  batches: BatchOption[];
  /** When invoked from a batch detail page, prefills the batch. */
  defaultBatchId?: number;
}

// Suggest a tidy SKU from the lot + flush, e.g. STG-2605-F1. The operator can
// override; we only auto-fill while they haven't hand-edited the field.
function suggestSku(lot: string | undefined, flush: number): string {
  if (!lot) return "";
  return `${lot}-F${flush || 1}`;
}

export default function AddHarvestForm({ batches, defaultBatchId }: AddHarvestFormProps) {
  const ids = {
    batch: useId(), date: useId(), flush: useId(), sku: useId(),
    fresh: useId(), dry: useId(), grade: useId(),
    labor: useId(), notes: useId(),
  };
  const today = new Date().toISOString().slice(0, 10);

  const byId = new Map(batches.map((b) => [b.id, b]));
  const initialBatch = defaultBatchId ?? batches[0]?.id;
  const [batchId, setBatchId] = useState<number | undefined>(initialBatch);
  const [flush, setFlush] = useState(1);
  const [sku, setSku] = useState<string>(
    suggestSku(initialBatch ? byId.get(initialBatch)?.lot_code : undefined, 1),
  );
  const [skuEdited, setSkuEdited] = useState(false);

  function reSuggest(nextBatch: number | undefined, nextFlush: number) {
    if (skuEdited) return; // don't clobber a hand-entered SKU
    const lot = nextBatch != null ? byId.get(nextBatch)?.lot_code : undefined;
    setSku(suggestSku(lot, nextFlush));
  }

  return (
    <EntityForm action={addHarvest} submitLabel="Log harvest">
      <div>
        <label htmlFor={ids.batch}>Batch</label>
        <select
          id={ids.batch}
          name="batch_id"
          required
          value={batchId != null ? String(batchId) : ""}
          onChange={(e) => {
            const v = e.target.value ? Number(e.target.value) : undefined;
            setBatchId(v);
            reSuggest(v, flush);
          }}
        >
          <option value="" disabled>Pick a batch…</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.lot_code}{b.strain ? ` — ${b.strain}` : ""}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={ids.date}>Harvested on</label>
        <input id={ids.date} name="harvested_on" type="date" required defaultValue={today} />
      </div>
      <div>
        <label htmlFor={ids.flush}>Flush #</label>
        <input
          id={ids.flush}
          name="flush_number"
          type="number"
          min={1}
          value={flush}
          onChange={(e) => {
            const v = Number(e.target.value) || 1;
            setFlush(v);
            reSuggest(batchId, v);
          }}
        />
      </div>
      <div>
        <label htmlFor={ids.sku}>SKU</label>
        <input
          id={ids.sku}
          name="sku"
          type="text"
          placeholder="auto from lot + flush"
          value={sku}
          onChange={(e) => {
            setSku(e.target.value);
            setSkuEdited(true);
          }}
        />
      </div>
      <div>
        <label htmlFor={ids.fresh}>Fresh (g)</label>
        <input id={ids.fresh} name="fresh_g" type="number" min={0} step="0.1" required />
      </div>
      <div>
        <label htmlFor={ids.dry}>Dry (g)</label>
        <input id={ids.dry} name="dry_g" type="number" min={0} step="0.1" defaultValue={0} />
      </div>
      <div>
        <label htmlFor={ids.grade}>Grade</label>
        <select id={ids.grade} name="grade" defaultValue="A">
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
        </select>
      </div>
      <div>
        <label htmlFor={ids.labor}>Labor (min)</label>
        <input id={ids.labor} name="labor_minutes" type="number" min={0} defaultValue={0} />
      </div>
      <div className="full">
        <label htmlFor={ids.notes}>Notes</label>
        <textarea id={ids.notes} name="notes" rows={2} />
      </div>
    </EntityForm>
  );
}
