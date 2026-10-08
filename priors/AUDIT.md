# janus/priors — AUDIT & reconciliation (PriorDedupe)

Written 2026-10-08. Ownership: `janus/priors` only. Nothing in khora or janus
code changed; superseded copies are archived (never deleted) and disclosed.

## What was found

Scanned every JSON file in `janus/priors` (2,018 top-level entries before this
run; the sweep had also nested `lang/` and `case-priors/` subdirectories holding
identical copies, and 552 digest-named leftovers + 884 artifact-schema files
that are NOT priors).

The sweep's "one home" rule was followed but the sweep **picked best-by-name**,
so (a) one concept reached the home under several names with different content
or schema, and (b) both a subdirectory copy and a flat copy of the same file came
into the home. A REVEALED prior (names no giver *and* no builder — the Fold's
law, `khora/content-rules.json:159`, `licenseNomos` refuses it) also sat in the
home.

## Decisions

Canonical per conflict = the copy the live consumers read (`loadPriors` /
`grammarFor` / adapters), carrying the named-giver ground, on the richest /
current schema (`POSPrior@1` and friends). The rest moved OUT of the home to
`/Users/mlacy/Documents/3.0/fold-plot-test/priors-superseded/<name>` — archived,
disclosed, never deleted.

## Conflict table

| name | in-home | contenders | who wins | giver | why |
|---|---|---|---|---|---|
| **pos-en / pos-eng** | pos-eng.json | pos-en · pos-eng · pos-prior-en · pos-prior-eng · en-ud-ewt | **pos-eng.json** | Universal Dependencies (UD_English-EWT, raw conllu URL) | **REQUIRED FIX.** `loadPriors` reads `pos-eng.json` (reader-bundle.js:62); `grammarFor` maps `en→eng` and `availableStems` explicitly excludes `pos-en.json` (language-grammar.js:60). pos-eng is the live-read name, POSPrior@1 with a named giver. pos-en (17,967 forms, stale github.com URL), pos-prior-en/pos-prior-eng (retired-tree POSPrior@1, pos-prior-en has NO giver), en-ud-ewt (byte-identical forms to pos-eng but no provenance.giver) are all superseded. |
| **pos-rus / pos-prior-ru** | pos-rus.json | pos-rus · pos-prior-ru | **pos-rus.json** | Universal Dependencies (UD_Russian-GSD, raw URL) | `grammarFor` reads `pos-rus` (STEM rus). pos-prior-ru is a retired-tree copy with the same 24,524 forms but an older github.com giver URL and the stale `-prior-` name. |
| **lang/en.json** | en.json | lang/en.json · en.json | **en.json** | legacy engine `bin/priors/lang/en.json` (AbbreviationPrior@2) | byte-identical duplicate from the sweep; flat copy kept, subdirectory copy archived. |
| **lang/eu.json** | eu.json | lang/eu.json · eu.json | **eu.json** | English Wikipedia Basque grammar (NegationPrior@2) | byte-identical duplicate; flat kept. |
| **lang/pcm.json** | pcm.json | lang/pcm.json · pcm.json | **pcm.json** | APiCS Online (NegationPrior@2) | byte-identical duplicate; flat kept. |
| **lang/en-AAVE.json** | en-AAVE.json | lang/en-AAVE.json · en-AAVE.json | **en-AAVE.json** | English Wikipedia AAVE articles (NegationPrior@2) | byte-identical duplicate; flat kept. |
| **case-priors/case-marking-grc.json** | case-marking-grc.json | case-priors/ · flat | **case-marking-grc.json** | UD_Ancient_Greek-PROIEL | byte-identical duplicate; flat kept (greek-production.mjs reads `PRIORS_DIR/case-marking-grc.json`). |
| **case-priors/case-marking-grc-classical.json** | case-marking-grc-classical.json | case-priors/ · flat | **flat** | UD_Ancient_Greek-Perseus | byte-identical duplicate; flat kept. |
| **case-priors/case-marking-lat.json** | case-marking-lat.json | case-priors/ · flat | **flat** | UD_Latin-Perseus | byte-identical duplicate; flat kept. |
| **case-priors/case-marking-rus.json** | case-marking-rus.json | case-priors/ · flat | **flat** | UD_Russian-GSD | byte-identical duplicate; flat kept. |
| **case-priors/case-marking-san.json** | case-marking-san.json | case-priors/ · flat | **flat** | UD_Sanskrit-Vedic | byte-identical duplicate; flat kept. |
| color-names.json | — (superseded) | color-names.json | — | **REVEALED** (no giver, no builder) | schema ColorNamePrior@1 carries no giver/builder; `licenseNomos` must refuse. Archived. |
| fortune-prior-v1.json | — (superseded) | fortune-prior-v1.json | — | **REVEALED** (no giver, no builder) | FortunePrior@1 with `giver: null`, no builder. Archived. |
| order-conventions.json | — (superseded) | order-conventions.json | — | **REVEALED** (no giver, no builder) | OrderConventionPrior@1 names a method, not a giver/builder. Archived. |
| rosetta-alignment.json | — (superseded) | rosetta-alignment.json | — | **REVEALED** (no giver, no builder) | RosettaAlignment@1, no provenance at all. Archived. |
| mc160.dev.json · noun_concreteness.json | — (superseded) | — | — | — | **NOT priors** — broken JSON (concatenated objects / `NaN` literal). Archived so the home parses clean. |

## REVEALED priors (against the law)

4 — `color-names.json`, `fortune-prior-v1.json`, `order-conventions.json`,
`rosetta-alignment.json`. Each names no giver and no builder; under the Fold's
rule (`content-rules.json:137/148/159`, "no giver, no builder ⇒ REVEALED,
refused by licenseNomos") they may not remain in the home. All archived,
disclosed here and in `manifest.json` (`home: "superseded"`, `note: "REVEALED"`).

## NOT-a-prior files

Flagged (kept in-home where they parse, superseded only where they are broken or
duplicated). The home still holds things that are NOT reading priors but arrived
with the sweep: 552 digest-named leftovers (Wikipedia API dumps, `[0-9a-f]{40}.json`),
570+214 EOTReading/SourceStructure consumption records, manıfest/* reports, and
`package.json` (the `live_priors` package manifest — NOT a prior). They are
disclosed in `manifest.json` with `note`; they are outside the dedup/REVEALED
scope but flagged per the mandate. **Leave them or archive per your call — I
flag, I did not move them.**

## Dedup verdict

**Reconciled 11 conflicts** (pos-en/pos-eng family counted as 1) by naming ONE
canonical copy per conflict and archiving 14 rival copies; **4 REVEALED priors**
removed from the home; 2 broken non-priors archived. The home now holds
**exactly one parseable copy per name the live consumers read**
(`pos-eng.json`, `pos-*.json`, `frame-*.json`, `role-config-*.json`,
`morph-cues-*.json`, `morphology-eng.json`, `case-marking-*.json`, `lang` → flat,
etc.). `manifest.json` (PriorManifest@1) covers every audited file.

## Falsifying controls (pass/fail)

- every prior names its giver or builder now → **pass** (REVEALED removed).
- `loadPriors` resolves `janus/priors` (re-verified, reader-bundle.js:62) and the
  files it reads are present, one copy each → **pass**.
- a prior read from anywhere other than `janus/priors` is drift — names that
  khora's old paths referenced are superseded here, disclosed above → **disclosed**.
- `manifest.json` parses → **pass**. All 2,004 in-home JSON files parse → **pass**.
- no khora / janus code touched → **pass**.