import { createServiceClient } from "@/utils/supabase/service";
import type { OfflineMutation, QueuedMutation } from "@/lib/offline-queue";
import { addBatchObservationRecord, setBatchRoom, setBatchStage } from "@/lib/batch-operations";
import { completeTaskRecord } from "@/lib/task-completion";
import { VALID_STAGES } from "@/lib/stages";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OBSERVATION_KINDS = new Set(["note", "voice", "room_round", "exception"]);

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function validPayload(payload: unknown): payload is OfflineMutation {
  if (!payload || typeof payload !== "object" || !("type" in payload)) return false;
  const value = payload as Record<string, unknown>;
  if (value.type === "batch_stage") {
    return Number.isInteger(value.batchId) && typeof value.stage === "string" && VALID_STAGES.has(value.stage);
  }
  if (value.type === "batch_room") {
    return Number.isInteger(value.batchId) && (value.roomId === null || Number.isInteger(value.roomId));
  }
  if (value.type === "batch_observation") {
    return Number.isInteger(value.batchId) &&
      typeof value.transcript === "string" && value.transcript.length <= 4000 &&
      Array.isArray(value.tags) && value.tags.length <= 8 && value.tags.every((tag) => typeof tag === "string") &&
      typeof value.kind === "string" && OBSERVATION_KINDS.has(value.kind);
  }
  return value.type === "task_complete" && Number.isInteger(value.taskId);
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ ok: false, message: "Cross-origin sync is not allowed." }, { status: 403 });
  }
  let queued: QueuedMutation;
  try {
    const candidate = await request.json() as Partial<QueuedMutation>;
    if (typeof candidate.id !== "string" || !UUID_PATTERN.test(candidate.id) || !validPayload(candidate.payload)) {
      throw new Error("Invalid queued operation");
    }
    queued = candidate as QueuedMutation;
  } catch {
    return Response.json({ ok: false, message: "Invalid queued operation." }, { status: 400 });
  }

  const payload = queued.payload;
  const supabase = createServiceClient();
  const result =
    payload.type === "batch_stage"
      ? await setBatchStage(supabase, payload.batchId, payload.stage, { action: "Synced offline stage change", groupId: queued.id })
      : payload.type === "batch_room"
        ? await setBatchRoom(supabase, payload.batchId, payload.roomId, { action: "Synced offline room change", groupId: queued.id })
      : payload.type === "batch_observation"
        ? await addBatchObservationRecord(
            supabase,
            payload.batchId,
            payload.transcript,
            payload.tags,
            payload.kind,
            queued.id,
          )
        : payload.type === "task_complete"
          ? await completeTaskRecord(supabase, payload.taskId)
          : { ok: false, message: "Unsupported queued operation." };

  return Response.json(result, { status: result.ok ? 200 : 422 });
}
