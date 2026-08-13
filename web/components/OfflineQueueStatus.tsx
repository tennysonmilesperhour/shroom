"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  readOfflineMediaQueue,
  readOfflineQueue,
  removeOfflineMedia,
  removeOfflineMutation,
} from "@/lib/offline-queue";
import { useToast } from "@/components/ToastProvider";
import { useRouter } from "next/navigation";

export default function OfflineQueueStatus() {
  const [count, setCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncInFlight = useRef(false);
  const { push } = useToast();
  const router = useRouter();

  const refresh = useCallback(async () => {
    const media = await readOfflineMediaQueue().catch(() => []);
    setCount(readOfflineQueue().length + media.length);
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine || syncInFlight.current) return;
    const queue = readOfflineQueue();
    const mediaQueue = await readOfflineMediaQueue().catch(() => []);
    if (queue.length === 0 && mediaQueue.length === 0) return void refresh();
    syncInFlight.current = true;
    setSyncing(true);
    let synced = 0;
    for (const item of queue) {
      try {
        const response = await fetch("/api/offline-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
        if (!response.ok) {
          if (response.status >= 500) break;
          continue;
        }
        removeOfflineMutation(item.id);
        synced += 1;
      } catch {
        break;
      }
    }
    for (const item of mediaQueue) {
      try {
        const data = new FormData();
        data.set("batch_id", String(item.batchId));
        data.set("client_mutation_id", item.id);
        data.set("stage_snapshot", item.stage);
        for (const category of item.categories) data.append("categories", category);
        data.set("captured_at", item.capturedAt);
        data.set("note", item.note);
        if (item.isCover) data.set("is_cover", "on");
        data.set("image", new File([item.blob], item.fileName, { type: item.mimeType }));
        const response = await fetch("/api/offline-media", { method: "POST", body: data });
        if (!response.ok) {
          if (response.status >= 500) break;
          continue;
        }
        await removeOfflineMedia(item.id);
        synced += 1;
      } catch {
        break;
      }
    }
    syncInFlight.current = false;
    setSyncing(false);
    void refresh();
    if (synced > 0) {
      push({ title: `Synced ${synced} offline update${synced === 1 ? "" : "s"}`, tone: "moss" });
      router.refresh();
    }
  }, [push, refresh, router]);

  useEffect(() => {
    void refresh();
    const queueChanged = () => void refresh();
    const online = () => void sync();
    window.addEventListener("shroom-offline-queue", queueChanged);
    window.addEventListener("online", online);
    const interval = window.setInterval(() => void sync(), 30_000);
    void sync();
    return () => {
      window.removeEventListener("shroom-offline-queue", queueChanged);
      window.removeEventListener("online", online);
      window.clearInterval(interval);
    };
  }, [refresh, sync]);

  if (count === 0) return null;
  return (
    <button type="button" className="offline-queue-pill" disabled={syncing} onClick={() => void sync()}>
      {syncing ? "Syncing…" : `${count} pending · sync`}
    </button>
  );
}
