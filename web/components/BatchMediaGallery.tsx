"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import {
  MEDIA_CATEGORIES,
  MEDIA_CATEGORY_LABEL,
  type MediaCategory,
} from "@/lib/batch-media";
import { STAGE_LABEL, STAGE_ORDER, type Stage } from "@/lib/stages";
import {
  deleteBatchMedia,
  setBatchCover,
} from "@/app/(app)/batches/[id]/media-actions";

export interface BatchMediaItem {
  id: number;
  signedUrl: string;
  originalFilename: string;
  stage: string;
  categories: string[];
  capturedAt: string;
  note: string;
  isCover: boolean;
}

export default function BatchMediaGallery({ items }: { items: BatchMediaItem[] }) {
  const router = useRouter();
  const { push } = useToast();
  const [stage, setStage] = useState("all");
  const [category, setCategory] = useState("all");
  const [pending, startTransition] = useTransition();
  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (stage === "all" || item.stage === stage) &&
          (category === "all" || item.categories.includes(category)),
      ),
    [items, stage, category],
  );

  function mutate(action: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      try {
        const result = await action();
        push({
          title: result.ok ? "Updated" : "Couldn’t update photo",
          body: result.message,
          tone: result.ok ? "moss" : "ember",
        });
        if (result.ok) router.refresh();
      } catch {
        push({ title: "Couldn’t update photo", body: "Check the connection and try again.", tone: "ember" });
      }
    });
  }

  if (items.length === 0) {
    return <p className="muted" style={{ margin: 0 }}>No photos yet. Capture the first growth reference above.</p>;
  }

  return (
    <div>
      <div className="media-filters" aria-label="Filter batch photos">
        <label>
          <span>Stage</span>
          <select value={stage} onChange={(event) => setStage(event.target.value)}>
            <option value="all">All stages</option>
            {STAGE_ORDER.map((value) => (
              <option key={value} value={value}>{STAGE_LABEL[value]}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {MEDIA_CATEGORIES.map((value) => (
              <option key={value} value={value}>{MEDIA_CATEGORY_LABEL[value]}</option>
            ))}
          </select>
        </label>
        <span className="muted">{filtered.length} of {items.length}</span>
      </div>
      <div className="media-grid">
        {filtered.map((item) => (
          <figure key={item.id} className={`media-card${item.isCover ? " cover" : ""}`}>
            <div className="media-image">
              <Image
                src={item.signedUrl}
                alt={item.note || `${item.stage} batch photo`}
                fill
                sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 33vw"
                style={{ objectFit: "cover" }}
              />
              {item.isCover && <span className="media-cover-badge">Cover</span>}
            </div>
            <figcaption>
              <div className="media-meta">
                <b>{STAGE_LABEL[item.stage as Stage] ?? item.stage}</b>
                <span>{new Date(item.capturedAt).toLocaleString()}</span>
              </div>
              <div className="choice-chips compact">
                {item.categories.map((value) => (
                  <span className="choice-chip static" key={value}>
                    {MEDIA_CATEGORY_LABEL[value as MediaCategory] ?? value.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
              {item.note && <p>{item.note}</p>}
              <div className="media-actions">
                {!item.isCover && (
                  <button type="button" className="ghost" disabled={pending} onClick={() => mutate(() => setBatchCover(item.id))}>
                    Make cover
                  </button>
                )}
                <button
                  type="button"
                  className="ghost danger-text"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm("Remove this photo from the batch history?")) {
                      mutate(() => deleteBatchMedia(item.id));
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
