import sharp from "sharp";
import { createServiceClient } from "@/utils/supabase/service";
import { BATCH_MEDIA_BUCKET, BATCH_IMAGE_MIME_TYPES, MAX_BATCH_IMAGE_BYTES, MEDIA_CATEGORIES } from "@/lib/batch-media";
import { isSameOrigin } from "@/lib/request-origin";
import { readUploadTicket, signUploadTicket } from "@/lib/upload-ticket";
import { STAGE_ORDER } from "@/lib/stages";
import { revalidatePath } from "next/cache";

export const maxDuration = 60;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ ok: false, message: "Cross-origin upload is not allowed." }, { status: 403 });
  try {
    const input = await request.json();
    const db = createServiceClient();
    const bucket = db.storage.from(BATCH_MEDIA_BUCKET);
    if (input.action === "prepare") {
      const { batchId, id, size, mimeType, fileName } = input;
      if (!Number.isSafeInteger(batchId) || batchId <= 0 || typeof id !== "string" || !uuid.test(id)) throw new Error("Invalid photo or batch.");
      if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_BATCH_IMAGE_BYTES) throw new Error("Choose a photo up to 6 MB.");
      if (!BATCH_IMAGE_MIME_TYPES.includes(mimeType)) throw new Error("Use a JPEG, PNG, or WebP image.");
      if (typeof fileName !== "string" || !fileName.trim() || fileName.length > 255) throw new Error("Invalid filename.");
      const { data: batch, error: batchError } = await db.from("batches").select("id").eq("id", batchId).single();
      if (batchError || !batch) throw new Error("Batch not found.");
      const { data: existing, error: existingError } = await db.from("batch_media").select("id,batch_id").eq("client_mutation_id", id).maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        if (existing.batch_id !== batchId) throw new Error("Photo receipt belongs to another batch.");
        return Response.json({ ok: true, complete: true, message: "Photo already saved" });
      }
      const { data: configured, error: bucketError } = await db.storage.getBucket(BATCH_MEDIA_BUCKET);
      if (!configured) {
        const { error } = await db.storage.createBucket(BATCH_MEDIA_BUCKET, { public: false, fileSizeLimit: MAX_BATCH_IMAGE_BYTES, allowedMimeTypes: [...BATCH_IMAGE_MIME_TYPES] });
        if (error && !/already exists|duplicate/i.test(error.message)) throw bucketError || error;
      }
      const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
      const path = `${batchId}/${id}.${extension}`;
      const ticket = signUploadTicket({ batchId, id, path, size, mimeType, fileName });
      // A lost response may leave the object uploaded but not registered. Reuse it.
      const { data: object } = await bucket.info(path);
      if (object) return Response.json({ ok: true, ticket, uploadUrl: null });
      const { data, error } = await bucket.createSignedUploadUrl(path);
      if (error || !data) throw error || new Error("Could not prepare upload.");
      return Response.json({ ok: true, ticket, uploadUrl: data.signedUrl });
    }
    if (input.action !== "complete" || typeof input.ticket !== "string") throw new Error("Invalid upload request.");
    const receipt = readUploadTicket(input.ticket);
    const { batchId, id, path, size, mimeType, fileName } = receipt;
    const categories = Array.isArray(input.categories) ? [...new Set<string>(input.categories)] : [];
    if (!STAGE_ORDER.includes(input.stage) || categories.length < 1 || categories.length > 8 || categories.some((c) => !MEDIA_CATEGORIES.includes(c as typeof MEDIA_CATEGORIES[number]))) throw new Error("Choose a stage and between one and eight categories.");
    const capturedAt = new Date(input.capturedAt || Date.now());
    if (!Number.isFinite(capturedAt.getTime())) throw new Error("Choose a valid capture date.");
    const { data: existing, error: existingError } = await db.from("batch_media").select("id").eq("client_mutation_id", id).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return Response.json({ ok: true, message: "Photo already saved" });
    const { data: file, error: downloadError } = await bucket.download(String(path));
    if (downloadError || !file) throw new Error("Photo upload is incomplete. Try again.");
    if (file.size !== size || file.size > MAX_BATCH_IMAGE_BYTES) throw new Error("Uploaded photo size did not match. Choose the file again.");
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      const metadata = await sharp(buffer, { limitInputPixels: 40_000_000 }).metadata();
      const expected = mimeType === "image/jpeg" ? "jpeg" : mimeType === "image/png" ? "png" : "webp";
      if (metadata.format !== expected) throw new Error("Image format mismatch");
    } catch {
      await bucket.remove([String(path)]);
      throw new Error("This file is not a readable JPEG, PNG, or WebP photo (maximum 40 megapixels).");
    }
    const { error } = await db.rpc("save_batch_media", { p_media: {
      batch_id: batchId, storage_path: path, original_filename: fileName, mime_type: mimeType,
      byte_size: size, stage_snapshot: input.stage, categories, captured_at: capturedAt.toISOString(),
      note: String(input.note || "").trim().slice(0, 1000), is_cover: input.isCover === true, client_mutation_id: id,
    } });
    if (error) throw error;
    revalidatePath(`/batches/${batchId}`);
    return Response.json({ ok: true, message: "Photo added" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save photo. Please try again.";
    return Response.json({ ok: false, message }, { status: 422 });
  }
}
