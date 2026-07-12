-- 22_merge_dedup_strains: collapse the "• Name" strain duplicates WITHOUT losing
-- data. A live-data review showed the bulleted rows aren't junk — they're the
-- fridge/spore-inventory facet of each strain (syringes on hand, vendor,
-- acquired-on, restock notes) that got split from the active-cultivation row
-- because the leading "• " made "• PE6" ≠ "PE6" under the unique-name key.
--
-- So instead of deleting the duplicate outright, each group's fields are MERGED
-- into one survivor (the undecorated / active row) before the extras are removed:
--   * syringes_on_hand → the larger count (the fridge value; never lose stock)
--   * vendor / acquired_on → filled only where the survivor is blank/null
--   * notes → the duplicate's note appended (keeps the restock/order provenance)
--   * everything else (grow logs, alkaloid profile, status) stays as the survivor's
-- FKs are repointed first (catalog-driven, though in practice the bulleted rows
-- have no dependents). Two genuine order-note banner rows ("NEW SPORES — … order
-- #…"), which carry no data and no references, are removed. Idempotent: once the
-- names are canonical and the banners gone there is nothing left to do.

do $$
declare
  decor  constant text := '^[[:space:]•▪◦‣·♦●○*–—-]+';
  spaces constant text := '[[:space:]]{2,}';
  fk record;
begin
  -- Map every strain to its normalized group key and the group's survivor.
  create temporary table _sm on commit drop as
  with norm as (
    select id, name,
      lower(trim(regexp_replace(regexp_replace(name, decor, ''), spaces, ' ', 'g'))) as key,
      (name ~ decor) as decorated
    from public.strains
  ),
  ranked as (
    select id, key,
      first_value(id) over (partition by key order by decorated asc, id asc) as survivor_id
    from norm
  )
  select id, survivor_id, key from ranked;

  -- Fold each duplicate's inventory fields into its survivor (before deletion).
  with dups as (
    select m.survivor_id,
      max(s.syringes_on_hand)                                            as max_syringes,
      (array_remove(array_agg(nullif(btrim(s.vendor), '') order by s.id), null))[1] as any_vendor,
      min(s.acquired_on)                                                 as first_acquired,
      string_agg(nullif(btrim(s.notes), ''), E'\n— ' order by s.id)      as dup_notes
    from _sm m
    join public.strains s on s.id = m.id
    where m.id <> m.survivor_id
    group by m.survivor_id
  )
  update public.strains sv set
    syringes_on_hand = greatest(coalesce(sv.syringes_on_hand, 0), coalesce(d.max_syringes, 0)),
    vendor = case when btrim(coalesce(sv.vendor, '')) = ''
                  then coalesce(d.any_vendor, sv.vendor) else sv.vendor end,
    acquired_on = coalesce(sv.acquired_on, d.first_acquired),
    notes = case
              when coalesce(d.dup_notes, '') = '' then sv.notes
              when btrim(coalesce(sv.notes, '')) = '' then d.dup_notes
              else sv.notes || E'\n— ' || d.dup_notes
            end
  from dups d
  where sv.id = d.survivor_id;

  -- Repoint any FK that references a duplicate onto the survivor (all single-col).
  for fk in
    select con.conrelid::regclass::text as tbl, att.attname as col
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    where con.contype = 'f' and con.confrelid = 'public.strains'::regclass
      and array_length(con.conkey, 1) = 1
  loop
    execute format(
      'update %s t set %I = m.survivor_id from _sm m where t.%I = m.id and m.id <> m.survivor_id',
      fk.tbl, fk.col, fk.col);
  end loop;
  update public.strains set lineage_parent_id = null where lineage_parent_id = id;

  -- Remove the now-merged duplicate rows.
  delete from public.strains s using _sm m where s.id = m.id and m.id <> m.survivor_id;

  -- Canonicalize surviving names (strip the bullet/decoration).
  update public.strains
  set name = trim(regexp_replace(regexp_replace(name, decor, ''), spaces, ' ', 'g'))
  where name is distinct from
        trim(regexp_replace(regexp_replace(name, decor, ''), spaces, ' ', 'g'));

  -- Remove order-note banner rows that leaked into the library — only when they
  -- carry no dependents (so a real strain that happens to match is never touched).
  delete from public.strains s
  where s.name ~* 'order[[:space:]]*#|#[0-9]{3,}|\mtracking\M|\mshipped\M|\mshipment\M|new[[:space:]]+spores'
    and not exists (select 1 from public.batches         b  where b.strain_id  = s.id)
    and not exists (select 1 from public.dry_inventory   d  where d.strain_id  = s.id)
    and not exists (select 1 from public.products        p  where p.strain_id  = s.id)
    and not exists (select 1 from public.batch_presets   bp where bp.strain_id = s.id)
    and not exists (select 1 from public.culture_inventory c where c.strain_id = s.id);
end $$;
