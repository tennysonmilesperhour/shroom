import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Kpi } from "@/components/ui";
import { createServiceClient } from "@/utils/supabase/service";
import { must, maybe } from "@/lib/query";
import { money } from "@/lib/format";
import { channelLabel } from "@/lib/channels";
import RowActions from "@/components/RowActions";
import AddLineForm, { type HarvestOption, type ProductOption } from "./AddLineForm";
import RemoveLineButton from "./RemoveLineButton";

export const dynamic = "force-dynamic";

interface OrderRow {
  id: number;
  order_number: string;
  customer_id: number | null;
  channel: string;
  order_date: string;
  fulfillment_date: string | null;
  status: string | null;
  notes: string | null;
  financial_status: string;
  fulfillment_status: string;
  customers: { id: number; name: string } | null;
}

interface LineRow {
  id: number;
  quantity: number;
  unit_price: number;
  harvest_id: number | null;
  title: string | null;
  products: { id: number; name: string; unit: string | null } | null;
  harvests: {
    id: number;
    harvested_on: string;
    flush_number: number | null;
    sku: string | null;
    batches: { id: number; lot_code: string } | null;
  } | null;
}

interface ProductRow {
  id: number;
  name: string;
  unit: string | null;
  price: number | null;
  distributor_price: number | null;
  status: string | null;
}

interface HarvestRow {
  id: number;
  harvested_on: string;
  flush_number: number | null;
  sku: string | null;
  batches: { id: number; lot_code: string } | null;
}

interface CustomerOpt {
  id: number;
  name: string;
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const supabase = createServiceClient();
  const [order, lines, products, harvests, customerOpts] = await Promise.all([
    maybe<OrderRow>(
      supabase.from("orders").select("*, customers(id,name)").eq("id", id).single(),
      "load order",
    ),
    must<LineRow[]>(
      supabase
        .from("order_lines")
        .select(
          "id,quantity,unit_price,harvest_id,title, products(id,name,unit), harvests(id,harvested_on,flush_number,sku, batches(id,lot_code))",
        )
        .eq("order_id", id)
        .order("id")
        .returns<LineRow[]>(),
      "load order lines",
    ),
    must<ProductRow[]>(
      supabase.from("products").select("id,name,unit,price,distributor_price,status").order("name"),
      "load products",
    ),
    must<HarvestRow[]>(
      supabase
        .from("harvests")
        .select("id,harvested_on,flush_number,sku, batches(id,lot_code)")
        .order("harvested_on", { ascending: false })
        .limit(300)
        .returns<HarvestRow[]>(),
      "load harvests",
    ),
    must<CustomerOpt[]>(supabase.from("customers").select("id,name").order("name"), "load customers"),
  ]);

  if (!order) notFound();

  const subtotal = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price), 0);
  const units = lines.reduce((s, l) => s + Number(l.quantity), 0);
  const traced = lines.filter((l) => l.harvest_id != null).length;
  const untraced = lines.length - traced;

  const productOptions: ProductOption[] = products
    .filter((p) => p.status !== "archived")
    .map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit ?? "unit",
      listPrice:
        order.channel === "distributor" && Number(p.distributor_price) > 0
          ? Number(p.distributor_price)
          : Number(p.price) || 0,
    }));
  const harvestOptions: HarvestOption[] = harvests.map((h) => ({
    id: h.id,
    label: [h.batches?.lot_code ?? "Lot ?", h.harvested_on, h.flush_number ? `F${h.flush_number}` : null, h.sku]
      .filter(Boolean)
      .join(" · "),
  }));

  const cancelled = order.status === "cancelled";

  return (
    <>
      <Link href="/orders" className="back-link">
        &larr; Orders
      </Link>

      <div className="detail-head">
        <div>
          <div className="eyebrow">Commerce · Order</div>
          <h1 className="section">{order.order_number}</h1>
          <div className="hero-meta">
            {order.customers && (
              <Link href={`/customers/${order.customers.id}`} className="badge muted">
                {order.customers.name}
              </Link>
            )}
            <Badge tone="muted">{channelLabel(order.channel)}</Badge>
            <Badge tone={order.financial_status === "paid" ? "green" : "amber"}>{order.financial_status}</Badge>
            <Badge tone={order.fulfillment_status === "fulfilled" ? "green" : "muted"}>
              {order.fulfillment_status}
            </Badge>
            {cancelled && <Badge tone="red">cancelled</Badge>}
          </div>
        </div>
        <RowActions
          entity="order"
          id={order.id}
          label={order.order_number}
          afterDeleteHref="/orders"
          initial={{
            order_number: order.order_number,
            customer_id: order.customer_id,
            channel: order.channel,
            order_date: order.order_date,
            fulfillment_date: order.fulfillment_date,
            financial_status: order.financial_status,
            fulfillment_status: order.fulfillment_status,
            status: order.status,
            notes: order.notes,
          }}
          options={{ customer_id: customerOpts.map((c) => ({ value: String(c.id), label: c.name })) }}
        />
      </div>

      <div className="kpi-row">
        <Kpi label={cancelled ? "Total (cancelled)" : "Order total"} countTo={subtotal} prefix="$" feature />
        <Kpi label="Line items" countTo={lines.length} />
        <Kpi label="Units" countTo={units} />
        <Kpi label="Lot-traced lines" value={lines.length === 0 ? "—" : `${traced} / ${lines.length}`} />
      </div>

      {untraced > 0 && (
        <p className="muted" role="note" style={{ margin: 0 }}>
          <Badge tone="amber">recall gap</Badge>{" "}
          {untraced === 1 ? "1 line isn’t" : `${untraced} lines aren’t`} linked to a harvest, so a recall on
          that lot won’t reach this customer. Remove the line and re-add it with its harvest.
        </p>
      )}

      <Card title="Line items">
        {lines.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No line items yet. Add what was sold below; the order total and every revenue report are
            calculated from these lines.
          </p>
        ) : (
          <table>
            <caption className="sr-only">Line items for order {order.order_number}</caption>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Lot / harvest</th>
                <th scope="col" className="right">Qty</th>
                <th scope="col" className="right">Unit</th>
                <th scope="col" className="right">Total</th>
                <th scope="col" className="actions-col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const name = l.products?.name ?? l.title ?? "Product";
                return (
                  <tr key={l.id}>
                    <td><b>{name}</b></td>
                    <td>
                      {l.harvests?.batches ? (
                        <Link href={`/batches/${l.harvests.batches.id}`} className="row-anchor">
                          {l.harvests.batches.lot_code}
                        </Link>
                      ) : (
                        <Badge tone="amber">not linked</Badge>
                      )}
                      {l.harvests && (
                        <div className="muted" style={{ fontSize: "var(--text-xs)" }}>
                          {l.harvests.harvested_on}
                          {l.harvests.sku ? ` · ${l.harvests.sku}` : ""}{" "}
                          <Link href={`/label/harvest/${l.harvests.id}`} className="row-anchor">label</Link>
                        </div>
                      )}
                    </td>
                    <td className="right">
                      {Number(l.quantity)} {l.products?.unit ?? ""}
                    </td>
                    <td className="right">{money(Number(l.unit_price))}</td>
                    <td className="right">{money(Number(l.quantity) * Number(l.unit_price))}</td>
                    <td className="actions-col">
                      <RemoveLineButton orderId={order.id} lineId={l.id} label={name} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Add a line item">
        {productOptions.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Add a product in the <Link href="/catalog" className="row-anchor">catalog</Link> first.
          </p>
        ) : (
          <AddLineForm orderId={order.id} products={productOptions} harvests={harvestOptions} />
        )}
      </Card>

      <Card title="Details" variant="quiet">
        <dl className="kv">
          <dt>Order date</dt><dd>{order.order_date}</dd>
          <dt>Fulfilled</dt><dd>{order.fulfillment_date ?? "—"}</dd>
          <dt>Status</dt><dd>{order.status ?? "—"}</dd>
          <dt>Notes</dt><dd style={{ whiteSpace: "pre-wrap" }}>{order.notes || "—"}</dd>
        </dl>
      </Card>
    </>
  );
}
