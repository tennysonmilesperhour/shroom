export const BATCH_MEDIA_BUCKET = "batch-media";
export const MAX_BATCH_IMAGE_BYTES = 6 * 1024 * 1024;
export const BATCH_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const MEDIA_CATEGORIES = [
  "overview",
  "top",
  "side",
  "underside",
  "colonization",
  "pinning",
  "fruiting_body",
  "contamination",
  "harvest",
  "label",
] as const;

export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

export const MEDIA_CATEGORY_LABEL: Record<MediaCategory, string> = {
  overview: "Overview",
  top: "Top",
  side: "Side",
  underside: "Underside",
  colonization: "Colonization",
  pinning: "Pinning",
  fruiting_body: "Fruiting body",
  contamination: "Contamination",
  harvest: "Harvest",
  label: "Label",
};
