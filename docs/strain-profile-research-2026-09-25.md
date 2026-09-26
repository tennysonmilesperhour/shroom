# Strain profile expansion — 25 September 2026

Reviewed all 42 Magic entries without a color/profile. The proposed patch adds
26 qualitative colors, bringing coverage to 41 of 57 entries. All 57 remain
selectable, including gray entries. Thirteen entries have newly sourced context,
18 have explicitly labeled name-linked context, and 11 have identity/evidence
gap notes. These categories describe the review, not the strength of effects.

The exact before/after values, sources and per-entry status are in
[strain-profile-research-2026-09-25.json](strain-profile-research-2026-09-25.json).
The existing 15 profiles are preserved; their older representative numbers have
not been independently revalidated by this patch.

## Evidence rules

- First-person reports support descriptions of that person's experience only.
  They do not establish characteristic effects at equal dose, potency tiers,
  therapeutic efficacy, onset or duration. New timing fields stay empty.
- Colors are editorial: cyan for the selected social/visual descriptions,
  violet for intense/introspective descriptions. The hue is not a measurement,
  and one report is not proof that a strain consistently has that character.
- Explicit name aliases can share qualitative context, with that relationship
  disclosed. ISO entries do not inherit a parent's assay, ratio or timing.
  Name correspondence does not establish genetic identity.
- Crosses, albino selections and ambiguous labels do not inherit parent profiles.
- Psilocybin-only values stay in attributed text; they are never stored as total
  tryptamine. A detection limit is not a measured zero.

## Chemical references

[Sharchaton et al., Journal of Fungi 2026, Table 1](https://doi.org/10.3390/jof12070486)
reports Jack Frost reference material at 4.95 mg/g total tryptamines. Converting
mg/g to percent divides by 10, giving **0.495%**. The proposed numeric field is
explicitly a published reference value, not this library's stock or a typical
range. No ratio is inferred from the other analytes being below detection.

[Rose City Laboratories, Historical Potency Data, 2024](https://static1.squarespace.com/static/5fb8053ee029577d48c89898/t/6737c2d687690d6a90d8c281/1731707606907/RCL-Historical-Study-BB-Sister-Lab.pdf)
provides **psilocybin-only** summaries for Shakti, Pink Buffalo, Lizard King and
“Mazapatec.” It uses producer-supplied names and removes severe outliers. The
spelling correspondence with Mazatapec is disclosed, not genetically verified.

[Bradshaw et al., 2026](https://doi.org/10.1098/rspb.2025.2270) describes
P. ochraceocentrata. Natalensis remains an identity question for this library;
this patch does not reclassify the stock or borrow a species' chemistry.

## Report sources

- [Gorilla Wizard: Miss Cadabra](https://www.linkedin.com/posts/miss-cadabra-25b254267_its-time-for-another-fruit-review-with-fruits-activity-7112599751941881856-oxiD)
- [Trinity: first-person account](https://www.reddit.com/r/shrooms/comments/pksgy6/subjective_review_trinity/)
- [Ghost: April Pride, episode 65](https://aprilpride.substack.com/p/psilocybe-ghosts-shadow-work-explained)
- [Cambodian: Erowid 79749](https://erowid.org/experiences/exp.php?ID=79749)
- [Pink Buffalo: DoubleBlind interviews and reported anecdotes](https://doubleblindmag.com/thai-pink-buffalo-mushrooms/)
- [True Albino Teacher: Erowid 119030](https://www.erowid.org/experiences/exp.php?ID=119030)
- [Shakti: first-person account](https://www.reddit.com/r/shrooms/comments/1i54opc/)
- [Mexican Dutch King: first-person account](https://www.reddit.com/r/shrooms/comments/hddvc4/)
- [Hillbilly Pumpkin: first-person account](https://www.reddit.com/r/PsilocybinMushrooms/comments/1q2qzpw/)
- [Albino Bluey Vuitton: first-person comments](https://www.reddit.com/r/shegrowsfungigenetics/comments/1rzqt25/)

Preparation, cultivation, dosage recommendations and unsupported scientific
claims within these sources are not adopted.

## Remaining gaps

Reishi and the functional-line composite conflict with their Magic classification.
The eight-name composite is not one strain. White Ape, Natalensis, Magnolia
Teacher, ODPE, Storm Trooper, Albino Texas PE6, Hillbilly x Yeti and Nepal Chitwan
need identity confirmation or better source evidence. Searches found name records
or inconsistent anecdotes for several, but no usable primary chemical profile.
Jack Frost, Mazatapec and Lizard King have chemical context without a verified
experiential color. Their name-linked entries remain gray too.

## Apply and restore

The renderer under `supabase/maintenance/` produces a **one-time patch for the audited live
library**, not a schema migration for new databases. Apply only after release
approval. Each row is guarded by exact ID, name, Magic classification and its
previous six profile fields. Unexpected changes abort the entire statement;
reruns after a successful apply are harmless. Other fields are untouched.

Run `python supabase/maintenance/render_profile_patch.py apply` to generate the
patch, or use `restore` to generate the rollback. The rollback reverses exactly
these fields, including
empty strings versus nulls. It likewise aborts if somebody has changed a profile
since the patch, preventing restoration from overwriting later work. The full
pre-research snapshot is also retained in the task outputs. No records are deleted.

## Verification

`supabase/tests/strain-profile-patch.mjs` runs the generated SQL in a temporary
PGlite PostgreSQL database. Install `@electric-sql/pglite` outside the repository,
then set `PGLITE_MODULE` to that installation's `dist/index.js` when invoking Node.
It verifies atomic application, idempotency, exact restoration, preservation of an
existing profile, and rejection of later source/tag edits. No production writes.

The dense-wheel browser check is `web/scripts/ui-check/wheel.mjs`. Point
`UI_CHECK_BASE` at the local app backed by a mock containing the audited 57 Magic
entries plus proposed profiles; `UI_CHECK_CHROMIUM` selects the local browser.
It checks 390px/1440px, both themes, dragging through the circular seam, second-tap
selection of a neighbor, cancellation, reset, mouse click, keyboard activation,
and profile rendering with missing potency or ratio. The regular UI harness also
covers magnification and profiles without potency using its standard fixture.
