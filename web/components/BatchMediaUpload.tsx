"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import {
  BATCH_IMAGE_MIME_TYPES,
  MAX_BATCH_IMAGE_BYTES,
  MEDIA_CATEGORIES,
  MEDIA_CATEGORY_LABEL,
} from "@/lib/batch-media";
import { STAGE_LABEL, STAGE_ORDER } from "@/lib/stages";
import { uploadBatchMedia } from "@/app/(app)/batches/[id]/media-actions";
import { queueOfflineMedia } from "@/lib/offline-queue";

export default function BatchMediaUpload({ batchId, currentStage }: { batchId: number; currentStage: string }) {
  const imageId = useId();
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
    const capturedRaw = String(formData.get("captured_at") ?? "");
    if (capturedRaw) {
      const capturedAt = new Date(capturedRaw);
      if (Number.isFinite(capturedAt.getTime())) formData.set("captured_at", capturedAt.toISOString());
    }
    formData.delete("categories");
    for (const category of categories) formData.append("categories", category);
    async function queuePhoto() {
      await queueOfflineMedia({
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
        result = await uploadBatchMedia(formData);
      } catch {
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
        setCategories(["overview"]);
        router.refresh();
      }
    });
  }

  return (
    <form className="media-upload" onSubmit={submit}>
      <input type="hidden" name="batch_id" value={batchId} />
      <div className="media-capture-field">
        <label htmlFor={imageId}>Photo</label>
        <input
          id={imageId}
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          required
        />
        <span className="muted">JPEG, PNG, or WebP · up to 6 MB</span>
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
      <button type="submit" className="primary" disabled={pending || categories.length === 0}>
        {pending ? "Uploading…" : "Add photo"}
      </button>
    </form>
  );
}
