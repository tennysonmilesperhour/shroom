import { NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

// Whitelisted CSV exports. Each dataset is one table plus the embeds that make
// the file readable on its own (names instead of bare foreign-key ids).
interface Dataset {
  table: string;
  select: string;
  order: string;
  ascending?: boolean;
  columns?: string[];
  /** Per-row post-processing, e.g. deriving order totals from line items. */
  map?: (row: Record<string, unknown>) => Record<string, unknown>;
}

type Line = { quantity: number | string | null; unit_price: number | string | null };

const EXPORT_DATASETS: Record<string, Dataset> = {
  batches: {
    table: "batches",
    select: "*, strains(name), rooms(name)",
    order: "id",
    columns: ["id", "lot_code", "strains.name", "stage", "rooms.name", "container_id", "inoculated_on"],
  },
  harvests: {
    table: "harvests",
    select: "*, batches(lot_code, strains(name))",
    order: "harvested_on",
    ascending: false,
    columns: ["id", "harvested_on", "batches.lot_code", "batches.strains.name", "flush_number", "sku", "weight_kg", "dry_weight_kg", "dry_ratio_pct", "grade"],
  },
  orders: {
    table: "orders",
    select: "*, customers(name), order_lines(quantity,unit_price)",
    order: "order_date",
    ascending: false,
    columns: ["id", "order_number", "order_date", "customers.name", "channel", "financial_status", "fulfillment_status", "status", "line_count", "order_total"],
    map: (row) => {
      const lines = (row.order_lines as Line[] | null) ?? [];
      const { order_lines: _lines, ...rest } = row;
      void _lines;
      return {
        ...rest,
        line_count: lines.length,
        order_total: Math.round(lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price), 0) * 100) / 100,
      };
    },
  },
  "order-lines": {
    table: "order_lines",
    select:
      "*, orders(order_number,order_date,channel, customers(name)), products(name,sku,unit), harvests(harvested_on, batches(lot_code))",
    order: "id",
    columns: ["id", "orders.order_number", "orders.order_date", "orders.customers.name", "products.name", "products.sku", "quantity", "unit_price", "line_total", "harvests.batches.lot_code", "harvests.harvested_on"],
    map: (row) => ({ ...row, line_total: Math.round(Number(row.quantity) * Number(row.unit_price) * 100) / 100 }),
  },
  customers: { table: "customers", select: "*", order: "name", columns: ["id", "name", "channel", "status", "contact_email", "phone"] },
  strains: { table: "strains", select: "*", order: "name", columns: ["id", "name"] },
  supplies: { table: "inventory_items", select: "*", order: "name", columns: ["id", "name", "category"] },
  vendors: { table: "vendors", select: "*", order: "name", columns: ["id", "name", "category"] },
  "purchase-orders": { table: "purchase_orders", select: "*, vendors(name)", order: "id", columns: ["id", "vendors.name"] },
  contamination: {
    table: "contamination_logs",
    select: "*, batches(lot_code)",
    order: "observed_on",
    ascending: false,
    columns: ["id", "observed_on", "batches.lot_code", "contam_type"],
  },
  tasks: { table: "tasks", select: "*", order: "id", columns: ["id", "title", "status"] },
};

const PAGE = 1000;
const MAX_ROWS = 50_000;

export async function GET(_req: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params;
  const def = Object.hasOwn(EXPORT_DATASETS, dataset) ? EXPORT_DATASETS[dataset] : undefined;
  if (!def) return NextResponse.json({ error: "Unknown export." }, { status: 404 });

  const supabase = createServiceClient();
  const rows: Record<string, unknown>[] = [];
  // PostgREST caps a response (1000 rows by default), so page through.
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await supabase
      .from(def.table)
      .select(def.select)
      .order(def.order, { ascending: def.ascending ?? true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1)
      .returns<Record<string, unknown>[]>();
    if (error) return NextResponse.json({ error: `Export failed: ${error.message}` }, { status: 500 });
    const page = data ?? [];
    rows.push(...(def.map ? page.map(def.map) : page));
    if (page.length < PAGE) break;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(rows, def.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="shroom-${dataset}-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
