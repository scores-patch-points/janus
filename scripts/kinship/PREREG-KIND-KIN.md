# PREREG KIND-KIN — the second end of a kin fact from polarity-aware kind induction over the hyperlexicon, scored once on a fresh window chosen by a rule fixed here

Written 2026-10-28 by the scene-model session (a model, `self:model:claude-sonnet-5-5`), BEFORE the fresh window was chosen (no statement count of any candidate window has been computed for this registration), before any gold for it exists, and before any bar below was scored on it.
It follows PREREG-SCENE-MODEL.md (janus#37, open) and the user's direction relayed by the session "Scorespatchpoints versions": "this should be done through polarity aware kind induction and the hyperlexicon". The scene model failed its bars (B1 0.645 against 2/3, B3 13 of 32 facts, B10 the shuffled scene scored the same): this arm gets the second end WITHOUT a scene.

## 0. What is registered, what is spent

- **What the hyperlexicon store holds for kin terms (measured before the arm was built; `kin-store-rows.mjs`, the store at `/Users/mlacy/hyperlexicon/v2`, HyperlexiconBin@2, 761 MiB, manifest sha256 `51ffc1acf94762862f694f15d717e2a28bbd3ce1944be8f363604895852208f6`, head `fa9add3225efd7ff…`).** The store keeps names, nine types of relation (syn, derived, coord, ant, hyper, hypo, holo, mero, diminutive-of) and translation links, and no glosses.
  Of the 26 Russian kin lemmas of `priors/kin-lexicon.json` all 26 have a node; **syn rows for 14, derived rows for 13, ant rows for 4 (жена–муж, мать–отец, тётя–a term, муж), hyper, hypo, coord, mero, holo and diminutive-of rows for 0, translation links 0. The store holds no converse row, no sex row and no generation row for any kin term** (rows file `kin-binder-gold/kin-store-rows.json`, sha256 `c0cef716…`).
  So the arm's kin table takes the relation schema and the sex from the givers' glosses the kin lexicon already reads (Wiktionary slim, sha256 `22672feb…`; the converse is the schema read from the other end), uses the store's synonym and antonym rows to CHECK a term's sex against its antonym partner (a disagreement withholds the sex: typed gap `store_disagrees`; 2 of 26 terms have an agreeing antonym row, 12 a synonym row only, 12 no row: typed gaps, never a guess),
  and uses the store for what it does hold: **whether the written forms of a ledger being are a name or a common word** (kin-store-beings: a being whose every known form is a common noun, verb or adjective, «мужа», «лицом», is not a name and cannot be a person).
- **The arm K** `scripts/kinship/kind-kin.mjs` (off by default; nothing imports it; the PR adds files and changes none). The second binder (`bind-kin2.mjs`, unchanged) is the PAGE LAYER: every end it ties is kept. K fills the ends it left as typed gaps, with NO scene and NO topic carry, by rules whose candidates are gated by an INDUCED KIND, and reads POLARITY.
  - **Kind of a being** (person, with a sex or none): (1) the store verdict above (`common` is never a person); (2) COMPANY: the words within three tokens of the being's mentions (stem: first five letters), weighted by inverse being-frequency (a word every being keeps is weightless: no stop list); the person kind is seeded by the anchors (the page layer's own tie ends and the beings carrying a patronymic) and a being belongs to it when the cosine of its company with the anchors' centroid (leave-one-out for an anchor) reaches **0.2, the kind-induction organ's own declared cut (`native/organs/kind-induction.js` DECLARED_THRESHOLD, never fit to a gold)** AND exceeds the p95 of the same cosine under SHUFFLED COMPANY
    (the (being, word) pairs permuted among the beings, 200 seeded draws: the organ's NULL falsifier); (3) sex: the vote of the being's gender-agreeing past-tense verbs, patronymic suffix and, for a holder of a page-layer tie, the term's sex; a being with votes for both sexes (a merged referent) has none.
  - **Rules** (all over the kind gate): K-SUBJ (a kin word with no marker: the nearest person-kind clause subject before it in its sentence is the possessor); K-CONV (the possessor is tied and the window's own page ties hold one fact of the converse relation with it: its other end is the holder); K-OTHER (the possessor is tied: the one other person-kind being, sex not contradicting the kin word's, named in the sentence, else the paragraph; two or more is a gap; a being of unknown sex is not excluded: the lenient sex gate). Statements inside speech are left as typed gaps.
  - **Polarity, READ from a giver, never typed.** `polarity-lexicon.mjs` reads the cues from the Wiktionary slim by anchor phrases on the first gloss (the one declared list of this work, filed as a candidate class as `kin-lexicon.mjs` files its atoms): 25 negation cues («не», «ни», «никогда», …), 18 existential or privative cues («нет», «нету», «без», …) and 2 'former' cues («бывший», «прежний») came out of the giver; `kin-binder-gold/polarity-lexicon-ru.json`, sha256 `8d7d1355…`.
    A kin statement is NEGATED when an existential cue stands within two words before the kin word, or a negation cue stands directly before a copula (a token the part-of-speech prior tags AUX) that precedes the kin word in its clause, or a negation cue stands directly before the kin word in its own (nominative) form, a predicate; it is FORMER when a 'former' cue stands directly before it. A negation cue before a kin word in another case negates the event, not the relation (the relation stays affirmed, the cue is recorded).
    A negated or former statement ties its ends as before and emits NO FACT.
  - **K is the REGISTERED arm; every bar below judges K.** T2 (the page layer), S3 (the scene model of scene-model-5, scored on the SAME window and gold: the comparison), KG0 (K without the kind gate) and KP0 (K reading no polarity) are reported with no bar.
- **Frozen before the window is chosen (sha256).** Janus main `a4d1b6c188265b8e9c7034dcf2715465dce03086`; the worktree's frozen commit `89fe769` on top of the scene-model PR's commits.

| file | sha256 |
|---|---|
| scripts/kinship/kind-kin.mjs (the arm) | `0a973ca7bd23e6d63e0a7e1015c4ada4e3a7f739182a5becc1ae1b8d39f5e3e8` |
| scripts/kinship/kind-kin.test.mjs (10 tests) | `9647689792282c701fe3586f293f0b72fb1545a7f73a00010ee5f70a18ea9ad8` |
| scripts/kinship/score-kind-kin.mjs (the scorer) | `0d32859bb9e40eef70a0956554a9dc6c32f1d44222cef18f87739598c5df7258` |
| scripts/kinship/validate-gold-scene2.mjs (form check with the polarity field) | `de77b3c86b72dbc0c6776812806b05a4808004e952989b3b2fad957ddcf3360c` |
| scripts/kinship/kin-store-rows.mjs, kin-store-beings.mjs, polarity-lexicon.mjs | `fac022d7a387515efe3a17313e1685eb9e2edeac689e75a1e7138ca2db55b797`, `6c36b6b82e5eadf871d3e8dbf83ed21f03b5b5d27528c18a606e6572a8dccf26`, `b3711c286cf0d39a1c8ce828936ec5cab4ee7012f1ff863f0aa4cd22f54cff4e` |
| scripts/kinship/choose-window-kind.mjs (the window rule) | `0e2fa5cfc38888eb890bbf5267b927adce26d0e51310e86c7de07b5c4d914b4e` |
| scripts/kinship/fit-kind-kin.mjs | `8ec4493e0bb250ab3184d38f8b3b1f1dbd7fa35a798b161ec8db8b274f4df5b7` |
| kin-binder-gold/LABELLING-PROTOCOL-KIND.md (the gold's lens: the scene lens of scene-model-5 plus `polarity`) | `8a230f184c20732e940f85b90edae6a09d062fffc9b4cfde948092460640ded0` |
| kin-binder-gold/LABELLING-PROMPT-KIND.md (the labeller's brief) | `9e705928e14335d83a9bd4a20a71eae44a0bab40a10740af3c8e410c067bd5d6` |
| kin-binder-gold/kin-store-rows.json, polarity-lexicon-ru.json | `c0cef716b1b08f875ef5e97bbfff504a5b27e3418fd4b1f71decf7181f94cb0e`, `8d7d1355b5d35ecf2d3a577a7082e2afa70b5bcb86402b24ae1dd97fe23927d1` |
| kin-binder-gold/kin-store-beings-{dev, heldout, window2, window3}.json (the fit windows' store verdicts) | `7b60173a…`, `27c1fccd…`, `0e24ea02…`, `d635b80f…` |
| scene-kin.mjs, score-scene-kin.mjs, bind-kin2.mjs, bind-kin.mjs, extract-kin.mjs, native/organs/kinship.js (as in PREREG-SCENE-MODEL.md; the arm imports the scene model's structures only, no scene) | `e387926d…`, `74e6bc1b…`, `b4703c99…`, `da075991…`, `a4f776bb…`, `6f4b5131…` |

  The reader: khora `30fe444dfecdd6f6e1a32018047eee9d8291514b` (as in PREREG-SCENE-MODEL.md), priors from this repository, the full text `voyna-i-mir_Tolstoy_wikisource_full.txt` sha256 `b2afb2bd979b9ad84ab4534c34dcf0206321d28fc3bc00d95c6492d7b7b723d9`. The scoring path reads only files (the derived rows above and the window's own store verdicts, hashed in an addendum); it does not open the store.

- **THE FIT SET (SPENT) AND WHAT WAS DONE TO THE ARM LOOKING AT IT.** Four spent windows: chapters I to IV, V to VIII, full-text lines 10467 to 10620 (page-lens golds of the earlier passes) and block 79, full-text lines 23441 to 23716 (the scene-lens gold of scene-model-5, the only window with a scene-lens gold). The revisions, in order: (1) the first induction of persons (a being's count of gender-agreeing mentions against the p95 of that count under shuffled mention contexts)
  kept only 8, 11, 2 and 5 beings as persons: with most beings persons the null keeps the population's rate and selects the protagonists, not the persons; replaced by the organ's own company-similarity reading above (persons 13, 16, 4, 6); (2) a negation cue before the kin word was first read as negating the relation in every case, and read «прельщала не мужа» (an event negation) as a negated husband; the scope rules above came from that; (3) the sex gate lenient against strict was chosen by the fit's facts (lenient: 17 facts, 10 right; strict: 10 facts, 5 right).
  **Fit numbers are not evidence.** Ends bound / correct over the unbound statements (golds as above; "wrong where gold null" counted wrong):

| window | T2 (page layer) | S3 (scene model) | **K (registered)** | KG0 (no kind gate) |
|---|---|---|---|---|
| chapters I to IV | 14 / 13 | 26 / 17 (facts 8, right 4) | 19 / 15 (facts 7, right 4) | 20 / 16 |
| chapters V to VIII | 13 / 12 | 36 / 21 (facts 8, right 2) | 14 / 12 (facts 0) | 19 / 14 |
| lines 10467 to 10620 | 0 / 0 | 35 / 20 (facts 2, right 0) | 0 / 0 | 12 / 2 |
| lines 23441 to 23716 | 17 / 14 | 121 / 78 (facts 32, right 13) | 58 / 45 (facts 10, right 6) | 70 / 46 (facts 18, right 4) |
| pooled | 44 / 39 (0.886) | 218 / 136 (0.624; facts 50, right 19) | **91 / 72 (0.791; facts 17, right 10)** | 121 / 78 (0.645; facts 31, right 8) |

  **PREDICTIONS, registered and not bars:** B1 and B2 pass on a window whose ledger holds its people (the fit's K is more precise than S3 and far less complete: 72 correct ends against S3's 136); on a window whose ledger lacks the protagonist (lines 10467 to 10620: 4 of 52 beings are persons, K ties nothing) K ties nothing; B3 is at the edge (fit facts 10 right of 17, 0.59, at risk on a small count);
  **B10 fails** (K-SUBJ does most of the work and its ties are page-level; a shuffled kind roster still finds a few persons that are subjects, whose precision on few ties is high: the same shape as the scene model's control); B11 is unassessed (few negations); the kind gate adds precision at the cost of ties (KG0 on the fit: 0.645 against K's 0.791).
  The arm is registered anyway: the direction is the user's, the arm is the one the direction describes, and the doctrine is to score it once on a window nobody has read and report every bar.

## 1. Definitions (those of PREREG-SCENE-MODEL.md section 1, with one addition to the lens)

Statement, holder, possessor, being, mention, bound end, typed gap, fact, the SCENE-lens gold: as there. **The gold is a SCENE-lens opinion with a POLARITY field** (`LABELLING-PROTOCOL-KIND.md`): the lens of scene-model-5 unchanged, so the golds are comparable, plus, for every statement, whether the text asserts the relation as holding: `affirmed`, `negated`, `former` or `other`.
**The labeller is a separate model context** given the protocol, the window's text with numbered paragraphs, the statements and the reader's beings, and nothing else; it never sees any arm, any binder, its output, the store or the window's place in the novel. The author of the arm and the labeller are different contexts of one model family: declared. The gold is an opinion: never evidence, never licensing, supersedable.

## 2. The window, chosen by this rule, written before any count

Blocks of four consecutive chapter headings (lines `^\s*[IVXLC]+\.\s*$`), non-overlapping, in file order from the first heading at or after full-text line 1895 (the series of PREREG-KIN-BINDER-2 section 0; blocks 1 to 27 and 79 are spent). **R1:** the first block from block 80 on for which the plain extractor (`extract-kin.mjs`, unchanged, ru) finds at least 40 statements AND at least one of category A.
**R2, applied only if R1 finds no block:** the first block from block 28 on, other than block 79, with at least 40 statements (no category-A floor); blocks 28 to 78 have had two counts computed and no statement read by anyone. Only counts are computed to choose (`choose-window-kind.mjs`); no statement, sentence or name of a candidate block is read.
The rule applied and the block's byte range and counts are filed in an addendum before its ledger is made. If R2 finds no block either, no scoring is done and the result entry says so.

## 3. Order

(1) this file is hashed and its hash filed in the pipeline log; (2) the window is chosen by the rule and filed in addendum 1; (3) its ledger is made by the reader twice and hashed, its beings' store verdicts are made by `kin-store-beings.mjs` and hashed, the labelling pack is made — the author reads none of them;
(4) the labeller context makes the gold from the pack alone; the author runs the structural validator (`validate-gold-scene2.mjs`) and hands form problems back; `quoteAt` is filled mechanically; the gold is hashed and filed in addendum 2 before any score; (5) the scorer runs ONCE (K, S3, T2, plain, ablations and controls on the same window and gold);
(6) every bar is reported whichever way it falls, with the ceiling if it fails. A bug found after (1) is fixed only by an amendment hashed before (5). Nothing is fed to the English composer or to any answer.

## 4. Arms, controls and bars (judged on the fresh window; all judge K; the unbound statements = extractor category not A)

Controls over the ends K binds on the unbound statements, seed 20261029, 1000 draws: **C1** chance in the paragraph-and-one-before pool; **C2** deranged ends; **C1K** chance among the person-kind beings (the induced roster: stricter than C1); **C3** swapped ends (the mutant); **SK** the shuffled-KIND control: the induced kind records permuted among the beings (the multiset kept), the same rules and gates applied.

- **B1** K's end precision over the unbound statements is strictly above the largest p95 of C1, C2 and C1K AND at least 2/3. Unassessed if K binds fewer than 10 ends or a null's p95 is 1.
- **B2** K's correct ends over ALL statements exceed the plain arm's, AND K's recall (correct ends / gold-bound ends over the unbound statements) is strictly above C1K's recall p95. Unassessed with fewer than 10 gold-bound ends.
- **B3** Of K's facts over the unbound statements, the share with both ends right is at least 1/2 and strictly above the largest p95 of the three nulls' fact precision, AND K's correct two-ended facts over ALL statements exceed the plain arm's. Unassessed with fewer than 3 facts or a null p95 of 1.
- **B4** every emitted fact is witnessed (byte span reads back, holds the kin word and both ends), giver `text:ru|rule:...`, standing `candidate`, ends are ledger beings: 100 percent.
- **B5** determinism: the scorer's result identical in two in-process runs, the arm's output identical in two runs, and two CLI runs of `kind-kin.mjs` byte-identical.
- **B6** nothing existing changed: the PR adds files and changes none (`git diff --name-status main` all A); the test file pins the page layer, the first binder, the extractor, `kinship.js`, and the scene model and its scorer, by sha256.
- **B7** every unbound end is a typed gap (a kind of `GAP_KINDS`, a reason of the closed set `KIND_REASONS`), none silent.
- **B8** no model, no network, no typed polarity word: the test shows the arm's imports are node builtins, the kinship organ, the page layer, the scene model's structures and the extractor, the source holds no fetch, socket or process spawn and none of the polarity words as a string.
- **B9** the swapped-ends mutant (C3) falls below B1's threshold. Unassessed with fewer than 3 mutant ends.
- **B10** the shuffled-kind control: K's precision is strictly above SK's p95 AND K's correct ends are strictly above SK's p95 of correct ends. Unassessed if K binds fewer than 10 ends or no kind-roster permutation exists.
- **B11** polarity read: if the gold calls at least 3 statements not affirmed and K reads at least 3 not affirmed: at least half of the gold's not-affirmed statements are read not affirmed, at least 2/3 of K's not-affirmed readings are gold not affirmed, and K emits no fact on a gold not-affirmed statement. Otherwise unassessed.
- **"CLEARED"** is said only if B1, B2, B3 and B10 pass, B11 passes or is unassessed with the reason stated, and B4 to B9 pass. A bar that is unassessed is not a pass.
- **Reported with no threshold:** every arm's ends bound, correct, wrong, precision, recall, facts (T2, S3, K, KG0, KP0, plain); K beside S3 on the same window and gold (does a scene-free arm tie more precisely, at what recall); K's ends by rule, by gold kind and by gold direction; the typed gaps by reason; the induced kinds (beings, persons, by store verdict, with a sex); the store's coverage of the kin table; the polarity labels against the readings; the ceiling.

## 5. What each outcome means

B1 to B3 and B10 passing says polarity-aware kinds over the hyperlexicon tie kin ends precisely enough to file as candidates on a window nobody had read, and that the induced kind, not the rules alone, does it; it does not say they are many. B1 and B2 passing with B3 failing says possessors are tied and holders are not.
B10 failing says the rules, not the kind, do the work. B11 unassessed says the window holds too few non-affirmed kin statements to say anything about polarity. K more precise than S3 at a much lower recall says the kind gate trades ties for precision. Whatever happens, the English composer and the kinship answers are not fed.

## 6. Not claimed

That a bound end is true; that the gold is right (a separate model context's opinion); that the ledger's referents are right; that the hyperlexicon holds converse, sex or generation rows for kin terms (it does not: the arm takes them from the givers' glosses and says so); that the polarity cues are complete (45 of the giver's own); that anything here changes a reading, a verdict or a weight.

## 7. Falsifying control

A window chosen after a count other than the registered ones; a bar changed after the window was read; a gold hashed after the score; a labeller that was given the arm's code or output; a name list, a typed polarity word or a model call in the scoring path; a result whose scorer or arm output differs on a second run.
