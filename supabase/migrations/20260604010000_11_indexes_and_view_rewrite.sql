-- 11_indexes_and_view_rewrite — performance pass.
--
-- 1) Add missing indexes for the hot-path queries the app actually runs.
-- 2) Rewrite v_inventory_valuation so the six price-tier lookups happen once
--    via a single aggregation, not as six correlated subqueries per row.
-- 3) Add a few data-integrity constraints called out in the audit.

-- ────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ────────────────────────────────────────────────────────────────────────────

-- Kanban + "all batches" list both filter by stage AND order by created_at.
-- The composite supersedes the existing batches(stage) single-column index.
create index if not exists batches_stage_created_at_idx
  on public.batches (stage, created_at desc);

drop index if exists public.batches_stage_idx;

-- harvests/page.tsx and v_dry_ratio both order by harvested_on.
create index if not exists harvests_harvested_on_idx
  on public.harvests (harvested_on desc);

-- orders/page.tsx orders by order_date; status badges are also filter
-- candidates as the table grows.
create index if not exists orders_order_date_idx
  on public.orders (order_date desc);
create index if not exists orders_financial_status_idx
  on public.orders (financial_status);
create index if not exists orders_fulfillment_status_idx
  on public.orders (fulfillment_status);

-- dry_inventory ↔ strains FK index (PostgREST nested select).
create index if not exists dry_inventory_strain_id_idx
  on public.dry_inventory (strain_id);

-- order_lines.product_id is referenced by v_best_sellers + v_customer_ltv.
create index if not exists order_lines_product_id_idx
  on public.order_lines (product_id);

-- subscriptions FK + status filter.
create index if not exists subscriptions_customer_id_idx
  on public.subscriptions (customer_id);
create index if not exists subscriptions_status_idx
  on public.subscriptions (status);

-- purchase_order_items FK (missing entirely).
create index if not exists purchase_order_items_purchase_order_id_idx
  on public.purchase_order_items (purchase_order_id);

-- tasks: both FK columns lacked indexes.
create index if not exists tasks_batch_id_idx
  on public.tasks (batch_id);
create index if not exists tasks_assigned_to_idx
  on public.tasks (assigned_to);

-- customer email uniqueness (skip the empty-string default so existing rows
-- with empty contact_email don't trip the constraint).
create unique index if not exists customers_contact_email_unique
  on public.customers (lower(contact_email))
  where contact_email <> '';

-- ────────────────────────────────────────────────────────────────────────────
-- Data integrity
-- ────────────────────────────────────────────────────────────────────────────

-- Gift card balance can't go negative (audit B-tier: aggregate drift).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gift_cards_balance_nonnegative'
      and conrelid = 'public.gift_cards'::regclass
  ) then
    alter table public.gift_cards
      add constraint gift_cards_balance_nonnegative
      check (balance >= 0);
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- Rewrite v_inventory_valuation
-- ────────────────────────────────────────────────────────────────────────────
--
-- Old version fired 6 correlated subqueries per dry_inventory row. New version
-- pulls all six tier values in a single CTE and CROSS JOINs them. Output shape
-- is identical, so callers in catalog/page.tsx and reports/page.tsx need no
-- changes.

drop view if exists public.v_inventory_valuation;

create view public.v_inventory_valuation with (security_invoker = on) as
with tiers as (
  select
    max(case when tier = 'wholesale'   and product_class = 'medicinal' then min_per_gram end) as ws_lo,
    max(case when tier = 'wholesale'   and product_class = 'medicinal' then max_per_gram end) as ws_hi,
    max(case when tier = 'distributor' and product_class = 'medicinal' then min_per_gram end) as dist_lo,
    max(case when tier = 'distributor' and product_class = 'medicinal' then max_per_gram end) as dist_hi,
    max(case when tier = 'retail'      and product_class = 'medicinal' then min_per_gram end) as ret_lo,
    max(case when tier = 'retail'      and product_class = 'medicinal' then max_per_gram end) as ret_hi
  from public.price_tiers
)
select
  di.jar_id,
  s.name           as strain,
  di.flush_number,
  di.remaining_g,
  round(di.remaining_g * t.ws_lo,   0) as wholesale_low,
  round(di.remaining_g * t.ws_hi,   0) as wholesale_high,
  round(di.remaining_g * t.dist_lo, 0) as distributor_low,
  round(di.remaining_g * t.dist_hi, 0) as distributor_high,
  round(di.remaining_g * t.ret_lo,  0) as retail_low,
  round(di.remaining_g * t.ret_hi,  0) as retail_high
from public.dry_inventory di
left join public.strains s on s.id = di.strain_id
cross join tiers t;

grant select on public.v_inventory_valuation to authenticated;
