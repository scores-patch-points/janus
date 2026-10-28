# RESULTS KIN-BINDER-2 — the second pass on the fresh window, scored once

Written after the run. PREREG-KIN-BINDER-2.md (sha256 7ef287d7774e039b21a46cf7522ba2df7ac9ce74c592a11582e4503cfeab1787), its addendum 1 (the window, chosen by the registered rule) and addendum 2 (the gold, sha256 a4cda44a85b1ba2568101a5baa57987e4029b4dbd55b8bf6e670ca0c2d98c3e1) were sealed before it; nothing in the binders, the scorer or the gold changed after. Every number is read from `kin-binder-gold/results-window2.json`.
**The gold is a self:model opinion** (the labeller is the binder's author). No model is called by either binder.

## Headline

- **The second binder ties nothing beyond the plain arm on this window.** On the 44 unbound statements it binds 0 ends; on all 45 it ties the same 2 ends the plain arm ties (the one category-A statement). **B2 FAILS** (its correct ends over all statements, 2, do not exceed the plain arm's, 2; recall 0); **B1 and B3 are unassessed** (fewer than 10 ends bound; fewer than 3 facts). B4, B5 (two CLI runs byte-identical, scorer twice identical), B6, B7, B8 pass; B9 is unassessed (the mutant needs 3 ends to bite).
- **The first binder, on the same window, is worse than on its own:** it binds 7 ends of the unbound statements and 2 are right (precision 0.286; it was 0.591 on its held-out window). Removing P-SUBJ and fixing the three structural faults removes its false ties; they did not buy any recall, because here nothing else on the page ties.
- **A page-only binder cannot feed a consumer that needs two-ended kin facts.** Of the 45 statements, 2 have both ends nameable from the page in the gold: #20 (A, son); #32 (N, brother, both ends one ledger referent). One of them is the plain arm's own fact (Христос, сын Бога); the other is a statement whose two ends the ledger gives ONE referent (Николай and Наташа are merged). The ceiling of any rule over the page on this window is the plain arm's one fact. On the earlier two windows the ceiling was 11 of 37 and 8 of 58 statements; the first binder's two-ended facts were 5 right of 5 on the first (two of them the plain arm's) and 0 right of 3 on the second.
- **The plain extractor itself ties a kin statement at both ends in none of the 26 four-chapter blocks before this one** (full-text lines 1895 to 10466; `kin-binder-gold/window2-choice.json` lists every block with its two counts). On this novel the only source of two-ended kin facts is something other than the plain arm and the page: a discourse model.

## The window

Chosen by the registered rule (PREREG-KIN-BINDER-2.md section 0), not by me: block 27, full-text lines 10467 to 10620, 43521 bytes, headings XXVI., I., II., III. (the end of the third part and the start of the fourth), 45 statements, 1 of category A. Its reader ledger has 52 beings; **княжна Марья, the being most of its kin words are about, is not among them**, and the ledger gives Николай and Наташа one referent and the bare title князь (the old prince) the referent of князь Андрей. 20 ends are `not_in_ledger` for that reason or a bare title, 36 are unnamed in that turn, 6 generic.

## Fresh window (45 statements, 44 unbound; categories {"N":43,"A":1,"P":1})

Over the unbound statements:

| arm | ends bound | right | wrong | precision | gold-bound ends | recall | facts | facts right | possible facts |
|---|---|---|---|---|---|---|---|---|---|
| PLAIN (category A only) | 0 | 0 | 0 | — | 26 | 0 | 0 | 0 | 1 |
| V1 (the merged first binder, tier 2) | 7 | 2 | 5 | 0.286 | 26 | 0.077 | 0 | 0 | 1 |
| T1 (second binder, tier 1) | 0 | 0 | 0 | — | 26 | 0 | 0 | 0 | 1 |
| **T2 (second binder, registered)** | 0 | 0 | 0 | — | 26 | 0 | 0 | 0 | 1 |

Over all 45 statements:

| arm | ends bound | right | wrong | precision | gold-bound ends | recall | facts | facts right | possible facts |
|---|---|---|---|---|---|---|---|---|---|
| PLAIN | 2 | 2 | 0 | 1 | 28 | 0.071 | 1 | 1 | 2 |
| V1 | 9 | 4 | 5 | 0.444 | 28 | 0.143 | 1 | 1 | 2 |
| T1 | 2 | 2 | 0 | 1 | 28 | 0.071 | 1 | 1 | 2 |
| T2 | 2 | 2 | 0 | 1 | 28 | 0.071 | 1 | 1 | 2 |

Controls (over the ends T2 binds: none on the unbound statements, so the nulls are 0): C1 chance precision p95 0, recall p95 0; C2 precision p95 0; C3 precision —. A binder that ties nothing cannot be separated from nothing, which is why B1, B3 and B9 are unassessed rather than passed.

## Bars (as registered)

| bar | result | what | numbers |
|---|---|---|---|
| B1 | **UNASSESSED** | end precision beats both nulls and the declared budget (2 of 3) | precision null; null_p95 0; budget 0.667; bound 0 |
| B2 | **FAIL** | binder ties more correct ends than the plain arm, and its recall beats the chance null | binder_correct_all 2; plain_correct_all 2; recall_unbound 0; null_p95 0; gold_bound_unbound 26 |
| B3 | **UNASSESSED** | emitted facts: both ends right at least half the time and beyond both nulls | fact_precision null; facts 0; null_p95 0 |
| B4 | **PASS** | every emitted fact is witnessed (term and ends inside a byte span that reads back), has giver text:ru|rule:... and standing candidate, and ends that are ledger beings | — |
| B7 | **PASS** | every unbound end is a typed gap (kind of kinship.js, reason of the binder), none silent | — |
| B9a | **UNASSESSED** | mutant C3 (swapped ends) falls below the B1 precision threshold: the bar can fire | c3_precision null; threshold 0.667 |
| B5 | **PASS** | determinism | scorer identical in two in-process runs (sha256 3ac32ded4353dca7…); two CLI runs of `bind-kin2.mjs` byte-identical (sha256 c1aec24d5519864d…) |
| B6 | **PASS** | default byte-identical | the PR adds files and changes none; the second test file pins the first binder, the first scorer, the extractor, `measure-kin.mjs` and `kinship.js` |
| B8 | **PASS** | no model, seam unchanged | imports are node builtins, kinship.js and the extractor; no network; a gap's `opinionSlot` is accepted by the unchanged `fileOpinion` |

## What the page-nameable ends were, and what reached them

| gold licence | gold-bound ends (unbound statements) | T1 right | T2 right |
|---|---|---|---|
| deictic | 2 | 0 | 0 |
| discourse | 10 | 0 | 0 |
| pronoun | 10 | 0 | 0 |
| subject | 4 | 0 | 0 |

The 26 ends a reader of the page can name are pronouns whose possessor is the clause's subject (10), ends named elsewhere in the paragraph (10), subjects (4) and deictic ends (2). **None carries a marker on the kin word** (no possessive, no apposition, no genitive: the only apposition and genitive in the window are the plain arm's category-A statement). The rules that read a marker on the page have nothing to read here; the one rule that read an implicit subject (P-SUBJ) was removed because it was 4 of 10 right on the previous window, and on this window it ties 7 ends of which 2 are right (V1 above). The window is a letter and indirect narration about a family named by kin words and a title: the kin of the unnamed.

## What stays a typed gap

88 unbound ends, all typed (a kinship.js gap kind and a reason; the unchanged `opinionSlot` where one can be filed):

| reason | gaps | the gold says a being was nameable | the gold says none was |
|---|---|---|---|
| no_marker | 80 | 26 | 54 |
| genitive_or_apposition | 4 | 0 | 4 |
| pronoun_in_speech | 2 | 0 | 2 |
| antecedent_absent | 2 | 0 | 2 |

## Repository checks (janus has no CI workflows)

Every `*.test.mjs` with `node --test`: 172 tests, 162 pass, 9 fail: the same 9 files that fail on main without this branch (consequence, fold-claims, finder, identity-cube, kind-induction, nl-eot, nomos, nonsense, ruliad); the branch adds 16 tests (`bind-kin2.test.mjs`), all passing.

## Reading it

The second pass was asked the same bars on a window nobody had read and it did not clear them: the structural faults were real (each is shown firing on the first binder and fixed on the second in `bind-kin2.test.mjs`) and fixing them made the binder's ties precise on the windows it was fit to (0.929 and 0.923), but on a fresh window the fixed binder has nothing to tie, because the page does not mark these kin words. The lead the first result entry gave (a person gate, lists) was a lead for precision; the evidence of this window is that the missing piece is not precision. What no rule over the page can do is name the wife, the father or the nephew of someone the passage names only by a title, a pronoun or a kin word; that needs a discourse model of who is present (the scene's beings and their known relations), whose facts the plain arm does not supply (none in 26 blocks). A binder is not a way to feed the composer's shuffled-fact control from the page; nothing here is fed to it.

## Not claimed

That a tied end is true; that the gold is right; that the ledger's referents are right (14 ends in this gold are flagged `doubtful` for a merge); that a discourse model would work (not tried); that anything here changes a reading, a verdict or a weight.
