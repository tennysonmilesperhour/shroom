-- 14_strain_alkaloid_profiles: medicinal alkaloid profiles + reported-experience
-- fields for the psychedelic Psilocybe strains, powering the strain "spectrum"
-- (color-wheel) visualization on the Strains pages.
--
-- Evidence framing (important): per the literature, *total potency* differences
-- between Psilocybe cubensis strains are small and dominated by cultivation /
-- handling (Oakland Hyphae "Psilocybin Cup" data; Goff et al., Anal Chim Acta
-- 2023, doi:10.1016/j.aca.2023.342161). Between-SPECIES differences are real and
-- large, and each strain has a genuinely distinct minor-alkaloid metabolome
-- (Cohen et al., Sci Rep 2025, doi:10.1038/s41598-025-97710-z). But the mapping
-- of cubensis-strain *identity* to a categorically different subjective
-- "experience" at equal dose is largely anecdotal community lore. We therefore
-- store an honest evidence_grade and label the spectrum axes accordingly:
--   radius  = measured total tryptamine % dry weight  (lab-grounded)
--   hue/angle = reported experiential character        (anecdotal)

alter table public.strains
  add column if not exists alkaloid_total_pct       numeric,        -- representative total psilocybin+psilocin, % dry weight
  add column if not exists alkaloid_total_low_pct    numeric,        -- typical low end of observed range
  add column if not exists alkaloid_total_high_pct   numeric,        -- typical high end of observed range
  add column if not exists psilocin_psilocybin_ratio numeric,        -- typical psilocin:psilocybin (handling-dependent)
  add column if not exists potency_tier              text default '',
  add column if not exists spectrum_hue              integer,        -- oklch hue degrees; null = not placed on wheel
  add column if not exists evidence_grade            text default '',-- established | mixed | anecdotal
  add column if not exists experience_summary        text default '',
  add column if not exists experience_tags           text[] not null default '{}',
  add column if not exists onset_min                 integer,
  add column if not exists peak_hr                   numeric,
  add column if not exists duration_hr               numeric,
  add column if not exists profile_source            text default '';

comment on column public.strains.alkaloid_total_pct is
  'Representative total tryptamine (psilocybin + psilocin) as % dry weight. Indicative only — sample-to-sample variance within a strain can reach ~100%.';
comment on column public.strains.spectrum_hue is
  'oklch hue degrees for the strain spectrum wheel. Encodes reported experiential character (anecdotal), not a measured quantity.';
comment on column public.strains.evidence_grade is
  'established = peer-reviewed/replicated; mixed = some lab support (e.g. elevated potency in Psilocybin Cup data); anecdotal = community-reported only.';

-- Seed the psychedelic Psilocybe library. Names are unique in this table.
-- Potency tiers/ranges are grounded in published assays + Psilocybin Cup data;
-- character summaries/tags are community-reported (anecdotal) unless noted.

update public.strains set
  alkaloid_total_pct = 0.95, alkaloid_total_low_pct = 0.70, alkaloid_total_high_pct = 1.30,
  psilocin_psilocybin_ratio = 0.12, potency_tier = 'High', spectrum_hue = 185,
  evidence_grade = 'anecdotal', onset_min = 30, peak_hr = 2.5, duration_hr = 5,
  experience_summary = 'Reported as a bright, visually-forward trip with strong geometric visuals and an energetic, euphoric headspace.',
  experience_tags = '{visual,euphoric,energetic,creative}',
  profile_source = 'Oakland Hyphae Psilocybin Cup + Goff et al. 2023 (potency). Character: community-reported.'
where name = 'Stargazer';

update public.strains set
  alkaloid_total_pct = 1.00, alkaloid_total_low_pct = 0.70, alkaloid_total_high_pct = 1.40,
  psilocin_psilocybin_ratio = 0.13, potency_tier = 'High', spectrum_hue = 270,
  evidence_grade = 'anecdotal', onset_min = 30, peak_hr = 2.5, duration_hr = 5,
  experience_summary = 'Albino x Golden Teacher lineage; users report vivid open- and closed-eye visuals with a dreamy, introspective lean.',
  experience_tags = '{visual,introspective,dreamy}',
  profile_source = 'Oakland Hyphae Psilocybin Cup + Goff et al. 2023 (potency). Character: community-reported.'
where name = 'Illusion Weaver';

update public.strains set
  alkaloid_total_pct = 1.40, alkaloid_total_low_pct = 1.00, alkaloid_total_high_pct = 1.90,
  psilocin_psilocybin_ratio = 0.14, potency_tier = 'Very High', spectrum_hue = 288,
  evidence_grade = 'mixed', onset_min = 25, peak_hr = 3, duration_hr = 5.5,
  experience_summary = 'Community reputation for deep, immersive, sometimes intense journeys with pronounced visuals and emotional depth.',
  experience_tags = '{intense,visual,introspective,emotional}',
  profile_source = 'Oakland Hyphae Psilocybin Cup + Goff et al. 2023 (potency). Character: community-reported.'
where name = 'Jedi Mind Fuck';

update public.strains set
  alkaloid_total_pct = 1.15, alkaloid_total_low_pct = 0.80, alkaloid_total_high_pct = 1.60,
  psilocin_psilocybin_ratio = 0.15, potency_tier = 'High', spectrum_hue = 160,
  evidence_grade = 'anecdotal', onset_min = 25, peak_hr = 2.5, duration_hr = 5,
  experience_summary = 'Fast-onset, bright and giddy; reported as euphoric and giggly with strong visuals for its tier.',
  experience_tags = '{fast-onset,euphoric,giggly,visual}',
  profile_source = 'Oakland Hyphae Psilocybin Cup + Goff et al. 2023 (potency). Character: community-reported.'
where name = 'Blue Meanie';

update public.strains set
  alkaloid_total_pct = 0.70, alkaloid_total_low_pct = 0.50, alkaloid_total_high_pct = 0.95,
  psilocin_psilocybin_ratio = 0.10, potency_tier = 'Moderate-High', spectrum_hue = 78,
  evidence_grade = 'anecdotal', onset_min = 35, peak_hr = 2.5, duration_hr = 5,
  experience_summary = 'The classic "teacher": gentle onset, warm, reflective and introspective — a common first-journey recommendation.',
  experience_tags = '{gentle,introspective,spiritual,balanced}',
  profile_source = 'Oakland Hyphae Psilocybin Cup + Goff et al. 2023 (potency). Character: community-reported.'
where name = 'Golden Teacher';

update public.strains set
  alkaloid_total_pct = 1.10, alkaloid_total_low_pct = 0.80, alkaloid_total_high_pct = 1.50,
  psilocin_psilocybin_ratio = 0.12, potency_tier = 'High', spectrum_hue = 195,
  evidence_grade = 'anecdotal', onset_min = 30, peak_hr = 2.5, duration_hr = 5,
  experience_summary = 'Cultivation-Cup lineage; reported as a balanced, full-spectrum experience with clean visuals and a stable headspace.',
  experience_tags = '{balanced,visual,clean}',
  profile_source = 'Oakland Hyphae Psilocybin Cup + Goff et al. 2023 (potency). Character: community-reported.'
where name = 'BV (Bluey Vuittons)';

update public.strains set
  alkaloid_total_pct = 0.95, alkaloid_total_low_pct = 0.60, alkaloid_total_high_pct = 1.40,
  psilocin_psilocybin_ratio = 0.12, potency_tier = 'High', spectrum_hue = 92,
  evidence_grade = 'anecdotal', onset_min = 30, peak_hr = 2.5, duration_hr = 5,
  experience_summary = 'Limited reports; described as a warm, golden, euphoric headspace. Data is thin and effects are not well characterized.',
  experience_tags = '{euphoric,warm,under-characterized}',
  profile_source = 'Sparse public data. Character: community-reported (anecdotal).'
where name = 'Golden Halo';

update public.strains set
  alkaloid_total_pct = 0.70, alkaloid_total_low_pct = 0.50, alkaloid_total_high_pct = 0.95,
  psilocin_psilocybin_ratio = 0.11, potency_tier = 'Moderate', spectrum_hue = 72,
  evidence_grade = 'anecdotal', onset_min = 30, peak_hr = 2.5, duration_hr = 5,
  experience_summary = 'Reported as smooth and clear-headed with a gentle body feel — often called an easygoing, social strain.',
  experience_tags = '{smooth,clear-headed,social,gentle}',
  profile_source = 'Oakland Hyphae Psilocybin Cup + Goff et al. 2023 (potency). Character: community-reported.'
where name = 'Fiji';

update public.strains set
  alkaloid_total_pct = 1.70, alkaloid_total_low_pct = 1.20, alkaloid_total_high_pct = 2.40,
  psilocin_psilocybin_ratio = 0.15, potency_tier = 'Very High', spectrum_hue = 292,
  evidence_grade = 'mixed', onset_min = 20, peak_hr = 3, duration_hr = 6,
  experience_summary = 'A Penis Envy variant; reported as very potent, deeply visual and introspective with notable body load.',
  experience_tags = '{intense,visual,introspective,body-load}',
  profile_source = 'Oakland Hyphae Psilocybin Cup (PE lineage tops potency). Character: community-reported.'
where name = 'PE6';

update public.strains set
  alkaloid_total_pct = 1.90, alkaloid_total_low_pct = 1.40, alkaloid_total_high_pct = 2.60,
  psilocin_psilocybin_ratio = 0.16, potency_tier = 'Exceptional', spectrum_hue = 300,
  evidence_grade = 'mixed', onset_min = 20, peak_hr = 3, duration_hr = 6,
  experience_summary = 'Blob-mutant tissue clone; reported among the most potent — heavy, immersive and strongly visual. Dose with care.',
  experience_tags = '{exceptional,intense,visual,heavy}',
  profile_source = 'Oakland Hyphae Psilocybin Cup (top-tier potency). Character: community-reported.'
where name = 'Enigma';

update public.strains set
  alkaloid_total_pct = 0.75, alkaloid_total_low_pct = 0.50, alkaloid_total_high_pct = 1.00,
  psilocin_psilocybin_ratio = 0.11, potency_tier = 'Moderate', spectrum_hue = 68,
  evidence_grade = 'anecdotal', onset_min = 30, peak_hr = 2.5, duration_hr = 5,
  experience_summary = 'Tropical lineage reported as warm, giggly and social with a moderate, manageable headspace.',
  experience_tags = '{warm,social,giggly,moderate}',
  profile_source = 'Oakland Hyphae Psilocybin Cup + Goff et al. 2023 (potency). Character: community-reported.'
where name = 'Costa Rican';

update public.strains set
  alkaloid_total_pct = 0.65, alkaloid_total_low_pct = 0.45, alkaloid_total_high_pct = 0.90,
  psilocin_psilocybin_ratio = 0.10, potency_tier = 'Moderate', spectrum_hue = 85,
  evidence_grade = 'anecdotal', onset_min = 30, peak_hr = 2.5, duration_hr = 4.5,
  experience_summary = 'Reported as a light, sociable, functional-leaning experience — clear-headed and easygoing.',
  experience_tags = '{light,social,clear-headed,functional}',
  profile_source = 'Oakland Hyphae Psilocybin Cup + Goff et al. 2023 (potency). Character: community-reported.'
where name = 'Hillbilly';

update public.strains set
  alkaloid_total_pct = 1.80, alkaloid_total_low_pct = 1.30, alkaloid_total_high_pct = 2.50,
  psilocin_psilocybin_ratio = 0.16, potency_tier = 'Very High', spectrum_hue = 298,
  evidence_grade = 'mixed', onset_min = 20, peak_hr = 3, duration_hr = 6,
  experience_summary = 'Famous for intensity: reported as fast, deep and highly visual with significant body load — markedly stronger per gram.',
  experience_tags = '{intense,visual,deep,body-load}',
  profile_source = 'Oakland Hyphae Psilocybin Cup (PE lineage tops potency). Character: community-reported.'
where name = 'Penis Envy';

update public.strains set
  alkaloid_total_pct = 1.60, alkaloid_total_low_pct = 1.10, alkaloid_total_high_pct = 2.60,
  psilocin_psilocybin_ratio = 0.15, potency_tier = 'Very High', spectrum_hue = 205,
  evidence_grade = 'mixed', onset_min = 20, peak_hr = 3, duration_hr = 6,
  experience_summary = 'B+ x Penis Envy cross and record-potency holder (3.82% total tryptamines, Oakland Hyphae 2021); reported as balanced but powerful, visual and euphoric.',
  experience_tags = '{potent,balanced,visual,euphoric}',
  profile_source = 'Oakland Hyphae Psilocybin Cup 2021 record (3.82% total tryptamines). Character: community-reported.'
where name = 'Tidal Wave';

update public.strains set
  alkaloid_total_pct = 0.80, alkaloid_total_low_pct = 0.60, alkaloid_total_high_pct = 1.10,
  psilocin_psilocybin_ratio = 0.10, potency_tier = 'Moderate', spectrum_hue = 82,
  evidence_grade = 'anecdotal', onset_min = 35, peak_hr = 2.5, duration_hr = 5,
  experience_summary = 'Forgiving all-rounder: reported as warm, gentle and balanced with mild visuals — a popular beginner strain.',
  experience_tags = '{gentle,balanced,warm,beginner}',
  profile_source = 'Goff et al. 2023 measured B+ at ~1.13% total. Character: community-reported.'
where name = 'B+';
