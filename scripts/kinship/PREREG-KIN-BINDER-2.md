# PREREG KIN-BINDER-2 — the second binder pass, scored once on a window chosen by a rule fixed here

Written 2026-10-28 by the kin-binder session (a model, `self:model:claude-sonnet-5-5`), BEFORE the fresh window was chosen (no statement count of any candidate window has been computed), before any gold for it exists,
and before any bar below was scored on it. It follows PREREG-KIN-BINDER.md (janus#32, merged) and changes no bar of it.

## 0. What is registered, what is spent

- **Why.** The first binder (`bind-kin.mjs`, merged, off by default) failed its registered precision bar on its held-out window (0.591 against 2/3; RESULTS-KIN-BINDER.md). The ten wrong ends fell into three structural faults and
  one dialogue-splitter fault; the 70 of 114 unbound ends that no being on the page names are out of reach of any rule over the page. This pass fixes the faults, drops the rule that was 4 of 10 right, and adds one family for page-nameable
  ends the first binder missed. It is asked to clear the SAME bars on a window nobody has read.
- **The second binder** `scripts/kinship/bind-kin2.mjs` (a copy of the first with F1 to F5 and N1 as documented in its header; no name list, no model). Its fit set is the two windows already spent: chapters I to IV and V to VIII (golds
  `kin-binder-gold/gold-dev.json`, `gold-heldout.json`, both a self:model opinion). Numbers on them are fit numbers, not evidence (section 5).
- **THE FRESH WINDOW IS CHOSEN BY THIS RULE, written before any count.** The full text is `voyna-i-mir_Tolstoy_wikisource_full.txt` (sha256 `b2afb2bd979b9ad84ab4534c34dcf0206321d28fc3bc00d95c6492d7b7b723d9`). A chapter heading is a line matching `^\s*[IVXLC]+\.\s*$`.
  Candidate windows are blocks of four consecutive chapter headings, non-overlapping, in file order, the first block starting at the first heading at or after line 1895 (the heading «XXII.»: chapters up to XXI are read by the
  earlier experiments, log claude-ring and g1-3-composer-17). A block's text runs from its first heading's line to the line before the next block's first heading. The window is the FIRST block for which the plain extractor
  (`extract-kin.mjs`, unchanged, run on the block's text alone, language ru) finds at least 40 statements AND at least one of category A. Only those two counts are computed to choose; no statement, sentence or name of a
  candidate block is read. The chosen block's byte range and counts are filed in an addendum before its ledger is made.
- **Frozen before the window is chosen (sha256).**

| file | sha256 |
|---|---|
| scripts/kinship/bind-kin2.mjs (the second binder) | `b4703c99533211585b0c8a4fe7eeeedd1c674665bf8d6b8dbc75ba0c58357d3a` |
| scripts/kinship/score-kin-binder2.mjs (the scorer) | `1fda2e081c56f6b40029f224035d235d34395d4027df5201f30db410b8c73bd3` |
| scripts/kinship/bind-kin2.test.mjs | `8213a904a94c4fb3ad4cd84057fb0c4b25ea17da6951b571563ce00a44b88c1c` |
| scripts/kinship/bind-kin.mjs (the first binder, as merged) | `da075991f427d4483990b1a6a1bdd0ac84ab7465c834e4a4dc0452b73c540f72` |
| scripts/kinship/dump-ledger.mjs, extract-kin.mjs (as merged) | `c9baadb8e6700d52621b3550ae1912404e5e5b1008324827b442c38fccb2d485`, `a4f776bbadd6381f8ed1890804cac77c8b23b96e7a6d4eea222ac20514d766e4` |
| scripts/kinship/kin-binder-gold/LABELLING-PROTOCOL.md (the gold's lens, unchanged) | `11adf157edd840183af566173b6cbddd8e08f69f396a4eae72be1b1521f02611` |
| native/organs/kinship.js, priors/person-lexicon-ru.json, priors/pos-rus.json, priors/pronoun-ru.json (as merged) | `6f4b5131d9d267fb537b0104062f0acdb17f5bb9026b148c2894fce7156eb4ba`, `0731e331ae6e54b5c50eb08f182cd3b676d090eeed0b65b7c418b8c2220b3fde`, `92bc492f49c846a0c749f577d47723e105a26ce3b7b71cbb522c73abd80093d3`, `8b96b59ebb27843c457e17fb0da549844740d74d380a8f6db1304b43a6b0ac61` |

  Base janus main `cc0b0fa941bb2c9e2956d43387faa3b0df5cf4c9` (branch `kin-binder-2`); the reader khora 30fe444d, options `{language:'ru', minCharacters:0, referents:true, declension:true, lexicon:false}`, priors from this repository (as for the first window pair).
- **Order.** (1) this file is hashed and its hash filed in the pipeline log; (2) the window is chosen by the rule above and filed in an addendum; (3) its ledger is made by the reader and hashed; (4) its gold is made by reading its
  statements under LABELLING-PROTOCOL.md (unchanged, same lens), no binder output seen, hashed and filed; (5) the scorer runs ONCE; (6) every bar is reported whichever way it falls. A bug found after (1) is fixed only by an amendment
  hashed before (5). Nothing is fed to the English composer or to any answer unless the second binder clears its own bars B1 to B3 here.

## 1. Definitions (unchanged from PREREG-KIN-BINDER.md section 1)

Statement, holder, possessor, being, mention, gold (a self:model opinion by the binder's author, ends identified by the mention that names them, `null` with `unnamed`/`generic`/`not_in_ledger`), bound end, typed gap
(a kinship.js gap kind and a closed reason), fact (both ends bound to different beings, candidate, witnessed). Plain arm, controls and null percentile as there.

## 2. Arms and controls

Scored over (a) the unbound statements (extractor category not A) and (b) all statements, end-level and fact-level. **PLAIN** (category A tied as the foldcode build does), **V1** (the merged first binder, tier 2: the reference
this pass must beat on this window), **T1** and **T2** (the second binder, tier 1 and tier 2; T2 is the registered binder), **C1** chance in the paragraph-and-one-before pool, **C2** deranged ends, **C3** swapped ends (the mutant),
seed 20261027, 1000 draws, over the ends T2 binds.

## 3. Bars (judged on the fresh window; the same as the first binder's, none lowered)

- **B1** T2's end precision over the unbound statements is strictly above the larger of C1's and C2's p95 AND at least 2/3. Unassessed if T2 binds fewer than 10 ends or a null's p95 is 1.
- **B2** T2's correct ends over ALL statements exceed the plain arm's, AND T2's recall (correct ends / gold-bound ends over the unbound statements) is strictly above C1's recall p95. Unassessed with fewer than 10 gold-bound ends.
- **B3** Of T2's facts over the unbound statements, the share with both ends right is at least 1/2 and strictly above both nulls' p95. Unassessed with fewer than 3 facts or a null p95 of 1.
- **B4** every emitted fact is witnessed (byte span reads back, holds the kin word and both ends), giver `text:ru|rule:...`, standing `candidate`, ends are ledger beings: 100 percent.
- **B5** determinism: the scorer's result identical in two in-process runs and two CLI runs of `bind-kin2.mjs` byte-identical.
- **B6** default behaviour byte-identical: the PR adds files and changes none (`git diff --stat origin/main` shows only added files; the test file pins the first binder, the scorer, the extractor, `measure-kin.mjs` and `kinship.js`).
- **B7** every unbound end is a typed gap (kind in `GAP_KINDS`, reason in the closed set), none silent.
- **B8** no model, no network; opinion seam unchanged (the test file).
- **B9** the swapped-ends mutant (C3) falls below B1's threshold, so B1 can fail.
- **Reported with no threshold:** V1 beside T1 and T2 on the same window (did the fixes help), recall by the gold's licence kind, ends bound by rule, the typed gaps by reason, statements plain / V1 / T2 tie, and the count of facts T2 emits.
  **What the window can say about the composer:** the number of statements with both ends nameable from the page (the gold's `both-bound` count) is the ceiling of any page-only binder on that window.

## 4. What each outcome means

B1 to B3 passing says the structural faults were the cause and the second binder's ties are precise enough to file as candidates; it does not say they are many (recall is bounded by what the page names). B1 failing again says the page
rules, not their faults, are the limit, and the next step is a discourse model that no registration here covers. B3 unassessed (too few facts) says a page-only binder yields too few two-ended facts on a window to feed a
fact-needing consumer; that is a finding about the page, not a pass.

## 5. Fit numbers at the freeze (the two spent windows, which the second binder was fit to; not evidence)

- **chapters I to IV** (unbound statements 35, gold-bound ends 37): V1 binds 17, 16 right (precision 0.941, recall 0.432); T1 10 bound, 9 right (0.900); **T2 14 bound, 13 right (precision 0.929, recall 0.351), 3 facts of 9 possible**; nulls p95: chance 0.462, deranged 0.500, swapped-ends mutant 0.000.
- **chapters V to VIII** (unbound statements 57, gold-bound ends 44): V1 binds 22, 13 right (precision 0.591, recall 0.295); T1 12 bound, 11 right (0.917); **T2 13 bound, 12 right (precision 0.923, recall 0.273), 0 facts of 7 possible**; nulls p95: chance 0.385, deranged 0.385, swapped-ends mutant 0.077.
The first binder on the second of these (its held-out window) was precision 0.591; the second binder is precision 0.923 on it because it was fit to its ten wrong ends. That is why a window nobody has read is needed.

## 6. Not claimed

That a bound end is true; that the gold is right (it is the binder's author's opinion, self:model); that the ledger's referents are right; that the second binder reads dialogue turns (speakers who are pronouns or bare titles stay gaps); that
anything here changes a reading, a verdict or a weight. The plain extractor, the first binder, `kinship.js` and the composer are untouched.

## 7. Falsifying control

A window chosen after a count; a bar changed after the window was read; a gold hashed after the score; a held-out result whose C3 mutant does not fall below the threshold.
