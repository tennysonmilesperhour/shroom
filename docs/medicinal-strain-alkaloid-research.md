# Psilocybe alkaloid profiles & the subjective experience — research brief

Source-of-truth notes behind the **Strain spectrum** feature (the alkaloid color-wheel
on `/strains` and the "Alkaloid profile & reported experience" card on each psychedelic
strain). Data is seeded by migration `…_14_strain_alkaloid_profiles.sql`.

**Evidence grades used throughout:** `Established` = peer-reviewed / replicated ·
`Mixed` = some data, contested or partial · `Anecdotal` = community-reported, not
chemically substantiated.

---

## 1. The alkaloid cast (Established)
Psychoactive *Psilocybe* contain a small family of tryptophan-derived indole alkaloids,
not a single drug:

- **Psilocybin** (4-PO-DMT) — dominant, stable **prodrug**; dephosphorylated in the gut/liver to psilocin.
- **Psilocin** (4-HO-DMT) — the active 5-HT2A agonist. Chemically unstable: oxidizes (the blue bruising) and degrades with heat / light / air.
- **Baeocystin** (4-PO-NMT) — monomethyl analog; anecdotally mildly active (~4 mg self-report = "gentle"), no controlled human data.
- **Norbaeocystin** (4-PO-T) — usually trace; little evidence of independent activity.
- **Aeruginascin** (4-PO-TMT) — quaternary trimethyl compound. Its metabolite 4-HO-TMT binds 5-HT receptors **orders of magnitude weaker** than psilocin (Ki ≈ 120 nM at 5-HT2B vs psilocin's 4.6 nM) and, being charged, likely crosses the blood–brain barrier poorly.

The **"entourage effect"** (minor alkaloids synergistically shaping the trip) is a
**plausible but thinly supported hypothesis (Mixed)** — strongest evidence is a single
mouse study where whole extract beat pure psilocybin at lower dose.

## 2. Potency varies far more by SPECIES than by cubensis strain (Established)
Total psilocybin + psilocin, % dry weight:

| Species | Typical total | Note |
|---|---|---|
| *P. cubensis* | ~0.5–1.5% | the common cultivated species |
| *P. semilanceata* (liberty cap) | ~1–2% | often > cubensis |
| *P. azurescens* | ~1.8% psilocybin avg | the heavyweight (~3–4× cubensis) |
| *P. mexicana / tampanensis* (truffles) | ~0.2–0.7% | lower |

The 42-strain metabolomics study found strains **cluster by species** (validated by ITS
genetics, not morphology), each with a genuinely distinct minor-alkaloid metabolome —
so "magic mushrooms" should not be treated as one uniform thing.

## 3. Within *P. cubensis*, "strain personality" is mostly NOT chemically established (Mixed → Anecdotal)
The crux finding that shapes how the spectrum is framed:

- A clean LC-MS/MS study of 5 cubensis strains found totals tightly bunched —
  **Creeper 1.36, Blue Meanie 1.22, B+ 1.13, Texas Yellow 1.10, Thai 0.88% (w/w)** —
  the "strongest" only ~1.5× the "weakest", with heavy overlap, plus large
  **mushroom-to-mushroom variation within a strain**.
- Oakland Hyphae **Psilocybin Cup** data: samples labeled "Penis Envy" did **not**
  reliably show higher psilocin or a distinct psilocin:psilocybin ratio vs other strains;
  results overlap heavily. Even mushrooms of the same strain in the same tub can vary in
  potency by **up to ~100%** (observed range ~600–24,600 µg/g).
- Consensus: **cultivation, handling, and post-harvest drying/storage dominate potency
  more than the strain label.**

**Real exceptions (Mixed, leaning real):** Penis Envy and its hybrids genuinely cluster
toward the top. **Tidal Wave** (B+ × PE) set the record at **3.82% total tryptamines
(2.26% psilocybin + 1.56% psilocin)**, Oakland Hyphae 2021. So PE-lineage genetics raise
the potency *ceiling*, even if any single sample isn't guaranteed.

**Psilocin:psilocybin ratio** is driven more by **freshness/handling than genetics** —
psilocin is fragile, so fresh / poorly-cured material skews higher psilocin; well-dried
material is psilocybin-dominant (~10:1).

## 4. What this means for "different experiences" (Mixed / Anecdotal — labeled as such)
- The **biggest driver of a different experience is dose** (total tryptamine load); and
  because potency varies wildly sample-to-sample, equal *weights* of two strains can
  differ more by grow than by genetics.
- Reported "personalities" (GT "gentle/teacherly", B+ "balanced", PE "intense/heavy")
  track **largely with potency tier** plus expectancy/set-and-setting. There is **no
  robust chemical evidence** that, at equal psilocin dose, cubensis varieties produce
  categorically different qualia. Presented as folklore, not fact.

## 5. How the spectrum encodes this honestly
- **Radius (center → edge) = measured total tryptamine % dry weight** — lab-grounded.
- **Angle / hue = reported experiential character** — anecdotal. Amber = gentle,
  cyan = bright/balanced, violet = intense (oklch hues, so dots sit on the ring color).
- Each strain carries an **evidence badge** (Established / Some lab support / Anecdotal)
  so folklore is never laundered as pharmacology.

---

## Sources
- Goff et al., *Determination of psilocybin and psilocin content in multiple Psilocybe cubensis strains by LC-MS/MS*, **Anal. Chim. Acta** 1288:342161 (2023). https://doi.org/10.1016/j.aca.2023.342161
- Cohen et al., *Comprehensive analysis of 42 psilocybin-producing fungal strains reveals metabolite diversity and species-specific clusters*, **Sci. Rep.** 15:13822 (2025). https://doi.org/10.1038/s41598-025-97710-z
- Cooper et al., *A Review of Aeruginascin and Potential Entourage Effect in Hallucinogenic Mushrooms*, **Eur. Psychiatry** (2022). https://doi.org/10.1192/j.eurpsy.2022.2297
- Oakland Hyphae — Psilocybin Cup tryptamine potency datasets (record 3.82% total tryptamines, Tidal Wave 2021). https://www.oaklandhyphae510.com/
- Tripsitter, *What Is the Psilocybin Cup?* https://tripsitter.com/psilocybin-cup/
- DoubleBlind, *Mushroom potency can degrade by ~50% in six months.* https://doubleblindmag.com/mushroom-potency/

*Peer-reviewed items retrieved via PubMed; cite the DOIs above when referencing them.*
