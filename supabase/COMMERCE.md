# Commerce backend — Shopify (+ addons) parity

The `quantumblue` database includes a full storefront/operations backend modeled
on Shopify plus the common app-store addons a serious store would install.
Surfaced in the app under **Commerce** (and **Business**).

## Parity map

| Shopify / addon | Schema | Notes |
|---|---|---|
| Products | `products` (+ slug, cost, compare-at, barcode, weight, SEO, status, image, inventory) | |
| Variants & options | `product_variants` | price/cost/barcode/weight/options per variant |
| Collections | `collections`, `product_collections` | smart/manual grouping |
| Multi-location inventory | `inventory_locations`, `inventory_levels` | available + incoming per location |
| Orders | `orders` (+ subtotal, tax, shipping, discount, totals, financial & fulfillment status, source) | |
| Line items | `order_lines` (+ variant, sku, title, tax, discount) | |
| Fulfillment & tracking | `fulfillments` | carrier, tracking #, shipped/delivered |
| Refunds / returns | `refunds` | amount, reason, restock |
| Payments | `transactions` | gateway (Stripe/manual/cash), sale/refund/auth |
| Shipping | `shipping_zones`, `shipping_rates` | rates by zone/weight, free-over threshold |
| Taxes (Avalara-style) | `tax_rates` | region rate |
| Discounts / promotions | `discounts` | %, fixed, free-shipping, BOGO; limits & windows |
| Gift cards | `gift_cards` | balance tracking |
| Loyalty / store credit | `customers.store_credit`, `loyalty_points` | |
| **Recharge** subscriptions / CSA | `subscriptions`, `subscription_items` | interval, renewal, plan items |
| **Stocky** supplier restock | `purchase_orders`, `purchase_order_items` | vendor POs, expected/received |
| **Judge.me / Yotpo** reviews | `product_reviews` | rating, body, published |
| Abandoned-cart recovery | `abandoned_carts` | items, subtotal, recovered flag |
| **Klaviyo** marketing | `marketing_campaigns` | sends, opens, clicks, attributed revenue |
| Sales channels / POS | `sales_channels`, `orders.source` | online / pos / wholesale / marketplace |
| B2B / wholesale pricing | `price_tiers`, `customers.price_tier`, `products.distributor_price` | tiered pricing |
| Customer CRM & segments | `customers` (+ status, role, region, total_spent, orders_count) | |

## Reporting views
`v_commerce_kpis` (orders / gross sales / AOV / customers), `v_best_sellers`,
`v_customer_ltv`, `v_sales_by_day`. All `security_invoker` so RLS applies.

## Next build-outs (not yet wired in UI)
- Checkout/cart write path + Stripe `transactions` integration (or Supabase Edge
  Function calling Stripe).
- Inventory auto-decrement on fulfillment; PO receive → `inventory_levels` bump.
- Discount/gift-card application at order creation.
- A public storefront (separate Next.js route group) reading the same catalog.
