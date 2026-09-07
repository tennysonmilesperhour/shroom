"use server";

import { revalidatePath } from "next/cache";
import type { EntityResult } from "@/components/EntityForm";
import { createServiceClient } from "@/utils/supabase/service";
import {
  BATCH_MEDIA_BUCKET,
  BATCH_IMAGE_MIME_TYPES,
  MAX_BATCH_IMAGE_BYTES,
  MEDIA_CATEGORIES,
} from "@/lib/batch-media";
import { normalizeStage, VALID_STAGES } from "@/lib/stages";

const ACCEPTED_MIME = new Set<string>(BATCH_IMAGE_MIME_TYPES);
const CATEGORY_SET = new Set<string>(MEDIA_CATEGORIES);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function ensureMediaBucket() {
  const supabase = createServiceClient();
  const { data } = await supabase.storage.getBucket(BATCH_MEDIA_BUCKET);
  if (data) return null;
  const { error } = await supabase.storage.createBucket(BATCH_MEDIA_BUCKET, {
    public: false,
    fileSizeLimit: MAX_BATCH_IMAGE_BYTES,
    allowedMimeTypes: [...ACCEPTED_MIME],
  });
  return error && !/already exists|duplicate/i.test(error.message) ? error : null;
}

function extensionFor(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function uploadBatchMedia(formData: FormData): Promise<EntityResult> {
  const batchId = Number(formData.get("batch_id"));
  const file = formData.get("image");
  const stage = normalizeStage(String(formData.get("stage_snapshot") ?? ""));
  const categories = [
    ...new Set(formData.getAll("categories").map(String).filter((value) => CATEGORY_SET.has(value))),
  ].slice(0, 8);
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  const capturedRaw = String(formData.get("captured_at") ?? "").trim();
  const isCover = formData.get("is_cover") === "on";
  const clientMutationId = String(formData.get("client_mutation_id") ?? "").trim() || null;

  if (!Number.isFinite(batchId)) return { ok: false, message: "Invalid batch." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a photo." };
  if (!ACCEPTED_MIME.has(file.type)) return { ok: false, message: "Use a JPEG, PNG, or WebP image." };
  if (file.size > MAX_BATCH_IMAGE_BYTES) return { ok: false, message: "Keep images under 6 MB." };
  if (!VALID_STAGES.has(stage)) return { ok: false, message: "Choose the growth stage shown." };
  if (categories.length === 0) return { ok: false, message: "Choose at least one photo category." };
  if (clientMutationId && !UUID_PATTERN.test(clientMutationId)) {
    return { ok: false, message: "Invalid queued upload." };
  }

  const supabase = createServiceClient();
  if (clientMutationId) {
    const { data: existing, error: existingError } = await supabase
      .from("batch_media")
      .select("id")
      .eq("client_mutation_id", clientMutationId)
      .maybeSingle<{ id: number }>();
    if (existingError) return { ok: false, message: existingError.message };
    if (existing) return { ok: true, message: "Photo already synced" };
  }

  const bucketError = await ensureMediaBucket();
  if (bucketError) return { ok: false, message: bucketError.message };

  const { data: batch, error: batchError } = await supabase
    .from("batches")
    .select("id")
    .eq("id", batchId)
    .single();
  if (batchError || !batch) return { ok: false, message: batchError?.message ?? "Batch not found." };

  const storagePath = `${batchId}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(BATCH_MEDIA_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
  if (uploadError) return { ok: false, message: uploadError.message };

  if (isCover) {
    const { error: unsetError } = await supabase
      .from("batch_media")
      .update({ is_cover: false })
      .eq("batch_id", batchId)
      .eq("is_cover", true);
    if (unsetError) {
      await supabase.storage.from(BATCH_MEDIA_BUCKET).remove([storagePath]);
      return { ok: false, message: unsetError.message };
    }
  }

  const capturedAt = capturedRaw ? new Date(capturedRaw) : new Date();
  const { error: insertError } = await supabase.from("batch_media").insert({
    batch_id: batchId,
    storage_path: storagePath,
    original_filename: file.name.slice(0, 255),
    mime_type: file.type,
    byte_size: file.size,
    stage_snapshot: stage,
    categories,
    captured_at: Number.isFinite(capturedAt.getTime()) ? capturedAt.toISOString() : new Date().toISOString(),
    note,
    is_cover: isCover,
    client_mutation_id: clientMutationId,
  });
  if (insertError) {
    await supabase.storage.from(BATCH_MEDIA_BUCKET).remove([storagePath]);
    return { ok: false, message: insertError.message };
  }

  revalidatePath(`/batches/${batchId}`);
  return { ok: true, message: "Photo added" };
}

export async function deleteBatchMedia(mediaId: number): Promise<EntityResult> {
  if (!Number.isFinite(mediaId)) return { ok: false, message: "Invalid photo." };
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("batch_media")
    .select("batch_id,storage_path")
    .eq("id", mediaId)
    .single<{ batch_id: number; storage_path: string }>();
  if (error || !data) return { ok: false, message: error?.message ?? "Photo not found." };

  const { error: deleteError } = await supabase.from("batch_media").delete().eq("id", mediaId);
  if (deleteError) return { ok: false, message: deleteError.message };
  const { error: storageError } = await supabase.storage
    .from(BATCH_MEDIA_BUCKET)
    .remove([data.storage_path]);
  revalidatePath(`/batches/${data.batch_id}`);
  return {
    ok: true,
    message: storageError && !/not found/i.test(storageError.message)
      ? "Photo removed · storage cleanup will need a retry"
      : "Photo removed",
  };
}

export async function setBatchCover(mediaId: number): Promise<EntityResult> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("batch_media")
    .select("batch_id")
    .eq("id", mediaId)
    .single<{ batch_id: number }>();
  if (error || !data) return { ok: false, message: error?.message ?? "Photo not found." };
  const { error: setError } = await supabase.rpc("set_batch_cover", { p_media_id: mediaId });
  if (setError) return { ok: false, message: setError.message };
  revalidatePath(`/batches/${data.batch_id}`);
  return { ok: true, message: "Cover photo updated" };
}
