-- 20_dedup_strains: one-time cleanup of the duplicate strains the pre-fix
-- importer created. Before the parser learned to strip leading list decoration,
-- a bulleted sheet row ("• PE6") upserted as a *new* strain instead of matching
-- the canonical "PE6" (the unique key is `name`, and "• PE6" ≠ "PE6"). The
-- result: plain + "•" pairs, triple/quadruple variants, and a few order-note
-- rows ("NEW SPORES — order #6849…") masquerading as cultures.
--
-- This migration collapses each duplicate group onto one survivor and repoints
-- every foreign key that references strains(id) — discovered from the catalog,
-- so no referencing table can be missed as the schema grows. It is idempotent:
-- once names are canonical there are no groups left to merge, so re-running is a
-- no-op.
--
-- Canonical key = the strain name with leading bullet/list decoration stripped,
-- internal whitespace collapsed, lowercased — matching backend/app/sheet/parse
-- (_strip_name). Survivor per group = the row that already has a clean
-- (undecorated) name, tie-broken by lowest id (the original/seeded row).

do $$
declare
  fk record;
  decor  constant text := '^[[:space:]•▪◦‣·♦●○*–—-]+';   -- leading decoration
  spaces constant text := '[[:space:]]{2,}';               -- runs of whitespace
begin
  -- dup_id -> surviving canonical_id, for every strain that is a duplicate.
  create temporary table _strain_map on commit drop as
  with norm as (
    select
      id,
      lower(trim(regexp_replace(regexp_replace(name, decor, ''), spaces, ' ', 'g'))) as key,
      (name ~ decor) as decorated
    from public.strains
  ),
  ranked as (
    select
      id,
      first_value(id) over (partition by key order by decorated asc, id asc) as canonical_id
    from norm
  )
  select id as dup_id, canonical_id
  from ranked
  where id <> canonical_id;

  -- Repoint every FK column that references strains(id) (all are single-column).
  -- Includes batches.strain_id, products.strain_id, dry_inventory.strain_id,
  -- batch_presets.strain_id, culture_inventory.strain_id, spore_sources.strain_id,
  -- and strains.lineage_parent_id — whatever the catalog reports today.
  for fk in
    select con.conrelid::regclass::text as tbl, att.attname as col
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    where con.contype = 'f'
      and con.confrelid = 'public.strains'::regclass
      and array_length(con.conkey, 1) = 1
  loop
    execute format(
      'update %s t set %I = m.canonical_id from _strain_map m where t.%I = m.dup_id',
      fk.tbl, fk.col, fk.col
    );
  end loop;

  -- A strain can't be its own lineage parent after a self-merge.
  update public.strains set lineage_parent_id = null where lineage_parent_id = id;

  -- Drop the now-orphaned duplicate rows.
  delete from public.strains s using _strain_map m where s.id = m.dup_id;

  -- Canonicalize the surviving names (strip decoration, collapse whitespace).
  update public.strains
  set name = trim(regexp_replace(regexp_replace(name, decor, ''), spaces, ' ', 'g'))
  where name is distinct from
        trim(regexp_replace(regexp_replace(name, decor, ''), spaces, ' ', 'g'));

  -- Remove order/shipment notes that leaked into the library — but only when
  -- nothing references them, so a real strain that happens to match is spared.
  delete from public.strains s
  where s.name ~* 'order[[:space:]]*#|#[0-9]{3,}|\mtracking\M|\mshipped\M|\mshipment\M|new[[:space:]]+spores'
    and not exists (select 1 from public.batches         b  where b.strain_id  = s.id)
    and not exists (select 1 from public.dry_inventory   d  where d.strain_id  = s.id)
    and not exists (select 1 from public.products        p  where p.strain_id  = s.id)
    and not exists (select 1 from public.batch_presets   bp where bp.strain_id = s.id)
    and not exists (select 1 from public.culture_inventory c where c.strain_id = s.id);
end $$;
