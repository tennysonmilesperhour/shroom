"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import {
  BATCH_IMAGE_MIME_TYPES,
  MAX_BATCH_IMAGE_BYTES,
  MEDIA_CATEGORIES,
  MEDIA_CATEGORY_LABEL,
} from "@/lib/batch-media";
import { STAGE_LABEL, STAGE_ORDER } from "@/lib/stages";
import Image from "next/image";
import { uploadPhoto, UploadResponseError } from "@/lib/upload-photo";
import { queueOfflineMedia } from "@/lib/offline-queue";

export default function BatchMediaUpload({ batchId, currentStage }: { batchId: number; currentStage: string }) {
  const imageId = useId();
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [progress, setProgress] = useState("Uploading…");
  useEffect(() => {
    if (!photo) { setPreview(""); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const [categories, setCategories] = useState<string[]>(["overview"]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { push } = useToast();

  function toggle(value: string) {
    setCategories((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("image");
    if (!(file instanceof File) || file.size === 0) {
      push({ title: "Choose a photo", tone: "ember" });
      return;
    }
    if (!BATCH_IMAGE_MIME_TYPES.includes(file.type as (typeof BATCH_IMAGE_MIME_TYPES)[number])) {
      push({ title: "Use a JPEG, PNG, or WebP image", tone: "ember" });
      return;
    }
    if (file.size > MAX_BATCH_IMAGE_BYTES) {
      push({ title: "Photo is too large", body: "Keep images under 6 MB.", tone: "ember" });
      return;
    }
    const selectedFile = file;
    formData.set("client_mutation_id", crypto.randomUUID());
    const capturedRaw = String(formData.get("captured_at") ?? "");
    if (capturedRaw) {
      const capturedAt = new Date(capturedRaw);
      if (Number.isFinite(capturedAt.getTime())) formData.set("captured_at", capturedAt.toISOString());
    }
    formData.delete("categories");
    for (const category of categories) formData.append("categories", category);
    async function queuePhoto() {
      await queueOfflineMedia({
        id: String(formData.get("client_mutation_id")),
        batchId,
        stage: String(formData.get("stage_snapshot") ?? currentStage),
        categories,
        capturedAt: String(formData.get("captured_at") ?? "") || new Date().toISOString(),
        note: String(formData.get("note") ?? ""),
        isCover: formData.get("is_cover") === "on",
        fileName: selectedFile.name,
        mimeType: selectedFile.type,
        blob: selectedFile,
      });
      form.reset();
      setPhoto(null);
      setCategories(["overview"]);
      push({ title: "Photo queued", body: "It will upload when connection returns.", tone: "spore" });
      return true;
    }
    if (!navigator.onLine) {
      startTransition(async () => {
        try {
          await queuePhoto();
        } catch {
          push({ title: "Couldn’t queue photo", body: "Offline browser storage is unavailable.", tone: "ember" });
        }
      });
      return;
    }
    startTransition(async () => {
      let result;
      try {
        result = await uploadPhoto(formData, setProgress);
      } catch (error) {
        if (error instanceof UploadResponseError) {
          push({ title: "Couldn’t add photo", body: error.message, tone: "ember" });
          return;
        }
        try {
          await queuePhoto();
        } catch {
          push({ title: "Couldn’t save photo", body: "The connection and offline storage are unavailable.", tone: "ember" });
        }
        return;
      }
      push({
        title: result.ok ? "Photo added" : "Couldn’t add photo",
        body: result.message,
        tone: result.ok ? "moss" : "ember",
      });
      if (result.ok) {
        form.reset();
        setPhoto(null);
        setCategories(["overview"]);
        router.refresh();
      }
    });
  }

  return (
    <form className="media-upload" onSubmit={submit} aria-busy={pending}>
      <fieldset disabled={pending} className="media-upload-fields">
      <input type="hidden" name="batch_id" value={batchId} />
      <div className="media-capture-field">
        <label htmlFor={imageId}>Photo</label>
        <input
          id={imageId}
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
          disabled={pending}
          required
        />
        <span className="muted">Choose from your library or camera · JPEG, PNG, WebP · up to 6 MB</span>
        {preview && <div className="photo-upload-preview"><Image src={preview} alt="Selected photo preview" width={320} height={220} unoptimized /><span>{photo?.name} · {((photo?.size ?? 0) / 1024 / 1024).toFixed(1)} MB</span></div>}
      </div>
      <div>
        <label>Growth stage shown</label>
        <div className="choice-chips" role="radiogroup" aria-label="Growth stage shown">
          {STAGE_ORDER.map((stage) => (
            <label className="choice-chip" key={stage}>
              <input type="radio" name="stage_snapshot" value={stage} defaultChecked={stage === currentStage} />
              <span>{STAGE_LABEL[stage]}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label>Categories</label>
        <div className="choice-chips" aria-label="Photo categories">
          {MEDIA_CATEGORIES.map((value) => (
            <button
              type="button"
              className={`choice-chip${categories.includes(value) ? " selected" : ""}`}
              aria-pressed={categories.includes(value)}
              key={value}
              onClick={() => toggle(value)}
            >
              {MEDIA_CATEGORY_LABEL[value]}
            </button>
          ))}
        </div>
      </div>
      <div className="media-upload-row">
        <label>
          <span>Captured at</span>
          <input type="datetime-local" name="captured_at" />
        </label>
        <label className="toggle-row">
          <input type="checkbox" name="is_cover" />
          <span>Use as cover</span>
        </label>
      </div>
      <label>
        <span>Optional note</span>
        <textarea name="note" rows={2} placeholder="Surface condition, lighting, concern, or comparison note…" />
      </label>
      </fieldset>
      <button type="submit" className="primary" disabled={pending || categories.length === 0}>
        {pending ? progress : "Add photo"}
      </button>
    </form>
  );
}
