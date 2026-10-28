# PREREG KIN-BINDER — a binder from the kin word of a quoted sentence to the beings at its two ends (G1-2, derivation side)

Written 2026-10-28 by the kin-binder session (a model, `self:model:claude-sonnet-5-5`), BEFORE the held-out gold was made, before any held-out
statement was read, and before any bar below was scored on the held-out window. Plain arm and shuffled controls beside every claim. No model is
called by the binder or the scorer; the only model in this work is the labeller of the gold, and its labels are an opinion, filed as one.

## 0. What is registered, what is spent

- **Question.** The plain extractor (`scripts/kinship/extract-kin.mjs`, unchanged) finds a kin word in the Russian text but ties a statement into a
  fact only when both its ends are names the reader tied to beings (category A). The rest are unbound (log claude-ring-67: the kin words of the
  quoted sentences that the models' replies use beyond the plain answer). Can a rule family, with no model, tie the unbound ones, and at what
  precision, leaving the rest as typed gaps?
- **Development window (SPENT).** `voyna-i-mir_Tolstoy_wikisource.txt` (chapters I to IV), sha256 `1b298906182db57b9c9435beff1882442e992786ac926cf70d3163461b7ec3f1`. 37 statements: A 2, H 1, P 5, N 29
  (35 unbound). The rules were developed on it by reading its statements; its gold (`kin-binder-gold/gold-dev.json`) was filed before the rules
  were finished and is used for development. Dev numbers are optimistic by construction and are not evidence.
- **Held-out window (FRESH).** `heldout-text.txt` (chapters V to VIII), sha256 `55ab82f0272dcb8abb9e6c8eaec884cc690957ddb9457a362b7b8bbf603fc232`. The extractor finds 58 statements (A 1, H 5, P 8, N 44;
  57 unbound): only those COUNTS were read (from the fold's own summary) before this file was hashed; no held-out statement, sentence or kin
  word was read, no binder output was produced for it, and no gold exists for it yet. The held-out ledger (the reader's output, 63 beings, ids
  identical to the fold's) was produced and hashed here, and not inspected beyond its counts.
- **Frozen before scoring (sha256).**

| file | sha256 |
|---|---|
| scripts/kinship/bind-kin.mjs (the binder) | `da075991f427d4483990b1a6a1bdd0ac84ab7465c834e4a4dc0452b73c540f72` |
| scripts/kinship/score-kin-binder.mjs (the scorer) | `ba300f9b3631da7c89c5c1475cb55b24662af5ee20fd248146842fbed84e8979` |
| scripts/kinship/dump-ledger.mjs | `c9baadb8e6700d52621b3550ae1912404e5e5b1008324827b442c38fccb2d485` |
| scripts/kinship/build-person-lexicon.mjs | `c529243a992df07dda1c383d008df3ec2878322f286b8312ff636806db57fa8a` |
| scripts/kinship/bind-kin.test.mjs | `36fa9507d38833301bc1dd2ca547104d0adf6ce3ca6da4710e0309cd0e6e3cae` |
| priors/person-lexicon-ru.json (built from the Wiktionary slim, manifest sha256 22672feb9f6e892b65b4f7cb8b6c32da59ce67702bb793ed916f3b3b2e927dc5) | `0731e331ae6e54b5c50eb08f182cd3b676d090eeed0b65b7c418b8c2220b3fde` |
| scripts/kinship/kin-binder-gold/LABELLING-PROTOCOL.md (the gold's lens) | `11adf157edd840183af566173b6cbddd8e08f69f396a4eae72be1b1521f02611` |
| scripts/kinship/kin-binder-gold/gold-dev.json | `cae538d7410cdec88e6d134ef76171aa0e16c4986fb7d2d9fd540677b2164e32` |
| scripts/kinship/kin-binder-gold/ledger-dev.json (khora 30fe444d readDocument, janus 9fe6d918 priors) | `1f013ccc2f7e62a513b370192ee060d1e14a7834a38d1e3ba8792e337d93daf4` |
| scripts/kinship/kin-binder-gold/ledger-heldout.json (same reader and options) | `2d4f34c5aa26dd8f00c03dde730dd985c9b8e65b2bda4f2534ea56c8e2e81f68` |
| scripts/kinship/extract-kin.mjs (unchanged from main) | `a4f776bbadd6381f8ed1890804cac77c8b23b96e7a6d4eea222ac20514d766e4` |
| native/organs/kinship.js (unchanged from main) | `6f4b5131d9d267fb537b0104062f0acdb17f5bb9026b148c2894fce7156eb4ba` |
| priors/kin-lexicon.json, pos-rus.json, pronoun-ru.json, name-parts-ru.json (unchanged from main) | `693f23772d76fb5d582b76db7d5b40d88803eaa91cb47cf05a54b958a59a1737`, `92bc492f49c846a0c749f577d47723e105a26ce3b7b71cbb522c73abd80093d3`, `8b96b59ebb27843c457e17fb0da549844740d74d380a8f6db1304b43a6b0ac61`, `96aae932beec3609a71d3e3e6214bcd43a3259e51f1d10a31889375992ba09c6` |

  Code frozen at janus commit e8c762ee8528ecc94a9851d51d993a73a49b643d on branch `kin-binder` (the files above are its blobs); base: janus `origin/main` 9fe6d918858fc64f59c18d064632504713f37830; the reader: khora 30fe444dfecdd6f6e1a32018047eee9d8291514b
  (the commit the foldcode experiments used), options `{language:'ru', minCharacters:0, referents:true, declension:true, lexicon:false}`.
- **Order.** (1) this file is hashed and the hash filed in the pipeline log; (2) the held-out gold is made by reading the held-out statements under
  the protocol (no binder output seen), filed in the repo with holder, lens and quoted span, and ITS hash filed in an addendum; (3) the scorer is
  run on the held-out window ONCE; (4) every bar is reported whichever way it falls. A bug found after (1) is fixed only by an amendment hashed
  before the held-out run, naming the bug; a bug found after (3) is reported, not fixed in place.

## 1. Definitions

- **Statement.** One kin word found by the extractor, at its byte span. **Ends.** HOLDER = the being the kin word names (the son in «сын князя Василия»);
  POSSESSOR = whose kin. A **being** is a ledger referent of standing `referent`; a **mention** is a ledger name span of a being (the longest of any
  overlap). The ends are identified by the mention that names them, so an identity error of the reader (two referents for one person) is not charged
  to the binder; the labeller flags it `doubtful`.
- **Gold.** One record per extractor statement (A, P, H and N), made by the labeller under `LABELLING-PROTOCOL.md`: for each end the ledger referent a careful
  reader of the statement's sentence, turn or paragraph (and for a pronoun the sentence before) can name, with the quoted span and how the end is
  licensed (`apposition`, `genitive`, `pronoun`, `reflexive`, `deictic`, `subject`, `discourse`), or `null` with why (`generic`, `unnamed`,
  `not_in_ledger`). **The gold is a self:model opinion** (holder `self:model:claude-sonnet-5-5`, lens = the protocol's sha256); the labeller is the
  binder's author. Every number in this work is measured against that opinion, not a giver, and says so.
- **Bound end** (binder): an end with a ledger referent and a named rule. **Typed gap**: an end with no referent: `{kind, slot, why}` where `kind` is a
  gap kind of `native/organs/kinship.js` (`no_parent_fact`, `no_sibling_fact`, `no_spouse_fact`, or `no_rule_giver` for a stated composite) and `why` one
  of a closed set (`no_marker`, `genitive_or_apposition`, `speaker_not_named`, `addressee_not_named`, `antecedent_ambiguous`, `antecedent_absent`,
  `antecedent_not_searched`, `pronoun_in_speech`, `plural_possessive`, `name_not_a_referent`, `one_referent_both_ends`). A gap kinship.js can take an opinion for carries
  the unchanged `opinionSlot`; a stated composite carries none and says why.
- **Fact** (binder): a statement with both ends bound to different beings, emitted as fact specs `{rel, a, b, giver:'text:ru|rule:<rules>', witness:'ru#from-to', standing:'candidate'}`
  (the relation and direction as `measure-kin.mjs` writes them, plus the holder's sex when the kin word carries one).

## 2. The binder (what is frozen: `bind-kin.mjs`; the rules in prose)

Inputs: the text, the reader's ledger (spans and referents), the plain extractor's statements, and four givers: the kin lexicon (Wiktionary), the part-of-speech
prior (UD Russian-GSD), the third-person pronoun prior with gender (UD), the person lexicon built from Wiktionary glosses by `build-person-lexicon.mjs` (a possessive
or personal pronoun is admitted only if its first gloss opens with an anchor word: my/your/our/his/her/their/one's own/I/we/you; the one declared list there, a candidate class audited by the giver's gloss), and the extractor's own patronymic classes (a
patronymic carries a sex). Declared plain-arm parameters (not tuned except where noted): MAX_MOD 2, MAX_DET_GAP 3, MAX_APPOS_MOD 3, VOCATIVE_MAX_MODS 1
(1 chosen on development: with 2 the apposition «une princesse Болконская» read as a vocative).

Tier 1 (a marker on the page):
- **H-APP-LEFT** a being's name, a comma or dash, the kin word: holder = the name. **P-GEN** the kin word in its lemma form, then a name (up to MAX_MOD lower-case words
  between, no `. ; : ! ?`): possessor = the name. **H-APP2** after that name a comma, up to MAX_APPOS_MOD words and another being: holder = the second name; an oblique kin word followed by one name and nothing
  else is `genitive_or_apposition` for both ends. **H-APP-DET** a possessive (person lexicon) before the kin word (up to MAX_DET_GAP words, no name, noun, verb or preposition between) or just after it, then a name: holder = the name,
  possessor = the possessive's referent: **P-VOC** (second person; in a spoken turn the one being named in a vocative fragment of the turn, a fragment of at most VOCATIVE_MAX_MODS words besides one name between commas, else the being the turn's
  attribution addresses; none or two is a gap), **P-SPEAKER** (first person; the being that is the first name after the verb of the turn's attribution, a pronoun or a bare title is a gap).
  Dialogue structure: a paragraph is a line; a dialogue paragraph opens with a dash; it is cut at « — »; a lower-case part after speech is the attribution.
Tier 2 (an antecedent is searched; the registered binder is tier 2, tier 1 is its ablation):
- **P-PRON3** a third-person possessive in narrative (not in speech): the antecedent is the one gender-compatible being of the nearest sentence that has one (same sentence, else the previous sentence of the paragraph,
  else the previous paragraph); two beings in that sentence is `antecedent_ambiguous`; gender is known only from a patronymic. **P-REFL** «свой» likewise. **P-SUBJ** a bare kin word (no possessive, no name after it) in narrative: the nearest being before it in the same
  sentence with no `. ; : ! ?` between, never the holder. **H-PRED** a personal pronoun directly before the kin word in its lemma form («Он сын ...»): the pronoun's referent by the rules above.
- A statement whose ends come out the same being keeps the holder and gaps the possessor.

NOT in the binder (and so typed gaps, with the reason that names it): a speaker or addressee who is a pronoun, a bare title («сказал князь») or the previous turn's speaker (dialogue turn-taking is the speech reader's family, ring-67 item 2);
a description that names no one («муж маленькой княгини»); a being named only in an earlier paragraph; the case of a name (the case prior is 2-letter endings and too weak to decide apposition from genitive: it is not used);
a UD parse (the Russian parser model is not in the repository, so it is not available here and is not used).

## 3. Arms and controls

Scored over (a) the unbound statements (extractor category not A: the target) and (b) all statements. End-level and fact-level (both ends).
- **PLAIN**: the extractor's category A statements tied to the ledger as the foldcode build does (the name that ends nearest before the kin word, the name that begins nearest after it); on the unbound statements it ties nothing by construction.
- **T1**, **T2** (the binder). **C1 chance-in-pool**: the ends T2 binds (same coverage), drawn uniformly (seed 20261027, 1000 draws) from the beings named in the statement's paragraph or the paragraph before.
  **C2 deranged**: T2's referents permuted among its bound ends of the same kind (1000 draws). **C3 swapped**: T2's holder and possessor exchanged (the mutant: it must fail B1's threshold).
- Null p95 = the 95th percentile of the 1000 draws (the index `ceil(0.95 n) - 1` of the sorted draws, as `measure-kin.mjs` does).

## 4. Bars (judged on the held-out window; each reported pass, fail or unassessed)

- **B1 end precision.** T2's correct bound ends / bound ends over the unbound statements is strictly above the larger of C1's and C2's precision p95 AND at least 2/3 (the declared budget: at most one wrong end in three; a candidate
  fact is not a given, but a binding wrong more than a third of the time is noise). Unassessed if T2 binds fewer than 10 ends or a null's p95 is 1.
- **B2 gain over plain.** T2's correct ends over ALL statements exceed the plain arm's, AND T2's recall (correct ends / gold-bound ends over the unbound statements) is strictly above C1's recall p95. Unassessed if the unbound statements have fewer than 10 gold-bound ends.
- **B3 fact precision.** Of T2's facts over the unbound statements, the share with both ends right is at least 1/2 and strictly above both nulls' fact-precision p95. Unassessed with fewer than 3 facts or a null p95 of 1.
- **B4 witness.** Every emitted fact: the witness byte span reads back from the pinned text and contains the kin word and both ends' mentions; giver matches `text:ru|rule:...`; standing `candidate`; both ends are ledger beings. 100 percent.
- **B5 determinism.** The scorer's whole result is identical in two runs inside one process, and two CLI runs of `bind-kin.mjs` on the window give byte-identical files (sha256 equal).
- **B6 default behaviour byte-identical.** `extract-kin.mjs`, `kin-lexicon.mjs`, `measure-kin.mjs`, `native/organs/kinship.js` and `priors/kin-lexicon.json` have the sha256 of main 9fe6d918 (pinned in the test file) and `git diff --stat origin/main` shows only added files; nothing imports `bind-kin.mjs`.
- **B7 typed gaps.** Every unbound end of every statement is a gap with a kind in `GAP_KINDS` and a reason in the closed set; the gap count equals the unbound-end count; none silent. 100 percent.
- **B8 no model; seam unchanged.** `bind-kin.mjs` imports only node builtins, `kinship.js` and the extractor, no network, no model; a gap's `opinionSlot` is accepted by the unchanged `fileOpinion`, and filing an opinion changes nothing in the binder's output (the test file).
- **B9 control seen firing.** C3 (swapped ends) falls below B1's threshold, so B1 can fail. (C1 and C2 are the registered nulls; a null whose p95 is 1 makes the bar unassessed.)
- **Reported with no threshold:** T1 beside T2; correct and bound ends by rule; recall by the gold's licence kind (what a rule can reach: `discourse` and unnamed ends are not reachable); the typed gaps by reason and how many of them the gold says were reachable (`gold_bound`) versus honestly unnamed; the
  statements plain, T1, T2 tie; the premise ledger's kinship rows rerun with the binder's candidates (`premise-ledger.md`: how many of the 24 questions move).

## 5. Development result at the freeze (SPENT; the rules were fit to it; not evidence)

Over the 35 unbound statements (gold-bound ends 37): PLAIN ties 0 ends; T1 binds 10 ends, 9 right (precision 0.900, recall 0.243); T2 binds 17, 16 right (precision 0.941, recall 0.432), 3 facts of 9 possible.

Nulls: C1 precision p95 0.471, recall p95 0.216; C2 precision p95 0.412; C3 swapped-ends precision 0.000. Bars on development: B1 pass, B2 pass, B3 pass, B4 pass, B7 pass, B9a pass. The development scorer run was byte-identical twice (true).

The plain arm reproduces the foldcode build's own facts on this window (cross-check: {"fold_text_facts":2,"mine":2,"equal":true}).

## 6. Not claimed

That a binding is true (it is a candidate); that the gold is right (it is one reader's opinion and the binder's author's); that the ledger's referents are right (identity errors are flagged `doubtful`, not fixed); that the binder reads dialogue (speakers who are pronouns or titles, and turn-taking, are gaps);
that tier 2's discourse rules generalise beyond the two windows; that anything here changes a reading, a verdict or a weight. A model's opinion is filed beside the binder's output, never inside it.

## 7. Falsifying control

The held-out result beside C1, C2 and C3 and the plain arm. B1 failing means the rules bind more wrongly than the declared budget or than chance in the same pool: the binder is not to be used as it stands, whatever its recall. A null whose p95 is 1 makes a bar unassessed and says the window cannot separate it. A mutant (C3) that does not fall below the threshold falsifies B1 as a bar.
