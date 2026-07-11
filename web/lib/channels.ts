// The one canonical sales-channel vocabulary, matching the backend reference
// (backend/app/models.py SALES_CHANNELS). Before this existed the Add forms, the
// Edit dialog, and the API each carried a different list, so a channel picked on
// an Add form couldn't be represented in the Edit dialog (and vice versa).
// Every channel <select> — orders + customers, add + edit — reads from here.

export const SALES_CHANNELS = [
  "wholesale",
  "distributor",
  "csa",
  "farmers_market",
  "restaurant",
  "retail",
  "online",
] as const;

export type SalesChannel = (typeof SALES_CHANNELS)[number];

/** Human label for a channel token ("farmers_market" → "farmers market"). */
export const channelLabel = (c: string): string => c.replace(/_/g, " ");

/** Option objects for the entity-registry `select` fields. */
export const channelOptions = SALES_CHANNELS.map((c) => ({
  value: c,
  label: channelLabel(c),
}));
