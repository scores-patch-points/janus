# RESULTS SCENE-MODEL — the scene model on the fresh window, scored once

Written after the run. PREREG-SCENE-MODEL.md (sha256 `fa83087fc055ad40e0f610fedce3539ec57bdf945b01cd12d507dab551e95e8b`), its addendum 1 (the window, chosen by the registered rule; sha256 `e6d8ec1c62a020fb26ac514d921c23db4b75e20a4032e1c2e41ca06d121119dd`) and addendum 2 (the gold; sha256 `f64e3bdba7eb2e307da41e0b9c7b0925b8d7754563d37e6974515b9f084f99b1`) were sealed before it;
nothing in the model, the scorer or the gold changed after (code frozen at commit 37769db: scene-kin.mjs `e387926d…`, score-scene-kin.mjs `74e6bc1b…`). The gold (`gold-scene-window3.json`, sha256 `770373cbbfab6f9cf83d32d2056001abfb41929da6cb9f12e38dbe49505cb694`) is a self:model opinion made by a separate model context. Every number is read from `kin-binder-gold/results-scene-window3.json` (sha256 `12291cc11975a5c976c2eca386cf61dde7e5f23d365412cd9cb43989b909a4da`). No model is called by the scene model or the scorer.

## Headline

- **The registered scene model does NOT clear its bars.** B1 FAIL, B3 FAIL, B10 FAIL; B2, B4, B5, B6, B7, B8, B9 pass. "CLEARED" is not said. Nothing is fed to the composer or to any answer.
- **B1 misses by three ends.** S3 ties 121 ends on the 107 unbound statements and 78 are right: precision 0.645 against the declared 2/3 (81 right of 121 would have been 0.669). It is far above all three chance controls (p95 0.394, 0.355, 0.246) and above the second binder (T2: 17 ends, 14 right, 0.824, recall 0.084), so the ties are not chance; they are not precise enough.
- **The scene does nothing.** The shuffled-scene control (every paragraph given the scene state of a paragraph of another scene) scores a mean precision of 0.642 and 76.1 correct ends (p95 0.669 and 79); the real model has 0.645 and 78. **B10 FAIL.** The paragraph-only variant A0 (the same rules with the scene cut to the paragraph and the one before) ties 119 ends, 77 right (0.647), against S3's 121 and 78. The ties are made by the page-level rules (the clause subject in the kin word's own sentence, the reflexive, the pronoun); the scene adds one correct end.
- **Two-ended facts: 32 emitted, 13 right (0.406; bar 0.5).** B3 FAIL, though 13 is more than the plain arm's 0 and fact precision is above all three nulls (p95 0.217, 0.217, 0.154). Every emitted fact but two takes its holder from S-OTHER (the one other person of the sentence or paragraph), which is right on 14 of 30 ends.
- **The ceiling the window shows.** The labeller (a separate context) names a being for 167 of 216 ends and finds both ends named in the scene for **70 of 108 statements** (38 with no forward reference); the plain extractor ties both ends of 1 statement and gets it wrong against this gold (the statement's holder is a list, the possessor a subject named elsewhere); the scene model's correct two-ended facts are **13 of the 70**.

## The window

Chosen by the registered rule: block 79, full-text lines 23441 to 23716, 60,716 bytes, headings VIII to XI, 134 narrative paragraphs, 108 statements (plain categories N 99, H 4, P 4, A 1). The reader's ledger has 45 beings (172 referents; some beings are not persons: faces such as «мужа», «лицом», «пьер удивился», «что́»; the most-mentioned referents are Наташей 55, «пьер удивился» 35, «мужа» 33, Николай 32).
The gold: 17 scenes; of 216 ends 167 bound (subject 50, scene 44, discourse 43, pronoun 16, reflexive 11, apposition 2, deictic 1; the identifying mention stands before the kin word for 69, in its sentence for 66, only later in the scene for 32) and 49 null (unnamed 24, generic 18, not_in_ledger 7); 14 ends flagged doubtful.

## Arms (ends over the 107 unbound statements; the gold binds 166 of their ends)

| arm | ends bound | right | precision | recall | facts | facts right |
|---|---|---|---|---|---|---|
| PLAIN (category A only; over all 108: 2 ends, 0 right, 1 fact, 0 right) | 0 | 0 | — | 0 | 0 | 0 |
| T2 (the second binder, the page layer) | 17 | 14 | 0.824 | 0.084 | 0 | 0 |
| S1 (+ S-PRON) | 17 | 14 | 0.824 | 0.084 | 0 | 0 |
| S2 (+ S-SUBJ, S-TOPIC) | 91 | 64 | 0.703 | 0.386 | 2 | 0 |
| **S3 (registered: + K-KNOWN, S-OTHER)** | **121** | **78** | **0.645** | **0.470** | **32** | **13** |
| A0 (S3's rules, scene cut to paragraph + 1) | 119 | 77 | 0.647 | 0.464 | 31 | 13 |

Controls (over the 121 ends S3 binds; seed 20261028, 1000 draws): C1 chance in the paragraph-and-one-before pool: precision mean 0.334, p95 0.394, recall p95 0.259, fact precision p95 0.217; C2 deranged ends: precision p95 0.355, fact precision p95 0.217; C1S chance in the scene pool: precision p95 0.246, recall p95 0.169, fact precision p95 0.154;
C3 swapped ends: 11 of 121 right (0.091); SC shuffled scene: precision mean 0.642, p95 0.669, max 0.690; correct ends mean 76.1, p95 79, max 82; fact precision p95 0.419.

## Bars (as registered)

| bar | result | numbers |
|---|---|---|
| B1 end precision above the three chance controls and 2/3 | **FAIL** | 0.645; null p95 0.394 (passes); budget 0.667 (misses); 121 bound |
| B2 more correct ends than the plain arm, recall above the scene-pool chance | **PASS** | 78 against 0 (over all statements); recall 0.470 against C1S p95 0.169; 166 gold-bound |
| B3 fact precision at least 1/2, above the nulls, more correct facts than plain | **FAIL** | 13 of 32 (0.406); null p95 0.217; correct facts 13 against 0 |
| B4 every fact witnessed, giver text:ru\|rule:…, candidate, ledger beings | **PASS** | 32 of 32 on each of the four checks |
| B5 determinism | **PASS** | scorer twice identical (sha256 343e0c4a…); model twice identical (1f3e7a96…); two CLI runs of scene-kin.mjs byte-identical (sha256 24353897…) |
| B6 nothing existing changed | **PASS** | the branch adds 21 files and changes none (`git diff --name-status 1a02f3c HEAD`: all A); the test file pins bind-kin2.mjs, bind-kin.mjs, score-kin-binder2.mjs, extract-kin.mjs and kinship.js by sha256 |
| B7 every unbound end a typed gap | **PASS** | 95 gaps, all of a kind of kinship.js and a reason of the closed set; 108 of 108 statements' gaps match their unbound ends |
| B8 no model, no network, no list | **PASS** | the test shows the imports are node builtins, kinship.js, bind-kin2.mjs and the extractor; no fetch, socket or process spawn |
| B9 the swapped-ends mutant falls below the threshold | **PASS** | C3 0.091 against 0.667 |
| B10 the shuffled-scene control is beaten | **FAIL** | precision 0.645 against SC p95 0.669; correct ends 78 against SC p95 79 |

Repository checks (janus has no CI workflows): every `*.test.mjs` with `node --test`: 27 files, 247 tests, 247 pass, 0 fail (the branch adds the 15 tests of `scene-kin.test.mjs`).

## What reached which ends (S3, over the unbound statements)

| rule | ends bound | right |
|---|---|---|
| S-SUBJ (the clause subject before the kin word) | 42 | 35 (0.83) |
| P-REFL, P-PRON3 (the page layer) | 10, 5 | 9, 5 |
| H-APP-LEFT (the page layer) | 2 | 0 |
| S-TOPIC (the scene's topic) | 32 | 15 (0.47) |
| S-OTHER (the other person of the sentence or paragraph) | 30 | 14 (0.47) |
| K-KNOWN, S-PRON | 0, 0 | — |

By the gold's licence kind (gold-bound ends, S3 right): subject 49 (30), discourse 43 (23), **scene 44 (1)**, pronoun 16 (13), reflexive 11 (9), apposition 2 (2), deictic 1 (0). By where the identifying mention stands: same sentence 65 (44), before 69 (25), **only later in the scene 32 (9)**.
The typed gaps S3 leaves (95): no holder candidate 46 (the gold names one for 32 of them), no marker 19 (16), no topic 9 (7), holder ambiguous 9 (5), kin word inside speech 8 (7), apposition or genitive left to the page layer 2.
The labelled scene breaks against the mechanical ones (reported, not barred): 43 mechanical scenes against 17 labelled; of 42 mechanical breaks 8 are exactly a labelled break and 16 are within one paragraph of one; of 16 labelled breaks 8 are exactly mechanical and 12 within one paragraph.

## Reading it

1. **The model is a clause-subject reader, not a scene reader.** The correct ties are the kin word's own sentence (S-SUBJ 35 of 42, the reflexive and the pronoun of the page layer). S-TOPIC, the one rule that reads the scene state, is right 15 times in 32 and S-OTHER 14 in 30 (29 in 62 together), and shuffling the scene leaves the model's precision where it is. The gold's `scene` kind (a being named in another paragraph of the scene, 44 ends, a quarter of everything the labeller bound) is reached once.
   The registered prediction held on the points it made: B1 failed, B3 failed, the scene added nothing over the paragraph (77 of 119 against 78 of 121). It missed on two: B10 failed (the fit set had no shuffled control; in a small cast a random topic is often a plausible one: SC precision 0.642), and the holder rule S-OTHER was right 14 of 30 here against 1 of 13 on the fit set, because the scene-lens gold credits holders the page-lens golds called unnamed.
2. **A scene-level reading would have a great deal to tie.** The labeller finds both ends nameable from the scene for 70 of 108 statements and 167 of 216 ends; the best any rule here does is 13 two-ended facts right. 32 of the 167 bound ends need text after the kin word, which a backward-reading rule cannot reach; 44 are named in another paragraph of the scene; the others are tied by a marker, a subject or a mention in the kin word's own paragraph or turn.
3. **The ledger is a second ceiling.** The reader's beings include non-persons (a verb phrase, a kin word, «лицом») and merge people; 7 gold ends are `not_in_ledger`, 14 flagged `doubtful`, 7 of S3's ties fall on a doubtful gold end. A scene model reads the ledger's beings; an identity layer that does not hold the people cannot be repaired from above.
4. **The mechanical scene is not the labelled scene.** 43 against 17; participants-only continuity with a derived memory of three paragraphs breaks a scene wherever the cast turns over and has no signal for place, so it cuts where a reader does not (8 of 42 cuts exact).

### Not registered, not a pass (post-hoc, read after the score)

The page layer plus S-SUBJ alone (S3 without S-TOPIC and S-OTHER) ties 59 ends of which 49 are right (0.83) and S2 clears B1's numeric test (0.703 above 0.667 and above all nulls), but S2 ties 2 facts and none is right: a precise binder of possessors with no holders. A rule chosen after seeing a score cannot count as passing; it would need its own registration and a window nobody has read, and none is started.
What the scene gold says a model that passed would need: a cross-paragraph rule for the 44 `scene` ends and a holder rule that can name the other end of a stated relation (the S-OTHER ties are right on 14 of 30), on a ledger whose beings are people.

## Not claimed

That a tied end is true; that the gold is right (one separate model context's opinion, generous: it binds 167 of 216 ends; a stricter labeller would lower every recall and could move precision either way); that the ledger's referents are right; that the mechanical scenes are the novel's; that a different scene model would not do better; that anything here changes a reading, a verdict or a weight.
