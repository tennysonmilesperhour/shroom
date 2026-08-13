"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveBatchRoom, undoBatchChange } from "@/app/(app)/batches/workflow-actions";
import { queueOfflineMutation } from "@/lib/offline-queue";
import { useToast } from "@/components/ToastProvider";

export default function BatchRoomControl({
  batchId,
  currentRoomId,
  rooms,
}: {
  batchId: number;
  currentRoomId: number | null;
  rooms: { id: number; name: string }[];
}) {
  const [value, setValue] = useState(currentRoomId == null ? "" : String(currentRoomId));
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { push } = useToast();

  function change(nextValue: string) {
    const before = value;
    const roomId = nextValue === "" ? null : Number(nextValue);
    setValue(nextValue);
    if (!navigator.onLine) {
      try {
        queueOfflineMutation({ type: "batch_room", batchId, roomId });
        push({ title: "Room change queued", body: "It will sync when connection returns.", tone: "spore" });
      } catch {
        setValue(before);
        push({ title: "Couldn’t queue room change", body: "Offline browser storage is unavailable.", tone: "ember" });
      }
      return;
    }
    startTransition(async () => {
      try {
        const result = await moveBatchRoom(batchId, roomId);
        if (!result.ok) {
          setValue(before);
          push({ title: "Couldn’t change room", body: result.message, tone: "ember" });
          return;
        }
        push({
          title: result.message ?? "Room changed",
          tone: "moss",
          duration: result.undoId ? 10_000 : undefined,
          actionLabel: result.undoId ? "Undo" : undefined,
          onAction: result.undoId
            ? async () => {
                const undo = await undoBatchChange(result.undoId!);
                push({ title: undo.ok ? "Room change undone" : "Couldn’t undo", body: undo.message, tone: undo.ok ? "moss" : "ember" });
                if (undo.ok) setValue(before);
                router.refresh();
              }
            : undefined,
        });
        router.refresh();
      } catch {
        try {
          queueOfflineMutation({ type: "batch_room", batchId, roomId });
          push({ title: "Connection lost · room change queued", tone: "spore" });
        } catch {
          setValue(before);
          push({ title: "Couldn’t save room change", body: "The connection and offline storage are unavailable.", tone: "ember" });
        }
      }
    });
  }

  return (
    <select className="batch-room-control" aria-label="Move batch to room" value={value} disabled={pending} onChange={(event) => change(event.target.value)}>
      <option value="">Unassigned</option>
      {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
    </select>
  );
}
