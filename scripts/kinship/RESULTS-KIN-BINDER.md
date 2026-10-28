# RESULTS KIN-BINDER — the held-out window, scored once, beside the plain arm and the shuffled controls

Written after the held-out run. PREREG-KIN-BINDER.md (sha256 344e3162d91d065f1ec598ba8cfa249f8e2e0d5a93798d8eed72078a9c5666cb) and its addendum 1 (the held-out gold, sha256 4708f52b5e52bd2177098630728d8ad23291077802ccb8363ac5a646c923f6cf) were sealed before it; nothing in the binder, the scorer or the gold changed after. Every number below is read from `kin-binder-gold/results-heldout.json`.
**The gold is a self:model opinion** (holder `self:model:claude-sonnet-5-5`, lens = the labelling protocol's sha256), made by the binder's author; a count of "right" is agreement with that opinion, not with a giver. The binder calls no model.

## Headline

- **The registered binder (tier 2) FAILS its precision bar (B1).** Over the 57 unbound held-out statements it ties 22 ends and 13 agree with the gold (precision 0.591). That is above both chance controls (p95 0.318 and 0.182) but below the declared budget of 2 of 3. The plain arm ties 0 of those ends by construction.
- It does add: 13 correct ends over 44 gold-bound ends in the unbound statements (recall 0.295, chance p95 0.159), across 13 of 57 statements. **But it completes no fact:** it emits 3 facts (two ends) on the window and 0 of them are right; the one fact the plain arm ties (category A) is right.
- **Most of what the models add is not on the page.** Of the 114 ends of the unbound statements the gold says 63 are a being the passage does not name in that turn (unnamed) and 7 more have no ledger span (a bare title); only 44 are ends a reader of the page can name. A binder that reads only the page can reach at most those 44.
- Tier 1 alone (a marker on the page, no antecedent search) is more precise and much smaller: 11 ends, 8 right (precision 0.727, recall 0.182). The weak rule is **P-SUBJ** (a bare kin word takes the nearest being before it): 4 of 10 right on held-out (3 of 3 on development). The other tier-2 and tier-1 rules together: 9 of 12 (0.750). That last number is a post-hoc reading of a spent window, a lead for a new registration on a fresh window, not a result.

## Held-out window (chapters V to VIII; 58 statements, 57 unbound; categories {"N":44,"H":5,"P":8,"A":1})

Over the unbound statements (the target):

| arm | ends bound | right | wrong | precision | gold-bound ends | recall | facts | facts right | possible facts |
|---|---|---|---|---|---|---|---|---|---|
| PLAIN (category A only) | 0 | 0 | 0 | — | 44 | 0.000 | 0 | 0 | 7 |
| T1 (tier 1) | 11 | 8 | 3 | 0.727 | 44 | 0.182 | 0 | 0 | 7 |
| **T2 (the registered binder)** | 22 | 13 | 9 | 0.591 | 44 | 0.295 | 2 | 0 | 7 |

Over all 58 statements:

| arm | ends bound | right | wrong | precision | gold-bound ends | recall | facts | facts right | possible facts |
|---|---|---|---|---|---|---|---|---|---|
| PLAIN | 2 | 2 | 0 | 1.000 | 46 | 0.043 | 1 | 1 | 8 |
| T1 | 13 | 9 | 4 | 0.692 | 46 | 0.196 | 1 | 0 | 8 |
| T2 | 24 | 14 | 10 | 0.583 | 46 | 0.304 | 3 | 0 | 8 |

The plain arm reproduces the foldcode build's own facts on this window (cross-check {"fold_text_facts":1,"mine":1,"equal":true}).

Controls (over the ends T2 binds, so coverage is the same; seed 20261027, 1000 draws): C1 chance in the paragraph-and-one-before pool: precision mean 0.205, p95 0.318, p99 0.364; recall p95 0.159. C2 deranged ends: precision p95 0.182, recall p95 0.091. C3 swapped ends (the mutant): precision 0.182 (4 of 22).

## Bars (each as registered)

| bar | result | what | numbers |
|---|---|---|---|
| B1 | **FAIL** | end precision beats both nulls and the declared budget (2 of 3) | precision 0.591; null_p95 0.318; budget 0.667; bound 22 |
| B2 | **PASS** | binder ties more correct ends than the plain arm, and its recall beats the chance null | binder_correct_all 14; plain_correct_all 2; recall_unbound 0.295; null_p95 0.159; gold_bound_unbound 44 |
| B3 | **UNASSESSED** | emitted facts: both ends right at least half the time and beyond both nulls | fact_precision 0; facts 2; null_p95 0 |
| B4 | **PASS** | every emitted fact is witnessed (term and ends inside a byte span that reads back), has giver text:ru|rule:... and standing candidate, and ends that are ledger beings | — |
| B7 | **PASS** | every unbound end is a typed gap (kind of kinship.js, reason of the binder), none silent | — |
| B9a | **PASS** | mutant C3 (swapped ends) falls below the B1 precision threshold: the bar can fire | c3_precision 0.182; threshold 0.667 |
| B5 | **PASS** | determinism | the scorer's whole result identical in two in-process runs (true; sha256 6ad5b9d1ade4eebb…); two CLI runs of `bind-kin.mjs` on the held-out window give byte-identical files (sha256 77001a38b8aff527…); on development likewise (6116f637d83d58b3…) |
| B6 | **PASS** | default behaviour byte-identical | `scripts/kinship/bind-kin.test.mjs` pins the sha256 of extract-kin.mjs, kin-lexicon.mjs, measure-kin.mjs, native/organs/kinship.js and priors/kin-lexicon.json at main 9fe6d918; `git diff --stat origin/main` lists only added files; nothing imports the binder |
| B8 | **PASS** | no model, seam unchanged | the same test file: imports are node builtins, kinship.js and the extractor only; no network call; a gap's `opinionSlot` is accepted by the unchanged `fileOpinion` and filing an opinion leaves the binder's output byte-identical |

B3 is unassessed (2 facts over the unbound statements, fewer than the 3 it needs), so it is neither a pass nor a fail; for the record both of those facts and the third one, on the category-A statement, are wrong.

## What the wrong ends are (all 10, over all statements)

| stmt | plain cat | term | end | rule | binder tied | gold |
|---|---|---|---|---|---|---|
| 0 | N | wife | holder | H-APP-DET | князь ипполит | none (unnamed) |
| 5 | H | father | holder | H-APP-LEFT | Москву | none (unnamed) |
| 22 | N | son | possessor | P-SUBJ | Петербурга | Анна Михайловна (discourse) |
| 23 | H | mother | possessor | P-SUBJ | Ростовых | none (unnamed) |
| 24 | N | daughter | possessor | P-SUBJ | Натальи | none (unnamed) |
| 43 | N | husband | possessor | P-SUBJ | Еlіе | none (unnamed) |
| 52 | A | son | holder | H-APP2 | Николай | Борис (apposition) |
| 53 | N | son | possessor | P-GEN | Соня | none (not_in_ledger) |
| 54 | H | nephew | possessor | P-SUBJ | Соня | none (not_in_ledger) |
| 55 | H | son | possessor | P-SUBJ | Петруша | none (unnamed) |

Three failure modes: **(1)** P-SUBJ binds the nearest being even when that is a place (Петербург), a household (Ростовых), another item of a list, or the holder itself («Соня — пятнадцатилетняя племянница»): the ledger does not tell a person from a place, and a dash-and-comma list puts the holder right before the kin word. **(2)** A name taken across a preposition or a clause comma as an apposition (H-APP-DET: «жены с князем Ипполитом»; H-APP-LEFT: «в Москву, отец»). **(3)** P-GEN and H-APP2 reach over a comma into the next list item («старший сын графа, Соня», «сын княгини Анны Михайловны, Николай»). The binder's own parameters did not decide these; the structure rules did. They are what a person gate and a list reader would have to fix.

## By rule (T2, unbound statements)

| rule | ends bound | right | precision |
|---|---|---|---|
| H-APP-DET | 4 | 3 | 0.75 |
| P-REFL | 1 | 1 | 1.00 |
| H-APP-LEFT | 2 | 1 | 0.50 |
| P-SUBJ | 10 | 4 | 0.40 |
| P-SPEAKER | 1 | 1 | 1.00 |
| P-GEN | 4 | 3 | 0.75 |

## What a rule can reach: recall by the gold's licence kind (unbound statements)

| gold licence of the end | gold-bound ends | T1 right | T2 right |
|---|---|---|---|
| apposition | 8 | 4 | 4 |
| deictic | 9 | 1 | 1 |
| discourse | 6 | 0 | 0 |
| genitive | 5 | 3 | 3 |
| pronoun | 8 | 0 | 1 |
| reflexive | 2 | 0 | 1 |
| subject | 6 | 0 | 3 |

Apposition and genitive ends (a name written beside the kin word) are what the rules reach; discourse ends (named elsewhere in the paragraph, no marker) are reached by nothing here; deictic ends (first and second person) are reached only when the speaker or addressee is a name in the turn (P-SPEAKER 1 of 1; P-VOC never fired on this window).

## What stays a typed gap, and why (T2, unbound statements: 114 ends)

| reason | gaps | the gold says a being was nameable | the gold says none was (an honest gap) |
|---|---|---|---|
| no_marker | 81 | 22 | 59 |
| addressee_not_named | 2 | 1 | 1 |
| speaker_not_named | 2 | 2 | 0 |
| antecedent_ambiguous | 2 | 2 | 0 |
| genitive_or_apposition | 2 | 1 | 1 |
| pronoun_in_speech | 2 | 2 | 0 |
| antecedent_absent | 1 | 0 | 1 |

`no_marker` is the bulk: the kin word has no name, possessive or apposition beside it. The gold says 63 ends are unnamed in that turn and 7 have no ledger span (a bare title: «графа», «гостья», «Графиня»); those gaps are the right answer, and they are typed (`no_parent_fact`, `no_sibling_fact` or `no_spouse_fact` of kinship.js with the slot's one hole, and an `opinionSlot` an opinion may fill; stated composites such as «дядя» get no slot and say so). The rest are ends the gold says a reader can name and the rules did not reach: a pronoun speaker (`speaker_not_named`), a pronoun antecedent with two candidates in its sentence (`antecedent_ambiguous`), a pronoun in what the dialogue splitter took for speech (`pronoun_in_speech`: a dash inside narration cuts the paragraph, a known weakness), and `genitive_or_apposition` (the case prior is too weak to decide).

## Development window beside it (SPENT: the rules were fit to it)

Over its 35 unbound statements: T2 bound 17, 16 right (precision 0.941, recall 0.432); T1 10 bound, 9 right. On held-out: precision 0.591, recall 0.295. The drop (0.941 to 0.591) is what a fit to 37 statements costs on a fresh window; the rule that was 3 of 3 on development (P-SUBJ) is 4 of 10.

## Premise ledger rerun (the 24 questions of foldcode-answer)

The premise ledger (24 questions; 9 are kinship: 6 T-KIN, 3 C-UNCLE) was rebuilt by the unchanged `build-ledger.mjs` (a copy with two path fixes) on the development fold with the binder's tier-2 candidate facts added for the statements the plain arm left unbound (`kin-binder-gold/ledger-rerun.json`; the fold is made by `kin-binder-gold/make-patched-fold.mjs`). The control (nothing added) reproduces the original ledger exactly (true). The ledger's audit reads a half-tied statement only by its own span text, so the binder's partial result can be handed over two ways, both run:

| reading | fully mechanical / one giver away / needs a new rule family / model's opinion |
|---|---|
| original, first reading | 3 / 0 / 10 / 11 |
| original, closed-text reading | 7 / 1 / 16 / 0 |
| (A) half-tied statements relabelled by the tied end: first reading | 3 / 0 / 11 / 10 |
| (A) closed-text reading | 5 / 1 / 18 / 0 |
| (B) only fully tied statements leave the unbound list: first reading | 3 / 0 / 10 / 11 |
| (B) closed-text reading | 7 / 1 / 16 / 0 |

**Questions moved against the control:** (A) Q6 князь Василий (closed-text none to new_rule_family); Q8 князь Василий (closed-text none to new_rule_family). (B) none.

The binder added 4 fact specs (2 parent_of, 2 sex) and they all restate a relation the plain arm already holds (князь Василий parent of Элен), under another giver: **the binder supplies no kin fact the fold lacked on this window**, so no premise is newly evidenced. Reading (A)'s moves look like an artefact of the audit, not a gain or a loss of the binder (as far as kinSlotAudit in build-ledger.mjs shows): once `«Князь Василий желал определить сына»` has its possessor tied, the audit sees a child-term statement near Князь Василий whose text does not name him and counts it as evidence for `parent_of(?, князь Василий)`; it does not see that the tied end is the subject itself. Unbound statements 35 to 32.

Per kinship question (first reading / closed-text reading):

| Q | subject | control | (A) | (B) |
|---|---|---|---|---|
| Q1 T-KIN | Анна Павловна | model_opinion / new_rule_family | model_opinion / new_rule_family | model_opinion / new_rule_family |
| Q3 T-KIN | Элен | model_opinion / new_rule_family | model_opinion / new_rule_family | model_opinion / new_rule_family |
| Q6 T-KIN | князь Василий | model_opinion / none | model_opinion / new_rule_family | model_opinion / none |
| Q8 C-UNCLE | князь Василий | model_opinion / none | new_rule_family / new_rule_family | model_opinion / none |
| Q11 C-UNCLE | Анна Павловна | new_rule_family / new_rule_family | new_rule_family / new_rule_family | new_rule_family / new_rule_family |
| Q14 T-KIN | Пьер | model_opinion / named_giver | model_opinion / named_giver | model_opinion / named_giver |
| Q17 C-UNCLE | Пьер | model_opinion / none | model_opinion / none | model_opinion / none |
| Q19 T-KIN | Бонапарте | model_opinion / none | model_opinion / none | model_opinion / none |
| Q22 T-KIN | князь Андрей | model_opinion / new_rule_family | model_opinion / new_rule_family | model_opinion / new_rule_family |


## Repository checks (janus has no CI workflows)

`gh api repos/scores-patch-points/janus/actions/workflows` lists 0 workflows and PR #31 had an empty status rollup, so there is no CI to be green. What stands in for it: every `*.test.mjs` of the repository run with `node --test`. On clean main (9fe6d918): 137 tests, 127 pass, 9 fail. On this branch: 156 tests, 146 pass, 9 fail. The same 9 files fail on main and on the branch (native/organs/consequence.test.mjs, native/organs/fold-claims.test.mjs, native/organs/identity/finder.test.mjs, native/organs/identity/identity-cube.test.mjs, native/organs/kind-induction.test.mjs, native/organs/nl-eot.test.mjs, native/organs/nomos.test.mjs, native/organs/nonsense.test.mjs, native/organs/ruliad.test.mjs, failing tests:); the branch adds 19 tests (`scripts/kinship/bind-kin.test.mjs`), all passing, and breaks none.

## Not claimed

That a bound end is true; that the gold is right; that the ledger's referents are right (the gold flags 3 held-out ends `doubtful` for a ledger split or merge, and none of the 10 wrong ends is one of them); that the binder reads dialogue; that precision would hold on a third window. The failed bar is a finding, not a retry: the rules stand as registered, and a changed binder (for instance without P-SUBJ, with a person gate and a list reader) is a new registration on a window nobody has read.
