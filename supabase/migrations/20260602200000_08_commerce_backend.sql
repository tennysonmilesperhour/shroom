-- 08_commerce_backend: Shopify-class commerce backend (+ common addon surfaces).
-- All additive. See supabase/COMMERCE.md for the Shopify/addon parity map.

alter table public.products
  add column slug text not null default '',
  add column description text not null default '',
  add column compare_at_price numeric,
  add column cost numeric,
  add column barcode text not null default '',
  add column weight_grams numeric,
  add column image_url text not null default '',
  add column status text not null default 'active',
  add column track_inventory boolean not null default true,
  add column inventory_quantity numeric not null default 0,
  add column seo_title text not null default '',
  add column seo_description text not null default '';

create table public.product_variants (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  title text not null default 'Default', sku text not null default '', barcode text not null default '',
  price numeric not null default 0, compare_at_price numeric, cost numeric, weight_grams numeric,
  option1 text not null default '', option2 text not null default '',
  inventory_quantity numeric not null default 0, position int not null default 1);
create index on public.product_variants (product_id);

create table public.collections (
  id bigint generated always as identity primary key,
  title text not null, slug text not null default '', description text not null default '',
  published boolean not null default true);
create table public.product_collections (
  product_id bigint not null references public.products(id) on delete cascade,
  collection_id bigint not null references public.collections(id) on delete cascade,
  primary key (product_id, collection_id));

create table public.inventory_locations (
  id bigint generated always as identity primary key,
  name text not null, address text not null default '', is_default boolean not null default false);
create table public.inventory_levels (
  id bigint generated always as identity primary key,
  variant_id bigint references public.product_variants(id) on delete cascade,
  location_id bigint references public.inventory_locations(id) on delete cascade,
  available numeric not null default 0, incoming numeric not null default 0,
  unique (variant_id, location_id));

alter table public.orders
  add column email text not null default '', add column currency text not null default 'USD',
  add column subtotal numeric not null default 0, add column discount_total numeric not null default 0,
  add column tax_total numeric not null default 0, add column shipping_total numeric not null default 0,
  add column total_amount numeric not null default 0,
  add column financial_status text not null default 'pending',
  add column fulfillment_status text not null default 'unfulfilled',
  add column discount_code text not null default '', add column shipping_address text not null default '',
  add column source text not null default 'online';

alter table public.order_lines
  add column variant_id bigint references public.product_variants(id),
  add column title text not null default '', add column sku text not null default '',
  add column tax numeric not null default 0, add column discount numeric not null default 0;

create table public.fulfillments (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  status text not null default 'pending', tracking_company text not null default '',
  tracking_number text not null default '', tracking_url text not null default '',
  location_id bigint references public.inventory_locations(id),
  shipped_at timestamptz, delivered_at timestamptz);
create table public.refunds (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  amount numeric not null default 0, reason text not null default '',
  restock boolean not null default true, created_at timestamptz not null default now());
create table public.transactions (
  id bigint generated always as identity primary key,
  order_id bigint references public.orders(id) on delete cascade,
  kind text not null default 'sale', gateway text not null default 'manual',
  amount numeric not null default 0, currency text not null default 'USD',
  status text not null default 'success', processed_at timestamptz not null default now());
create table public.shipping_zones (
  id bigint generated always as identity primary key, name text not null, regions text not null default '');
create table public.shipping_rates (
  id bigint generated always as identity primary key,
  zone_id bigint references public.shipping_zones(id) on delete cascade,
  name text not null, price numeric not null default 0,
  min_weight_grams numeric, max_weight_grams numeric, free_over numeric);
create table public.tax_rates (
  id bigint generated always as identity primary key,
  name text not null, region text not null default '', rate numeric not null default 0);

create table public.discounts (
  id bigint generated always as identity primary key, code text not null unique,
  discount_type text not null default 'percentage', value numeric not null default 0,
  applies_to text not null default 'all', min_subtotal numeric, usage_limit int,
  used_count int not null default 0, starts_at date, ends_at date, active boolean not null default true);
create table public.gift_cards (
  id bigint generated always as identity primary key, code text not null unique,
  initial_balance numeric not null default 0, balance numeric not null default 0,
  currency text not null default 'USD', customer_id bigint references public.customers(id),
  status text not null default 'active', expires_at date);
alter table public.customers
  add column store_credit numeric not null default 0, add column loyalty_points int not null default 0,
  add column accepts_marketing boolean not null default false,
  add column total_spent numeric not null default 0, add column orders_count int not null default 0;

create table public.subscriptions (
  id bigint generated always as identity primary key,
  customer_id bigint references public.customers(id), plan_name text not null,
  interval text not null default 'month', price numeric not null default 0,
  status text not null default 'active', started_on date not null default current_date, next_renewal date);
create table public.subscription_items (
  id bigint generated always as identity primary key,
  subscription_id bigint not null references public.subscriptions(id) on delete cascade,
  product_id bigint references public.products(id), quantity numeric not null default 1);

create table public.purchase_orders (
  id bigint generated always as identity primary key,
  vendor_id bigint references public.vendors(id), status text not null default 'draft',
  reference text not null default '', ordered_at date, expected_at date, received_at date,
  total numeric not null default 0, notes text not null default '');
create table public.purchase_order_items (
  id bigint generated always as identity primary key,
  purchase_order_id bigint not null references public.purchase_orders(id) on delete cascade,
  name text not null, inventory_item_id bigint references public.inventory_items(id),
  quantity numeric not null default 0, received_quantity numeric not null default 0, unit_cost numeric not null default 0);

create table public.product_reviews (
  id bigint generated always as identity primary key,
  product_id bigint references public.products(id) on delete cascade,
  customer_id bigint references public.customers(id), rating int not null default 5,
  title text not null default '', body text not null default '',
  published boolean not null default true, created_at timestamptz not null default now());
create table public.abandoned_carts (
  id bigint generated always as identity primary key, email text not null default '',
  customer_id bigint references public.customers(id), items jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0, recovered boolean not null default false,
  created_at timestamptz not null default now());
create table public.marketing_campaigns (
  id bigint generated always as identity primary key, name text not null,
  channel text not null default 'email', audience text not null default '',
  status text not null default 'draft', sent_at timestamptz, recipients int not null default 0,
  opens int not null default 0, clicks int not null default 0, revenue numeric not null default 0);
create table public.sales_channels (
  id bigint generated always as identity primary key, name text not null,
  kind text not null default 'online', active boolean not null default true);

-- RLS for all new tables (authenticated-only).
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists auth_all on public.%I', t);
    execute format('create policy auth_all on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
