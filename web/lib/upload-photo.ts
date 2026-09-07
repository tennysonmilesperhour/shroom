export class UploadResponseError extends Error {}

async function photoRequest(body: Record<string, unknown>) {
  const response = await fetch("/api/batch-media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (response.status >= 500) throw new TypeError("Photo service is temporarily unavailable.");
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw new UploadResponseError(result?.message || "Could not upload photo. Please try again.");
  return result;
}

/** File bytes go straight to Storage; only metadata crosses Vercel's request limit. */
export async function uploadPhoto(data: FormData, onProgress?: (text: string) => void) {
  const file = data.get("image") as File;
  const id = String(data.get("client_mutation_id") || crypto.randomUUID());
  data.set("client_mutation_id", id);
  onProgress?.("Preparing…");
  const prepared = await photoRequest({ action: "prepare", batchId: Number(data.get("batch_id")), id, size: file.size, mimeType: file.type, fileName: file.name });
  if (prepared.complete) return prepared;
  if (prepared.uploadUrl) {
    onProgress?.("Uploading photo…");
    const response = await fetch(prepared.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    if (!response.ok) {
      if (response.status >= 500) throw new TypeError("Photo storage is temporarily unavailable.");
      // A concurrent retry may already have uploaded the same immutable object.
      if (response.status !== 409) throw new UploadResponseError("Photo storage rejected the file. Try again.");
    }
  }
  onProgress?.("Saving details…");
  return photoRequest({ action: "complete", ticket: prepared.ticket, stage: data.get("stage_snapshot"), categories: data.getAll("categories"), capturedAt: data.get("captured_at"), note: data.get("note"), isCover: data.get("is_cover") === "on" });
}
