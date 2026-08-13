"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeTask } from "@/app/(app)/tasks/actions";
import { undoBatchChange } from "@/app/(app)/batches/workflow-actions";
import { queueOfflineMutation } from "@/lib/offline-queue";
import { useToast } from "@/components/ToastProvider";

export default function CompleteTaskButton({ taskId, title }: { taskId: number; title: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { push } = useToast();

  function run() {
    if (!navigator.onLine) {
      try {
        queueOfflineMutation({ type: "task_complete", taskId });
        push({ title: "Task completion queued", body: title, tone: "spore" });
      } catch {
        push({ title: "Couldn’t queue task", body: "Offline browser storage is unavailable.", tone: "ember" });
      }
      return;
    }
    startTransition(async () => {
      try {
        const result = await completeTask(taskId);
        push({
          title: result.ok ? "Done" : "Couldn’t complete task",
          body: result.message,
          tone: result.ok ? "moss" : "ember",
          duration: result.undoId ? 10_000 : undefined,
          actionLabel: result.undoId ? "Undo batch change" : undefined,
          onAction: result.undoId
            ? async () => {
                const undo = await undoBatchChange(result.undoId!);
                push({ title: undo.ok ? "Batch change undone" : "Couldn’t undo", body: undo.message, tone: undo.ok ? "moss" : "ember" });
                router.refresh();
              }
            : undefined,
        });
        if (result.ok) router.refresh();
      } catch {
        try {
          queueOfflineMutation({ type: "task_complete", taskId });
          push({ title: "Connection lost · completion queued", body: title, tone: "spore" });
        } catch {
          push({ title: "Couldn’t complete task", body: "The connection and offline storage are unavailable.", tone: "ember" });
        }
      }
    });
  }

  return (
    <button type="button" className="task-complete-btn" disabled={pending} onClick={run}>
      {pending ? "…" : "✓"}<span className="sr-only">Complete {title}</span>
    </button>
  );
}
