"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STAGE_LABEL, STAGE_ORDER } from "@/lib/stages";
import { moveBatchStage } from "@/app/(app)/batches/actions";
import { undoBatchChange } from "@/app/(app)/batches/workflow-actions";
import { queueOfflineMutation } from "@/lib/offline-queue";
import { useToast } from "@/components/ToastProvider";

export default function BatchStageControl({ batchId, currentStage }: { batchId: number; currentStage: string }) {
  const [selected, setSelected] = useState(currentStage);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { push } = useToast();

  function choose(stage: string) {
    if (stage === selected || pending) return;
    const before = selected;
    setSelected(stage);
    if (!navigator.onLine) {
      try {
        queueOfflineMutation({ type: "batch_stage", batchId, stage });
        push({ title: `Queued move to ${STAGE_LABEL[stage as keyof typeof STAGE_LABEL]}`, body: "It will sync when connection returns.", tone: "spore" });
      } catch {
        setSelected(before);
        push({ title: "Couldn’t queue stage change", body: "Offline browser storage is unavailable.", tone: "ember" });
      }
      return;
    }
    startTransition(async () => {
      try {
        const result = await moveBatchStage(batchId, stage);
        if (!result.ok) {
          setSelected(before);
          push({ title: "Couldn’t change stage", body: result.message, tone: "ember" });
          return;
        }
        push({
          title: result.message ?? "Stage updated",
          tone: "moss",
          duration: 10_000,
          actionLabel: result.undoId ? "Undo" : undefined,
          onAction: result.undoId
            ? async () => {
                const undo = await undoBatchChange(result.undoId!);
                push({ title: undo.ok ? "Change undone" : "Couldn’t undo", body: undo.message, tone: undo.ok ? "moss" : "ember" });
                if (undo.ok) setSelected(before);
                router.refresh();
              }
            : undefined,
        });
        router.refresh();
      } catch {
        try {
          queueOfflineMutation({ type: "batch_stage", batchId, stage });
          push({ title: "Connection lost · update queued", tone: "spore" });
        } catch {
          setSelected(before);
          push({ title: "Couldn’t save stage change", body: "The connection and offline storage are unavailable.", tone: "ember" });
        }
      }
    });
  }

  return (
    <div className="stage-tap-control" aria-label="Move batch to stage">
      {STAGE_ORDER.map((stage) => (
        <button
          type="button"
          key={stage}
          className={selected === stage ? "active" : ""}
          aria-pressed={selected === stage}
          disabled={pending}
          onClick={() => choose(stage)}
        >
          {STAGE_LABEL[stage]}
        </button>
      ))}
    </div>
  );
}
