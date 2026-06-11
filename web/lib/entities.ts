// Central registry of editable entities. This is the single source of truth
// that powers the generic edit form (EditPanel) and the generic update/delete
// server actions (lib/crud). Adding a row here makes a table fully
// view/edit/delete-able from any list it appears in.
//
// Foreign-key fields (fk: true) render as <select>; the actual option list is
// supplied at render time by the page (which already loads it), keyed by the
// field name via the `options` prop on RowActions/EditPanel.

import type { SyncEntity } from "@/lib/sync";
import { STAGE_ORDER, STAGE_LABEL } from "@/lib/stages";

export type FieldType =
  | "text"
  | "number"
  | "date"
  | "textarea"
  | "checkbox"
  | "select";

export interface Option {
  value: string;
  label: string;
}

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  /** Foreign-key select: value coerced to a number (or null when blank). */
  fk?: boolean;
  /** Static options for an enum select. */
  options?: Option[];
  required?: boolean;
  step?: string;
  min?: number;
  placeholder?: string;
  /** Span the full width of the two-column form grid. */
  full?: boolean;
}

export interface EntityDef {
  /** Stable key used by RowActions / crud actions. */
  key: string;
  /** Supabase table name (also the mutation allowlist). */
  table: string;
  /** Singular human label, e.g. "batch". */
  label: string;
  /** Path to revalidate after a write. */
  listPath: string;
  /** When set, writes are mirrored to the sheet-sync queue. */
  sync?: SyncEntity;
  fields: FieldDef[];
}

const opt = (...vals: string[]): Option[] =>
  vals.map((v) => ({ value: v, label: v.replace(/_/g, " ") }));

const STAGE_OPTIONS: Option[] = STAGE_ORDER.map((s) => ({
  value: s,
  label: STAGE_LABEL[s],
}));

export const ENTITIES: Record<string, EntityDef> = {
  batch: {
    key: "batch",
    table: "batches",
    label: "batch",
    listPath: "/batches",
    sync: "batch",
    fields: [
      { name: "lot_code", label: "Lot code", type: "text", required: true },
      { name: "strain_id", label: "Strain", type: "select", fk: true, required: true },
      { name: "room_id", label: "Room", type: "select", fk: true },
      { name: "stage", label: "Stage", type: "select", options: STAGE_OPTIONS },
      {
        name: "container_type",
        label: "Container type",
        type: "select",
        options: opt("tub", "grain_bag", "aio"),
      },
      { name: "container_id", label: "Container ID", type: "text" },
      { name: "block_count", label: "Units", type: "number", min: 0 },
      { name: "substrate_weight_kg", label: "Substrate (kg)", type: "number", min: 0, step: "0.01" },
      { name: "inoculated_on", label: "Inoculated on", type: "date" },
      { name: "rating", label: "Rating (/10)", type: "number", min: 0 },
      { name: "notes", label: "Notes", type: "textarea", full: true },
    ],
  },

  strain: {
    key: "strain",
    table: "strains",
    label: "strain",
    listPath: "/strains",
    sync: "strain",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "species", label: "Species", type: "text" },
      { name: "strain_code", label: "Strain code", type: "text" },
      {
        name: "mushroom_type",
        label: "Type",
        type: "select",
        options: opt("functional", "gourmet", "psychedelic"),
      },
      { name: "vendor", label: "Vendor", type: "text" },
      { name: "genetics", label: "Genetics", type: "text" },
      { name: "potency", label: "Potency", type: "text" },
      { name: "ease_rating", label: "Ease (1-5)", type: "number", min: 1 },
      { name: "typical_be", label: "Typical BE %", type: "number", step: "0.1" },
      { name: "typical_flushes", label: "Typical flushes", type: "number", min: 0 },
      { name: "syringes_on_hand", label: "Syringes on hand", type: "number", min: 0, step: "0.1" },
      { name: "library_status", label: "Library status", type: "text" },
      { name: "grow_again", label: "Grow again", type: "checkbox" },
      { name: "active", label: "Active", type: "checkbox" },
      { name: "notes", label: "Notes", type: "textarea", full: true },
    ],
  },

  harvest: {
    key: "harvest",
    table: "harvests",
    label: "harvest",
    listPath: "/harvests",
    sync: "harvest",
    fields: [
      { name: "batch_id", label: "Batch", type: "select", fk: true, required: true },
      { name: "harvested_on", label: "Harvested on", type: "date", required: true },
      { name: "flush_number", label: "Flush", type: "number", min: 1 },
      { name: "weight_kg", label: "Fresh (kg)", type: "number", min: 0, step: "0.001" },
      { name: "dry_weight_kg", label: "Dry (kg)", type: "number", min: 0, step: "0.001" },
      { name: "grade", label: "Grade", type: "select", options: opt("A", "B", "C") },
      { name: "labor_minutes", label: "Labor (min)", type: "number", min: 0 },
      { name: "notes", label: "Notes", type: "textarea", full: true },
    ],
  },

  task: {
    key: "task",
    table: "tasks",
    label: "task",
    listPath: "/tasks",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", full: true },
      { name: "batch_id", label: "Batch", type: "select", fk: true },
      { name: "room_id", label: "Room", type: "select", fk: true },
      { name: "assigned_to", label: "Assigned to", type: "select", fk: true },
      { name: "due_date", label: "Due date", type: "date" },
      { name: "status", label: "Status", type: "select", options: opt("open", "in_progress", "done", "blocked") },
      { name: "priority", label: "Priority", type: "select", options: opt("low", "med", "high") },
    ],
  },

  customer: {
    key: "customer",
    table: "customers",
    label: "customer",
    listPath: "/customers",
    sync: "customer",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      {
        name: "channel",
        label: "Channel",
        type: "select",
        options: opt("wholesale", "distributor", "csa", "farmers_market", "restaurant", "dtc"),
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: opt("lead", "warm", "active", "not_contacted", "integrated"),
      },
      { name: "contact_email", label: "Email", type: "text" },
      { name: "phone", label: "Phone", type: "text" },
      { name: "role", label: "Role", type: "text" },
      { name: "region", label: "Region", type: "text" },
      { name: "price_tier", label: "Price tier", type: "text" },
      { name: "volume_est", label: "Volume estimate", type: "text" },
      { name: "follow_up_date", label: "Follow-up date", type: "date" },
      { name: "address", label: "Address", type: "text", full: true },
      { name: "notes", label: "Notes", type: "textarea", full: true },
    ],
  },

  order: {
    key: "order",
    table: "orders",
    label: "order",
    listPath: "/orders",
    sync: "order",
    fields: [
      { name: "order_number", label: "Order number", type: "text", required: true },
      { name: "customer_id", label: "Customer", type: "select", fk: true, required: true },
      {
        name: "channel",
        label: "Channel",
        type: "select",
        options: opt("wholesale", "distributor", "csa", "farmers_market", "restaurant", "dtc"),
      },
      { name: "order_date", label: "Order date", type: "date", required: true },
      { name: "fulfillment_date", label: "Fulfillment date", type: "date" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: opt("draft", "confirmed", "fulfilled", "cancelled"),
      },
      { name: "notes", label: "Notes", type: "textarea", full: true },
    ],
  },

  product: {
    key: "product",
    table: "products",
    label: "product",
    listPath: "/catalog",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "sku", label: "SKU", type: "text" },
      { name: "strain_id", label: "Strain", type: "select", fk: true },
      {
        name: "category",
        label: "Category",
        type: "select",
        options: opt("fresh", "dried", "extract", "grow_kit", "merch"),
      },
      { name: "unit", label: "Unit", type: "text" },
      { name: "price", label: "Retail price", type: "number", min: 0, step: "0.01" },
      { name: "distributor_price", label: "Distributor price", type: "number", min: 0, step: "0.01" },
      { name: "status", label: "Status", type: "select", options: opt("active", "draft", "archived") },
      { name: "description", label: "Description", type: "textarea", full: true },
    ],
  },

  vendor: {
    key: "vendor",
    table: "vendors",
    label: "vendor",
    listPath: "/vendors",
    sync: "vendor",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      {
        name: "category",
        label: "Category",
        type: "select",
        options: opt("supplies", "spores", "functional", "sourcing"),
      },
      { name: "products", label: "Products", type: "text" },
      { name: "url", label: "URL", type: "text" },
      { name: "rating", label: "Rating", type: "number", min: 0 },
      { name: "contact_priority", label: "Contact priority", type: "text" },
      { name: "notes", label: "Notes", type: "textarea", full: true },
    ],
  },

  purchase_order: {
    key: "purchase_order",
    table: "purchase_orders",
    label: "purchase order",
    listPath: "/purchase-orders",
    sync: "purchase_order",
    fields: [
      { name: "vendor_id", label: "Vendor", type: "select", fk: true },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: opt("draft", "ordered", "partial", "received", "cancelled"),
      },
      { name: "reference", label: "Reference", type: "text" },
      { name: "ordered_at", label: "Ordered at", type: "date" },
      { name: "expected_at", label: "Expected at", type: "date" },
      { name: "received_at", label: "Received at", type: "date" },
      { name: "total", label: "Total", type: "number", min: 0, step: "0.01" },
      { name: "notes", label: "Notes", type: "textarea", full: true },
    ],
  },

  supply: {
    key: "supply",
    table: "inventory_items",
    label: "supply",
    listPath: "/supplies",
    sync: "supply",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "category", label: "Category", type: "text" },
      { name: "unit", label: "Unit", type: "text" },
      { name: "quantity_on_hand", label: "On hand", type: "number", min: 0, step: "0.01" },
      { name: "reorder_threshold", label: "Reorder at", type: "number", min: 0, step: "0.01" },
      { name: "unit_cost", label: "Unit cost", type: "number", min: 0, step: "0.01" },
      { name: "supplier", label: "Supplier", type: "text" },
      { name: "location", label: "Location", type: "text" },
    ],
  },

  equipment: {
    key: "equipment",
    table: "equipment",
    label: "equipment",
    listPath: "/supplies",
    sync: "equipment",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "status", label: "Status", type: "select", options: opt("active", "ordered", "retired") },
      { name: "room_id", label: "Room", type: "select", fk: true },
      { name: "last_checked", label: "Last checked", type: "text" },
      { name: "spec_notes", label: "Spec notes", type: "textarea", full: true },
    ],
  },

  contamination: {
    key: "contamination",
    table: "contamination_logs",
    label: "sighting",
    listPath: "/contamination",
    sync: "contamination_log",
    fields: [
      { name: "batch_id", label: "Batch", type: "select", fk: true, required: true },
      { name: "observed_on", label: "Observed on", type: "date", required: true },
      { name: "contam_type", label: "Type", type: "text" },
      { name: "severity", label: "Severity", type: "select", options: opt("low", "med", "high") },
      { name: "action_taken", label: "Action taken", type: "text", full: true },
      { name: "reported_by", label: "Reported by", type: "text" },
    ],
  },

  subscription: {
    key: "subscription",
    table: "subscriptions",
    label: "subscription",
    listPath: "/subscriptions",
    fields: [
      { name: "customer_id", label: "Customer", type: "select", fk: true },
      { name: "plan_name", label: "Plan", type: "text", required: true },
      { name: "interval", label: "Interval", type: "select", options: opt("week", "month", "quarter", "year") },
      { name: "price", label: "Price", type: "number", min: 0, step: "0.01" },
      { name: "status", label: "Status", type: "select", options: opt("active", "paused", "cancelled") },
      { name: "started_on", label: "Started on", type: "date" },
      { name: "next_renewal", label: "Next renewal", type: "date" },
    ],
  },

  campaign: {
    key: "campaign",
    table: "marketing_campaigns",
    label: "campaign",
    listPath: "/marketing",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "channel", label: "Channel", type: "select", options: opt("email", "sms", "social", "ads") },
      { name: "audience", label: "Audience", type: "text" },
      { name: "status", label: "Status", type: "select", options: opt("draft", "scheduled", "sent", "archived") },
      { name: "recipients", label: "Recipients", type: "number", min: 0 },
      { name: "opens", label: "Opens", type: "number", min: 0 },
      { name: "clicks", label: "Clicks", type: "number", min: 0 },
      { name: "revenue", label: "Revenue", type: "number", min: 0, step: "0.01" },
    ],
  },

  food_safety: {
    key: "food_safety",
    table: "food_safety_logs",
    label: "log",
    listPath: "/food-safety",
    fields: [
      { name: "log_date", label: "Date", type: "date", required: true },
      {
        name: "category",
        label: "Category",
        type: "select",
        options: opt("sanitation", "temperature", "pest", "water", "training", "recall"),
      },
      { name: "performed_by", label: "Performed by", type: "text" },
      { name: "passed", label: "Passed", type: "checkbox" },
      { name: "description", label: "Description", type: "textarea", full: true },
      { name: "corrective_action", label: "Corrective action", type: "textarea", full: true },
    ],
  },

  jar: {
    key: "jar",
    table: "dry_inventory",
    label: "jar",
    listPath: "/harvests",
    fields: [
      { name: "jar_id", label: "Jar ID", type: "text", required: true },
      { name: "strain_id", label: "Strain", type: "select", fk: true },
      { name: "flush_number", label: "Flush", type: "number", min: 0 },
      { name: "dry_weight_g", label: "Dry (g)", type: "number", min: 0, step: "0.1" },
      { name: "used_g", label: "Used (g)", type: "number", min: 0, step: "0.1" },
      { name: "location", label: "Location", type: "text" },
      { name: "notes", label: "Notes", type: "textarea", full: true },
    ],
  },

  room: {
    key: "room",
    table: "rooms",
    label: "room",
    listPath: "/environment",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      {
        name: "room_type",
        label: "Type",
        type: "select",
        options: opt("incubation", "fruiting", "drying", "lab", "storage"),
      },
      { name: "capacity_blocks", label: "Capacity (blocks)", type: "number", min: 0 },
      { name: "target_temp_c", label: "Target temp °C", type: "number", step: "0.1" },
      { name: "target_humidity", label: "Target humidity %", type: "number", step: "0.1" },
      { name: "target_co2_ppm", label: "Target CO₂ ppm", type: "number" },
      { name: "target_fae_per_hr", label: "Target FAE/hr", type: "number", step: "0.1" },
      { name: "notes", label: "Notes", type: "textarea", full: true },
    ],
  },

  reading: {
    key: "reading",
    table: "environment_readings",
    label: "reading",
    listPath: "/environment",
    fields: [
      { name: "room_id", label: "Room", type: "select", fk: true, required: true },
      { name: "temp_c", label: "Temp °C", type: "number", step: "0.1" },
      { name: "humidity", label: "Humidity %", type: "number", step: "0.1" },
      { name: "co2_ppm", label: "CO₂ ppm", type: "number" },
      { name: "fae_per_hr", label: "FAE/hr", type: "number", step: "0.1" },
      { name: "source", label: "Source", type: "text" },
    ],
  },
};

export type EntityKey = keyof typeof ENTITIES;

export function getEntity(key: string): EntityDef {
  const e = ENTITIES[key];
  if (!e) throw new Error(`Unknown entity "${key}"`);
  return e;
}
