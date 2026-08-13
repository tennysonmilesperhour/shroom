"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, stageTone } from "@/components/ui";
import RowActions from "@/components/RowActions";
import { kgToLb } from "@/lib/format";
import { normalizeStage, STAGE_LABEL, STAGE_ORDER } from "@/lib/stages";
import {
  bulkUpdateBatches,
  deleteBatchView,
  saveBatchView,
  undoBatchChange,
} from "@/app/(app)/batches/workflow-actions";
import { useToast } from "@/components/ToastProvider";
import type { Option } from "@/lib/entities";

export interface BatchTableRow {
  id: number;
  lot_code: string;
  stage: string;
  block_count: number;
  substrate_weight_kg: number;
  inoculated_on: string | null;
  room_id: number | null;
  strain_id: number;
  container_id: string | null;
  container_type: string | null;
  tub_size: string | null;
  spawn_type: string | null;
  substrate_type: string | null;
  bag_type: string | null;
  colonized_on: string | null;
  fruiting_on: string | null;
  spent_on: string | null;
  contamination_flag: boolean;
  rating: number | null;
  issues: string | null;
  notes: string | null;
  strain: string | null;
  room: string | null;
}

export interface SavedBatchView {
  id: number;
  name: string;
  filters: { stage?: string; roomId?: number | null; attention?: boolean };
  is_favorite: boolean;
}

interface Filters {
  stage: string;
  roomId: string;
  attention: boolean;
}

const EMPTY_FILTERS: Filters = { stage: "all", roomId: "all", attention: false };

export default function BatchTable({
  batches,
  savedViews,
  strainOptions,
  roomOptions,
}: {
  batches: BatchTableRow[];
  savedViews: SavedBatchView[];
  strainOptions: Option[];
  roomOptions: Option[];
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkKind, setBulkKind] = useState<"stage" | "room">("stage");
  const [bulkValue, setBulkValue] = useState("fruiting");
  const [viewName, setViewName] = useState("");
  const [pending, startTransition] = useTransition();
  const { push } = useToast();
  const router = useRouter();

  const filtered = useMemo(
    () => batches.filter((batch) =>
      (filters.stage === "all" || normalizeStage(batch.stage) === filters.stage) &&
      (filters.roomId === "all" || String(batch.room_id ?? "") === filters.roomId) &&
      (!filters.attention || batch.contamination_flag || Boolean(batch.issues?.trim())),
    ),
    [batches, filters],
  );
  const selectedSet = new Set(selected);
  const allVisibleSelected = filtered.length > 0 && filtered.every((batch) => selectedSet.has(batch.id));

  function applyView(view: SavedBatchView) {
    setFilters({
      stage: view.filters.stage ?? "all",
      roomId: view.filters.roomId == null ? "all" : String(view.filters.roomId),
      attention: Boolean(view.filters.attention),
    });
    setSelected([]);
  }

  function runBulk() {
    startTransition(async () => {
      const result = await bulkUpdateBatches(selected, bulkKind, bulkValue);
      push({
        title: result.ok ? "Batches updated" : "Couldn’t update batches",
        body: result.message,
        tone: result.ok ? "moss" : "ember",
        duration: result.undoId ? 10_000 : undefined,
        actionLabel: result.undoId ? "Undo" : undefined,
        onAction: result.undoId
          ? async () => {
              const undo = await undoBatchChange(result.undoId!);
              push({ title: undo.ok ? "Changes undone" : "Couldn’t undo", body: undo.message, tone: undo.ok ? "moss" : "ember" });
              router.refresh();
            }
          : undefined,
      });
      if (result.ok) {
        setSelected([]);
        router.refresh();
      }
    });
  }

  function saveView() {
    startTransition(async () => {
      const result = await saveBatchView(viewName, {
        stage: filters.stage === "all" ? undefined : filters.stage,
        roomId: filters.roomId === "all" ? undefined : filters.roomId === "" ? null : Number(filters.roomId),
        attention: filters.attention || undefined,
      });
      push({ title: result.ok ? "View saved" : "Couldn’t save view", body: result.message, tone: result.ok ? "moss" : "ember" });
      if (result.ok) {
        setViewName("");
        router.refresh();
      }
    });
  }

  return (
    <div className="batch-table-workspace">
      <div className="saved-view-bar">
        <button type="button" className={filters.stage === "all" && filters.roomId === "all" && !filters.attention ? "active" : ""} onClick={() => setFilters(EMPTY_FILTERS)}>All</button>
        <button type="button" onClick={() => setFilters({ ...EMPTY_FILTERS, attention: true })}>Needs attention</button>
        <button type="button" onClick={() => setFilters({ ...EMPTY_FILTERS, stage: "fruiting" })}>Fruiting</button>
        <button type="button" onClick={() => setFilters({ ...EMPTY_FILTERS, stage: "harvesting" })}>Ready to harvest</button>
        {savedViews.map((view) => (
          <span className="saved-view" key={view.id}>
            <button type="button" onClick={() => applyView(view)}>★ {view.name}</button>
            <button
              type="button"
              aria-label={`Remove saved view ${view.name}`}
              onClick={() => startTransition(async () => {
                const result = await deleteBatchView(view.id);
                if (result.ok) router.refresh();
              })}
            >×</button>
          </span>
        ))}
      </div>

      <div className="batch-filter-builder">
        <label>
          <span>Stage</span>
          <select value={filters.stage} onChange={(event) => setFilters((current) => ({ ...current, stage: event.target.value }))}>
            <option value="all">All stages</option>
            {STAGE_ORDER.map((stage) => <option key={stage} value={stage}>{STAGE_LABEL[stage]}</option>)}
          </select>
        </label>
        <label>
          <span>Room</span>
          <select value={filters.roomId} onChange={(event) => setFilters((current) => ({ ...current, roomId: event.target.value }))}>
            <option value="all">All rooms</option>
            <option value="">Unassigned</option>
            {roomOptions.filter((option) => option.value).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="filter-toggle">
          <input type="checkbox" checked={filters.attention} onChange={(event) => setFilters((current) => ({ ...current, attention: event.target.checked }))} />
          <span>Needs attention</span>
        </label>
        <div className="save-view-field">
          <input value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder="Name this view" />
          <button type="button" className="ghost" disabled={pending || !viewName.trim()} onClick={saveView}>Save view</button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="bulk-toolbar">
          <b>{selected.length} selected</b>
          <div className="segmented-control">
            <button type="button" className={bulkKind === "stage" ? "active" : ""} onClick={() => { setBulkKind("stage"); setBulkValue("fruiting"); }}>Stage</button>
            <button type="button" className={bulkKind === "room" ? "active" : ""} onClick={() => { setBulkKind("room"); setBulkValue(""); }}>Room</button>
          </div>
          <select value={bulkValue} onChange={(event) => setBulkValue(event.target.value)}>
            {bulkKind === "stage" ? STAGE_ORDER.map((stage) => <option key={stage} value={stage}>{STAGE_LABEL[stage]}</option>) : roomOptions.map((option) => <option key={option.value || "none"} value={option.value}>{option.label}</option>)}
          </select>
          <button type="button" className="primary" disabled={pending} onClick={runBulk}>{pending ? "Updating…" : "Apply"}</button>
          <button type="button" className="ghost" onClick={() => window.open(`/label/batches?ids=${selected.join(",")}`, "_blank", "noopener,noreferrer")}>Print QR labels</button>
          <button type="button" className="ghost" onClick={() => setSelected([])}>Clear</button>
        </div>
      )}

      <div className="table-scroll">
        <table>
          <caption className="sr-only">All batches</caption>
          <thead>
            <tr>
              <th scope="col" className="select-col"><input type="checkbox" aria-label="Select all visible batches" checked={allVisibleSelected} onChange={(event) => setSelected(event.target.checked ? [...new Set([...selected, ...filtered.map((batch) => batch.id)])] : selected.filter((id) => !filtered.some((batch) => batch.id === id)))} /></th>
              <th scope="col">Lot</th><th scope="col">Container</th><th scope="col">Strain</th><th scope="col">Stage</th><th scope="col">Room</th><th scope="col" className="right">Units</th><th scope="col" className="right">Substrate</th><th scope="col">Inoculated</th><th scope="col" className="right">Rating</th><th scope="col" className="actions-col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((batch) => (
              <tr key={batch.id} className="row-link">
                <td className="select-col"><input type="checkbox" aria-label={`Select ${batch.lot_code}`} checked={selectedSet.has(batch.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, batch.id] : current.filter((id) => id !== batch.id))} /></td>
                <td><Link href={`/batches/${batch.id}`} className="row-anchor"><b>{batch.lot_code}</b></Link></td>
                <td>{batch.container_id || "-"}<span className="muted"> {batch.container_type}</span></td>
                <td>{batch.strain ?? "?"}</td>
                <td><Badge tone={stageTone(normalizeStage(batch.stage))}>{normalizeStage(batch.stage)}</Badge></td>
                <td>{batch.room ?? "-"}</td>
                <td className="right">{batch.block_count}</td>
                <td className="right">{kgToLb(batch.substrate_weight_kg)} lb</td>
                <td>{batch.inoculated_on ?? "-"}</td>
                <td className="right">{batch.rating ? `${batch.rating}/10` : "-"}</td>
                <td className="actions-col">
                  <RowActions
                    entity="batch" id={batch.id} viewHref={`/batches/${batch.id}`} label={batch.lot_code}
                    options={{ strain_id: strainOptions, room_id: roomOptions }}
                    initial={{
                      lot_code: batch.lot_code, strain_id: batch.strain_id, room_id: batch.room_id,
                      stage: normalizeStage(batch.stage), container_type: batch.container_type,
                      container_id: batch.container_id, tub_size: batch.tub_size, spawn_type: batch.spawn_type,
                      substrate_type: batch.substrate_type, bag_type: batch.bag_type, block_count: batch.block_count,
                      substrate_weight_kg: batch.substrate_weight_kg, inoculated_on: batch.inoculated_on,
                      colonized_on: batch.colonized_on, fruiting_on: batch.fruiting_on, spent_on: batch.spent_on,
                      rating: batch.rating, contamination_flag: batch.contamination_flag, issues: batch.issues, notes: batch.notes,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="muted empty-filter-result">No batches match this view.</p>}
    </div>
  );
}
