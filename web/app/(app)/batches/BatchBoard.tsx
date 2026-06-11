"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { useToast } from "@/components/ToastProvider";
import { moveBatchStage } from "./actions";

// Kanban tub/bag board with drag-and-drop between lifecycle stages.
//
// Native HTML5 DnD (no extra deps). Dropping a chip on a column optimistically
// moves it and persists the new stage via moveBatchStage; on failure we revert
// and toast. Chips remain links to the detail page — dragging and clicking are
// distinct gestures, so navigation still works.

export interface BoardBatch {
  id: number;
  lot_code: string;
  stage: string;
  container_id: string | null;
  contamination_flag: boolean;
  strain: string | null;
}

interface BatchBoardProps {
  batches: BoardBatch[];
  stages: readonly string[];
  stageLabel: Record<string, string>;
}

export default function BatchBoard({ batches, stages, stageLabel }: BatchBoardProps) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [items, setItems] = useState<BoardBatch[]>(batches);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  // Reconcile when the server sends fresh data (e.g. after revalidate or an
  // add). Cheap shallow compare on id+stage avoids clobbering an in-flight drag.
  const signature = batches.map((b) => `${b.id}:${b.stage}`).join("|");
  const [lastSig, setLastSig] = useState(signature);
  if (signature !== lastSig && dragId === null) {
    setItems(batches);
    setLastSig(signature);
  }

  function onDrop(stage: string) {
    const id = dragId;
    setOverStage(null);
    setDragId(null);
    if (id === null) return;

    const moved = items.find((b) => b.id === id);
    if (!moved || moved.stage === stage) return;

    const prevStage = moved.stage;
    // Optimistic move.
    setItems((list) => list.map((b) => (b.id === id ? { ...b, stage } : b)));

    startTransition(async () => {
      const r = await moveBatchStage(id, stage);
      if (r.ok) {
        toast.push({
          title: `${moved.container_id || moved.lot_code} → ${stageLabel[stage] ?? stage}`,
          tone: "moss",
        });
        router.refresh();
      } else {
        // Revert.
        setItems((list) => list.map((b) => (b.id === id ? { ...b, stage: prevStage } : b)));
        toast.push({ title: "Couldn't move tub", body: r.message, tone: "ember" });
      }
    });
  }

  const byStage = (s: string) => items.filter((b) => b.stage === s);

  return (
    <div className="kanban">
      {stages.map((s) => {
        const colItems = byStage(s);
        return (
          <div
            className={`col${overStage === s ? " drop-over" : ""}`}
            key={s}
            onDragOver={(e) => {
              if (dragId !== null) {
                e.preventDefault();
                if (overStage !== s) setOverStage(s);
              }
            }}
            onDragLeave={(e) => {
              // Only clear when leaving the column itself, not a child chip.
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setOverStage((cur) => (cur === s ? null : cur));
              }
            }}
            onDrop={() => onDrop(s)}
          >
            <h4>
              {stageLabel[s] ?? s} <span className="muted">· {colItems.length}</span>
            </h4>
            {colItems.length === 0 ? (
              <p className="muted col-empty" style={{ fontSize: 12, margin: 0 }}>
                {overStage === s ? "Drop here" : "-"}
              </p>
            ) : (
              colItems.map((b) => (
                <div
                  key={b.id}
                  className={`chip chip-drag${dragId === b.id ? " dragging" : ""}`}
                  draggable
                  onDragStart={(e) => {
                    setDragId(b.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(b.id));
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverStage(null);
                  }}
                >
                  <Link href={`/batches/${b.id}`} className="chip-link">
                    <b>{b.container_id || b.lot_code}</b>{" "}
                    {b.contamination_flag && (
                      <Badge tone="red">
                        <span className="sr-only">Contaminated</span>!
                      </Badge>
                    )}
                    <div className="meta">
                      {b.strain ?? "?"} · {b.lot_code}
                    </div>
                  </Link>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
