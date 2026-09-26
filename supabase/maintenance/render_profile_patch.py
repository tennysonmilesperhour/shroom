"""Render the audited live-library patch or its guarded rollback. No DB writes.

Usage: python supabase/maintenance/render_profile_patch.py [apply|restore] > patch.sql
"""
import json
import pathlib
import sys

FIELDS = (
    'experience_summary', 'profile_source', 'spectrum_hue',
    'experience_tags', 'evidence_grade', 'alkaloid_total_pct',
)


def render(direction='apply'):
    if direction not in ('apply', 'restore'):
        raise ValueError('Choose apply or restore')
    root = pathlib.Path(__file__).resolve().parents[2]
    payload = json.loads((root / 'docs/strain-profile-research-2026-09-25.json').read_text())
    for row in payload:
        assert set(row['before']) == set(FIELDS) == set(row['after'])
        if direction == 'restore':
            row['before'], row['after'] = row['after'], row['before']
    encoded = json.dumps(payload, ensure_ascii=False).replace("'", "''")
    # Compare field values for equality, including array order and null vs ''.
    # JSON containment would wrongly consider [] a match for nonempty tags.
    before = "NOT EXISTS (SELECT 1 FROM jsonb_each(p->'before') f WHERE to_jsonb(s)->f.key IS DISTINCT FROM f.value)"
    after = "NOT EXISTS (SELECT 1 FROM jsonb_each(p->'after') f WHERE to_jsonb(s)->f.key IS DISTINCT FROM f.value)"
    return f"""-- {direction}: audited live-library profiles; see docs/strain-profile-research-2026-09-25.md.
-- One atomic statement. Exact identity and field guards; safe to rerun.
DO $profile_update$
DECLARE payload jsonb := '{encoded}'::jsonb;
BEGIN
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(payload) p
    LEFT JOIN public.strains s ON s.id = (p->>'id')::bigint AND s.name = p->>'name'
    WHERE s.id IS NULL OR s.mushroom_type IS DISTINCT FROM 'psychedelic'
      OR NOT (({before}) OR ({after}))
  ) THEN RAISE EXCEPTION 'Profile identity or content changed; review before applying'; END IF;
  UPDATE public.strains s SET
    experience_summary = p->'after'->>'experience_summary',
    profile_source = p->'after'->>'profile_source',
    spectrum_hue = (p->'after'->>'spectrum_hue')::integer,
    experience_tags = ARRAY(SELECT jsonb_array_elements_text(p->'after'->'experience_tags')),
    evidence_grade = p->'after'->>'evidence_grade',
    alkaloid_total_pct = (p->'after'->>'alkaloid_total_pct')::numeric
  FROM jsonb_array_elements(payload) p
  WHERE s.id = (p->>'id')::bigint AND s.name = p->>'name' AND ({before});
END $profile_update$;
"""


if __name__ == '__main__':
    print(render(sys.argv[1] if len(sys.argv) > 1 else 'apply'))
