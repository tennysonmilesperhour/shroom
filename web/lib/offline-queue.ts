export type OfflineMutation =
  | { type: "batch_stage"; batchId: number; stage: string }
  | { type: "batch_room"; batchId: number; roomId: number | null }
  | {
      type: "batch_observation";
      batchId: number;
      transcript: string;
      tags: string[];
      kind: "note" | "voice" | "room_round" | "exception";
    }
  | { type: "task_complete"; taskId: number };

export interface QueuedMutation {
  id: string;
  createdAt: string;
  payload: OfflineMutation;
}

const KEY = "shroom-offline-mutations:v1";

function writeOfflineQueue(queue: QueuedMutation[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent("shroom-offline-queue"));
    return true;
  } catch {
    return false;
  }
}

export function readOfflineQueue(): QueuedMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function queueOfflineMutation(payload: OfflineMutation): QueuedMutation {
  const item: QueuedMutation = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    payload,
  };
  const queue = [...readOfflineQueue(), item].slice(-500);
  if (!writeOfflineQueue(queue)) throw new Error("Offline storage is unavailable.");
  return item;
}

export function removeOfflineMutation(id: string) {
  writeOfflineQueue(readOfflineQueue().filter((item) => item.id !== id));
}

export interface QueuedMediaMutation {
  id: string;
  createdAt: string;
  batchId: number;
  stage: string;
  categories: string[];
  capturedAt: string;
  note: string;
  isCover: boolean;
  fileName: string;
  mimeType: string;
  blob: Blob;
}

const MEDIA_DB = "shroom-offline-media-v1";
const MEDIA_STORE = "uploads";

function mediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MEDIA_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(MEDIA_STORE)) {
        request.result.createObjectStore(MEDIA_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readOfflineMediaQueue(): Promise<QueuedMediaMutation[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await mediaDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(MEDIA_STORE, "readonly").objectStore(MEDIA_STORE).getAll();
    request.onsuccess = () => resolve((request.result as QueuedMediaMutation[]) ?? []);
    request.onerror = () => reject(request.error);
  });
}

export async function queueOfflineMedia(
  input: Omit<QueuedMediaMutation, "id" | "createdAt">,
): Promise<QueuedMediaMutation> {
  const item: QueuedMediaMutation = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  const db = await mediaDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(MEDIA_STORE, "readwrite").objectStore(MEDIA_STORE).put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  window.dispatchEvent(new CustomEvent("shroom-offline-queue"));
  return item;
}

export async function removeOfflineMedia(id: string): Promise<void> {
  const db = await mediaDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(MEDIA_STORE, "readwrite").objectStore(MEDIA_STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  window.dispatchEvent(new CustomEvent("shroom-offline-queue"));
}
