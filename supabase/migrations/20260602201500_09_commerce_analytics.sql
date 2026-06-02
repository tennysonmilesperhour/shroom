-- 09_commerce_analytics: commerce reporting views + API read grants.
create view public.v_commerce_kpis with (security_invoker = on) as
select count(distinct o.id) as orders,
  coalesce(sum(ol.quantity * ol.unit_price), 0) as gross_sales,
  case when count(distinct o.id) > 0 then round(coalesce(sum(ol.quantity * ol.unit_price), 0) / count(distinct o.id), 2) else 0 end as avg_order_value,
  count(distinct o.customer_id) as customers
from public.orders o left join public.order_lines ol on ol.order_id = o.id
where o.status <> 'cancelled';

create view public.v_best_sellers with (security_invoker = on) as
select p.id as product_id, p.name, coalesce(sum(ol.quantity), 0) as units,
  round(coalesce(sum(ol.quantity * ol.unit_price), 0), 2) as revenue
from public.products p left join public.order_lines ol on ol.product_id = p.id
group by p.id, p.name order by revenue desc;

create view public.v_customer_ltv with (security_invoker = on) as
select c.id, c.name, c.channel, count(distinct o.id) as orders,
  round(coalesce(sum(ol.quantity * ol.unit_price), 0), 2) as lifetime_value
from public.customers c
left join public.orders o on o.customer_id = c.id and o.status <> 'cancelled'
left join public.order_lines ol on ol.order_id = o.id
group by c.id, c.name, c.channel order by lifetime_value desc;

create view public.v_sales_by_day with (security_invoker = on) as
select o.order_date as day, count(distinct o.id) as orders, round(sum(ol.quantity * ol.unit_price), 2) as sales
from public.orders o join public.order_lines ol on ol.order_id = o.id
where o.status <> 'cancelled' group by o.order_date order by o.order_date;

grant select on
  public.v_commerce_kpis, public.v_best_sellers, public.v_customer_ltv, public.v_sales_by_day,
  public.v_dry_ratio, public.v_yield_by_strain, public.v_environment_status,
  public.v_circular_economy, public.v_inventory_valuation, public.v_strain_scoreboard
to anon, authenticated;
