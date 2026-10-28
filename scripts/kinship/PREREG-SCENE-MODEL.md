# PREREG SCENE-MODEL — a mechanical scene (discourse) model for the kin ends, scored once on a fresh window chosen by a rule fixed here

Written 2026-10-28 by the scene-model session (a model, `self:model:claude-sonnet-5-5`), BEFORE the fresh window was chosen (no statement count of any candidate window has been computed), before any gold for it exists, and before any bar below was scored on it.
It follows PREREG-KIN-BINDER-2.md (janus#34, merged) and PIPELINE-LOG entries kin-binder-5 to -12 and claude-ring-102, which found that a page-only reader ties both ends of 2 of 45 kin statements on a fresh window, that the plain extractor ties no two-ended kin
statement in 26 earlier four-chapter blocks, and that the missing piece is a model of who is present in a scene and what is known of them.

## 0. What is registered, what is spent

- **The scene model** `scripts/kinship/scene-kin.mjs` (off by default; nothing imports it; the PR adds files and changes none). RULES over the givers the binders already read: the reader's ledger of beings, the part-of-speech, pronoun, person and kin lexicon priors and the name-parts prior.
  No name list, no model, no network. It fills only the ends the second binder (`bind-kin2.mjs`, unchanged, the PAGE LAYER) leaves as typed gaps; it never replaces a tie the page layer made; it never ties both ends to one being.
  - **Scene.** A run of paragraphs sharing participants: a hard break at a chapter heading; a soft break at a paragraph that names beings none of which was named in the last W paragraphs of the scene. **W = 3**, DERIVED by `derive-scene-params.mjs` from the three spent windows:
    the share of paragraphs whose beings recur within the last w paragraphs of the same chapter, against the same share with each chapter's paragraphs shuffled (seeded, 1000 draws), stops gaining over the null's p95 at w = 3
    (real 0.294, 0.480, 0.605, 0.667, 0.696; null p95 0.278, 0.431, 0.523, 0.592, 0.634; gain 0.016, 0.049, 0.082, 0.075, 0.062 for w = 1 to 5; 306 paragraphs with beings in 13 chapters). **Setting is not read** (the only list-free signals of a place are indistinguishable from persons in the ledger): a declared limit; the labeller marks scene breaks by setting and company, and the agreement is reported, not barred.
  - **Roster and gender vote.** A being's gender is a vote of (a) a patronymic's suffix class (the extractor's own class), (b) the past-tense ending (-л / -ла) of the first verb after a mention of it that is not after a preposition. A being is a PERSON for a rule only with a gender (the ledger holds places too). A verb is a token the part-of-speech prior tags VERB, or, with no prior entry, a lower-case word of at least four letters in the past-tense ending class.
  - **Focus.** Each comma-delimited clause has a subject: its first person-being before its first verb that is not after a preposition, else a third-person subject pronoun (clause-initial, not a possessive, a gender of its own, no noun after it) resolved to the most recent earlier sentence of the scene with a gender-compatible person (that sentence's subject preferred; two compatible and none the subject is a gap); an attribution's subject is its speaker. The TOPIC is the latest sentence subject.
  - **Store.** The two-ended ties the page layer made earlier in the scene.
  - **Rules.** S-PRON (tier 1): a possessive the page layer could not place is resolved through the scene (reflexive «свой»: the nearest clause subject). S-SUBJ (tier 2): a kin word with no marker takes the nearest clause subject before it in its sentence as possessor. S-TOPIC (tier 2): none before it in its sentence: the scene's topic.
    K-KNOWN (tier 3): the possessor is tied and the store holds one fact of the same relation with that possessor: its other end is the holder. S-OTHER (tier 3): the possessor is tied: the one other person named in the sentence (else the paragraph) whose gender does not contradict the kin word's sex; two or more is a gap. Statements inside speech are left as typed gaps (`scene_bare_in_speech`).
  - **S3 (tier 3) is the REGISTERED model; every bar below judges S3.** S1 and S2 (tiers 1 and 2), the page layer T2, and A0 (S3's rules with the scene cut to the paragraph and the one before) are reported beside it with no bar.
- **Frozen before the window is chosen (sha256).** Janus main `1a02f3c3de5f957c7eca2479fd16f6b5fc2fafca`; the frozen commit `37769db` (detached worktree; no branch is created locally, the PR branch is the push target at the end).

| file | sha256 |
|---|---|
| scripts/kinship/scene-kin.mjs (the scene model) | `e387926d84a02af3db6a021e93dc542070d5cfcc96012499b5f75e9b88029a18` |
| scripts/kinship/scene-kin.test.mjs (15 tests) | `312a860fc47f6582be478e1a936351f983aff349b349306c136341339728cac3` |
| scripts/kinship/score-scene-kin.mjs (the scorer) | `74e6bc1b776f5f7ec78e394b15367b6ba69f0491ec5455c89c9c6ff94da2b298` |
| scripts/kinship/validate-gold-scene.mjs | `41db54e6cd38475a4b5ff8bdbe9520b83a99985fc32aab3204f9bfe0fe88c1c2` |
| scripts/kinship/choose-window-scene.mjs (the window rule) | `0dafa5ea0143c79ba4fc30018c454e2cf003eca11ddf39d74ac0bea0285ac69d` |
| scripts/kinship/make-labelling-pack-scene.mjs | `d583fccc060746081ed8454fd413026317994b95587e8a7c3675cad1ce11cf5e` |
| scripts/kinship/fill-quote-at-scene.mjs | `5e160aad4f7893e5baf2585266ffb84a85bfb3ff177fd903cf3342b9bee95587` |
| scripts/kinship/derive-scene-params.mjs, fit-scene-kin.mjs | `06e5fdf713dce0f2916e75c687d212aa988ea9b8440b2c49b1668795663c3cf4`, `bb97550f3f8ec92258dd499783d413179611d92f9bb6a7028dea8b97a1c041ff` |
| scripts/kinship/kin-binder-gold/LABELLING-PROTOCOL-SCENE.md (the gold's lens) | `a53cfdeb553061e2d130d6a29559b6ec7068d724c6498e9e88dcf2999e7efed1` |
| scripts/kinship/kin-binder-gold/LABELLING-PROMPT-SCENE.md (the brief the labeller is given) | `1f0e2b29f68ce313c78332cabbfbf2232c820262b3b1001cae4be8e89fcf298f` |
| scripts/kinship/bind-kin2.mjs (the page layer), bind-kin.mjs, score-kin-binder2.mjs (as merged) | `b4703c99533211585b0c8a4fe7eeeedd1c674665bf8d6b8dbc75ba0c58357d3a`, `da075991f427d4483990b1a6a1bdd0ac84ab7465c834e4a4dc0452b73c540f72`, `1fda2e081c56f6b40029f224035d235d34395d4027df5201f30db410b8c73bd3` |
| scripts/kinship/extract-kin.mjs, dump-ledger.mjs (as merged) | `a4f776bbadd6381f8ed1890804cac77c8b23b96e7a6d4eea222ac20514d766e4`, `c9baadb8e6700d52621b3550ae1912404e5e5b1008324827b442c38fccb2d485` |
| native/organs/kinship.js; priors/person-lexicon-ru.json, pos-rus.json, pronoun-ru.json, kin-lexicon.json, name-parts-ru.json (as merged) | `6f4b5131d9d267fb537b0104062f0acdb17f5bb9026b148c2894fce7156eb4ba`; `0731e331ae6e54b5c50eb08f182cd3b676d090eeed0b65b7c418b8c2220b3fde`, `92bc492f49c846a0c749f577d47723e105a26ce3b7b71cbb522c73abd80093d3`, `8b96b59ebb27843c457e17fb0da549844740d74d380a8f6db1304b43a6b0ac61`, `693f23772d76fb5d582b76db7d5b40d88803eaa91cb47cf05a54b958a59a1737`, `96aae932beec3609a71d3e3e6214bcd43a3259e51f1d10a31889375992ba09c6` |

  The reader: khora `30fe444dfecdd6f6e1a32018047eee9d8291514b` (exported read-only with `git archive`, no fetch), options `{language:'ru', minCharacters:0, referents:true, declension:true, lexicon:false}`, priors from this repository. TOOLCHAIN CHECK made before anything was built: this reader and `dump-ledger.mjs` reproduce the kin-binder-2 window's ledger byte for byte (sha256 `fac1a3bc3310d0a3e2775fb63e690b4ad590a29fe33d05a00d5c2e1e91e42543`).
  The full text is `voyna-i-mir_Tolstoy_wikisource_full.txt` (sha256 `b2afb2bd979b9ad84ab4534c34dcf0206321d28fc3bc00d95c6492d7b7b723d9`).

- **THE FIT SET (SPENT) AND WHAT WAS DONE TO THE MODEL LOOKING AT IT.** The model was built and revised looking at the three windows the two earlier passes spent: chapters I to IV (sha256 `1b298906…`, gold `gold-dev.json`), chapters V to VIII (`55ab82f0…`, `gold-heldout.json`) and full-text lines 10467 to 10620
  (`22988702…`, `gold-window2.json`); their golds are PAGE-lens opinions by the earlier binder's author, in which a tie to a being the page lens called unnamed counts as wrong although a scene reader might credit it. The revisions, in order, each made after a fit run: (1) W derived and set to 3; (2) a person test (a being needs a gender vote to be a topic, a pronoun's antecedent or a holder candidate; verb votes are not taken from names after a preposition),
  after the first run tied places («Москве», «Лысые Горы», «Отрадного») as topics and holders; (3) the past-tense ending class as a verb where the prior has no entry (the prior tags few verbs); (4) subjects per comma-delimited clause instead of per sentence. **Fit numbers are not evidence.** Ends bound / correct over the unbound statements (page-lens golds; "wrong where gold null" counted wrong):

| window | T2 (page layer) | S1 | S2 | S3 | A0 |
|---|---|---|---|---|---|
| chapters I to IV (35 unbound) | 14 / 13 | 14 / 13 | 21 / 16 | 26 / 17 (facts 8, right 4) | 26 / 17 |
| chapters V to VIII (57 unbound) | 13 / 12 | 16 / 14 | 33 / 21 | 36 / 21 (facts 8, right 2) | 37 / 22 |
| lines 10467 to 10620 (44 unbound) | 0 / 0 | 0 / 0 | 33 / 20 | 35 / 20 (facts 2, right 0) | 33 / 20 |
| pooled | 27 / 25 (0.926) | 30 / 27 (0.900) | 87 / 57 (0.655) | 97 / 58 (0.598) | 96 / 59 (0.615) |

  **A PREDICTION, registered and not a bar:** on these numbers S3's end precision is below the 2/3 bar on the fit set even against golds that undercount it; the scene extension adds nothing measurable over the paragraph-only variant A0 (59 correct of 96 against 58 of 97); and the rules that tie holders (S-OTHER, K-KNOWN) are 1 right of 13 on the fit set against page-lens golds. The author expects B1 to fail and B3 to be unassessed or to fail, and registers the model anyway,
  because the doctrine is to register the model the task describes (rules that resolve pronoun possessors and beings named elsewhere in the scene), score it once on a window nobody has read, and report the ceiling it finds. A pass would be a finding the fit set does not predict.

## 1. Definitions (those of PREREG-KIN-BINDER.md section 1 and -2, with one change of lens)

Statement, holder, possessor, being, mention, bound end, typed gap, fact: as there. **The gold is a SCENE-lens opinion** (`LABELLING-PROTOCOL-SCENE.md`): an end is bound when a careful reader of the statement's SCENE (every paragraph of the scene, before or after the statement, none outside it) can name the being from the scene's text alone, with no world knowledge and no kin derivation;
the gold also lists the scene breaks, the licence `kind` of every bound end (the page kinds plus `scene`) and its `direction` (`same_sentence`, `before`, `after`). **The labeller is a separate model context**: it is given the protocol, the window's text with numbered paragraphs, the statements and the reader's beings, and nothing else; it never sees the scene model, any binder, its output, or the window's place in the novel; it is not given the structural validator.
The author of the model and the labeller are different contexts of one model family: a dependence, declared, not removed. The gold is an opinion: never evidence, never licensing, supersedable.

## 2. The window, chosen by this rule, written before any count

The series of PREREG-KIN-BINDER-2 section 0 is continued: chapter headings are lines matching `^\s*[IVXLC]+\.\s*$`; candidate windows are blocks of four consecutive headings, non-overlapping, in file order, the first block starting at the first heading at or after full-text line 1895; blocks 1 to 27 are spent (the kin-binder-2 pass computed counts for blocks 1 to 26 and read block 27, full-text lines 10467 to 10620).
A block's text runs from its first heading's line to the line before the next block's first heading. **The window is the first block from block 28 on for which the plain extractor (`extract-kin.mjs`, unchanged, run on the block's text alone, language ru) finds at least 40 statements AND at least one of category A** (a kin statement the plain extractor ties at both ends: the window "states a kin relation").
Only those two counts are computed to choose (`choose-window-scene.mjs`); no statement, sentence or name of a candidate block is read. The chosen block's byte range and counts are filed in an addendum before its ledger is made.

## 3. Order

(1) this file is hashed and its hash filed in the pipeline log; (2) the window is chosen by the rule and filed in addendum 1; (3) its ledger is made by the reader twice and hashed, and the labelling pack (numbered text, statements, beings) is made and hashed — the author reads none of them;
(4) the labeller context makes the gold from the pack alone; the author runs the structural validator and hands problems back (form only); `quoteAt` is filled mechanically; the gold is hashed and filed in addendum 2 before any score; (5) the scorer runs ONCE; (6) every bar is reported whichever way it falls, with the ceiling if it fails. A bug found after (1) is fixed only by an amendment hashed before (5).
Nothing is fed to the English composer or to any answer; its last bar (R4) and the kinship answers of G1-2 wait on a binder that clears its bar.

## 4. Arms, controls and bars (judged on the fresh window; all judge S3, the unbound statements = extractor category not A)

Arms: **PLAIN** (category A tied as the foldcode build does), **T2**, **S1**, **S2**, **S3** (registered), **A0**. Controls over the ends S3 binds on the unbound statements, seed 20261028, 1000 draws: **C1** chance in the paragraph-and-one-before pool; **C2** deranged ends (S3's referents permuted among its bound ends of the same kind);
**C1S** chance in the statement's SCENE pool (the beings named in its scene up to its paragraph; stricter than C1); **C3** swapped ends (the mutant); **SC** the shuffled-scene control: at every paragraph start the scene state (topic, recent sentences, store) of a uniformly drawn paragraph of ANOTHER scene replaces the real one, and S3's rules are applied.

- **B1** S3's end precision over the unbound statements is strictly above the largest p95 of C1, C2 and C1S AND at least 2/3. Unassessed if S3 binds fewer than 10 ends or a null's p95 is 1.
- **B2** S3's correct ends over ALL statements exceed the plain arm's, AND S3's recall (correct ends / gold-bound ends over the unbound statements) is strictly above C1S's recall p95. Unassessed with fewer than 10 gold-bound ends.
- **B3** Of S3's facts over the unbound statements, the share with both ends right is at least 1/2 and strictly above the largest p95 of the three nulls' fact precision, AND S3's correct two-ended facts over ALL statements exceed the plain arm's. Unassessed with fewer than 3 facts or a null p95 of 1.
- **B4** every emitted fact is witnessed (byte span reads back, holds the kin word and both ends), giver `text:ru|rule:...`, standing `candidate`, ends are ledger beings: 100 percent.
- **B5** determinism: the scorer's result identical in two in-process runs, the model's output identical in two runs, and two CLI runs of `scene-kin.mjs` byte-identical.
- **B6** nothing existing changed: the PR adds files and changes none (`git diff --stat main` shows only added files; the test file pins the second binder, the first binder, the extractor, the scorer of the second binder and `kinship.js` by sha256).
- **B7** every unbound end is a typed gap (a kind of `GAP_KINDS`, a reason of the closed set `SCENE_REASONS`), none silent.
- **B8** no model, no network, no list: the test file shows the model's imports are node builtins, the kinship organ, the second binder and the extractor, and the source holds no fetch, socket or process spawn.
- **B9** the swapped-ends mutant (C3) falls below B1's threshold, so B1 can fail. Unassessed with fewer than 3 mutant ends.
- **B10** the shuffled-scene control: S3's precision is strictly above SC's p95 AND S3's correct ends are strictly above SC's p95 of correct ends. Unassessed if S3 binds fewer than 10 ends or the window has one scene.
- **"CLEARED"** is said only if B1, B2, B3 and B10 pass and B4 to B9 pass. A bar that is unassessed is not a pass. If S3 fails and S2 or S1 would pass B1's numeric test, the result says so as a finding about the rules that tie holders, not as a pass of the model.
- **Reported with no threshold:** every arm's ends bound, correct, wrong, precision, recall, facts; S3's ends by rule, by gold kind and by gold direction; the typed gaps by reason; the ceiling (gold ends bound, statements with both ends bound in the scene, those with no forward reference); the labelled scene breaks against the mechanical ones (exact and within one paragraph); A0 beside S3 (does the scene add anything over the paragraph).

## 5. What each outcome means

B1 to B3 and B10 passing says a mechanical scene model ties kin ends precisely enough to file as candidates on a window nobody had read; it does not say they are many, nor that a tied end is true. B1 failing with B10 passing says the scene state carries information but the clause-subject rules are too coarse.
B10 failing says the rules, not the scene, do the work. B3 unassessed or failing says a scene model yields too few two-ended facts to feed a fact-needing consumer; the ceiling then says how many two-ended statements any reader of the scene could tie (the gold's both-ends count) and how many of the gold's ends the reader's ledger cannot hold at all (`not_in_ledger`).
Whatever happens, the English composer and the kinship answers are not fed.

## 6. Not claimed

That a bound end is true; that the gold is right (a separate model context's opinion); that the ledger's referents are right (merged and missing beings are flagged `doubtful` or `not_in_ledger` in the gold); that scenes are segmented correctly (reported, not barred); that setting is read (it is not); that anything here changes a reading, a verdict or a weight.

## 7. Falsifying control

A window chosen after a count other than the two registered; a bar changed after the window was read; a gold hashed after the score; a labeller that was given the model's code or output; a name list or a model call in the scoring path; a result whose scorer or model output differs on a second run.
