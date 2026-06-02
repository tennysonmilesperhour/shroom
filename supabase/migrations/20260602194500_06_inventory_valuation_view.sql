-- 06_inventory_valuation_view: live multi-tier valuation of dried finished
-- goods, priced off price_tiers (mirrors the sheet's jar valuation columns).
create view public.v_inventory_valuation with (security_invoker = on) as
select di.jar_id, s.name as strain, di.flush_number, di.remaining_g,
  round(di.remaining_g * (select min_per_gram from public.price_tiers where tier='wholesale'   and product_class='medicinal'), 0) as wholesale_low,
  round(di.remaining_g * (select max_per_gram from public.price_tiers where tier='wholesale'   and product_class='medicinal'), 0) as wholesale_high,
  round(di.remaining_g * (select min_per_gram from public.price_tiers where tier='distributor' and product_class='medicinal'), 0) as distributor_low,
  round(di.remaining_g * (select max_per_gram from public.price_tiers where tier='distributor' and product_class='medicinal'), 0) as distributor_high,
  round(di.remaining_g * (select min_per_gram from public.price_tiers where tier='retail'      and product_class='medicinal'), 0) as retail_low,
  round(di.remaining_g * (select max_per_gram from public.price_tiers where tier='retail'      and product_class='medicinal'), 0) as retail_high
from public.dry_inventory di
left join public.strains s on s.id = di.strain_id;
