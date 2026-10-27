# PREREG G1-2 — a recorded derivation answers "who is X's uncle?", with one seam for an auditable opinion

Written 2026-10-27 by the G1-2 derivation owner (a subagent of the coordinating session), BEFORE any bar below was scored and before
any text outside the development slices was read. Plain arm only. No model is called anywhere in this work.

## 0. What is registered, and what is spent

- Question class (one): `uncle(X)` = the males who are a sibling of a parent of X (the giver's own definition of "uncle", wiktionary-en:
  "The brother or brother-in-law of one's parent."). The in-law alternative is NOT evaluated: the giver's gloss for "brother-in-law" is a stub
  ("A male relative of one's generation, separated by one degree of marriage:"), so the rule carries the typed gap `alternative_not_atomic`.
- Development slices (SPENT, read while building the extractor): Russian full text characters [0, 43427) (chapters I to IV, the 74 KB excerpt
  re-found inside the full text); English (Maude, pg2600) characters [0, 36680) (chapters I to III). Everything after is FRESH and unread.
- Texts: Russian `b2afb2bd979b9ad84ab4534c34dcf0206321d28fc3bc00d95c6492d7b7b723d9` (fresh = chars [43427, end)); English Maude
  `e4bcf9042609b62c7de72a6f1b311f54c412943a9d641b7efcf79a464b5f31c8` (fresh = chars [36680, end)).
- Frozen code and data (sha256, before scoring): `scripts/extract-kin.mjs` a4f776bbadd6381f8ed1890804cac77c8b23b96e7a6d4eea222ac20514d766e4;
  `scripts/kin-lexicon.mjs` e623033954687eb60438aeece5ed2977f3112a82fdb507d1d728dc4ef8538e42; `out/kin-lexicon.json`
  4f00c96868abff581ca4d63aaef5fbc3bbff4f310c60e18b1abc793b6ad49f06 (built from the Wiktionary slim, manifest sha256
  22672feb9f6e892b65b4f7cb8b6c32da59ce67702bb793ed916f3b3b2e927dc5); janus `priors/name-parts-ru.json`
  96aae932beec3609a71d3e3e6214bcd43a3259e51f1d10a31889375992ba09c6. janus base: b1f43ecc1c29a4d45359342d5a3d08660fc2de86.
- The measurement script and the engine are written AFTER this file is hashed; the measurement script's hash is filed in an addendum before
  it touches fresh text.

## 1. Definitions

- Fact: `{rel, a, b, giver, witness, standing}`, rel in `parent_of(a is a parent of b)`, `sibling_of`, `spouse_of`, `sex(a)=male|female`,
  `term(a is the <term> of b)` for a stated composite. `giver` is non-empty; a text giver carries a byte-span witness `src#from-to` (UTF-8 offsets
  into the pinned file); `standing` is `given` or `candidate`. A fact whose giver begins `self:model` is not a fact: it is an opinion and
  goes only through the opinion seam.
- Givers in play: `text:<src>` (the narrator, a span), `name-parts-ru` (a patronymic read as a father signal; the prior calls the class
  "candidate, never a verdict": standing `candidate`), `wiktionary-en` (rule rows: a gloss is the witness).
- Rule rows: atoms (father, mother, parent, son, daughter, child, brother, sister, sibling, husband, wife, spouse; the ONE hand-declared
  list, each audited against the giver's gloss and refused if the gloss lacks its anchor phrase) and composites read by the frame
  "The A [or A'] of one's B" from the giver's first sense. Derived-sibling row (authored, standing `candidate`): sibling_of(x,y) when a
  parent is shared and x differs from y, witness: the giver's gloss of "sibling" ("A person who shares a parent").
- Name keys are NOT referents. Policy K3 = (given-name group, family-name group or empty); policy K2 = (given-name group). Groups join two
  name-like types sharing a prefix of at least 3 letters with at most 2 letters left over (plain-arm parameters in extract-kin.mjs PARAMS).
  A name-like type is capitalised somewhere and never lower-case anywhere in the text. K3 is primary; K2 (over-joins) is the sensitivity.
- PersonKeys = every key that is an end of at least one fact. The question set = `uncle(X)` for every X in PersonKeys.
- A question ends in exactly one state: `answered` (at least one uncle with a derivation whose every step has a giver) or `gap`
  (zero uncles and at least one typed gap). Gap kinds (closed set): `no_parent_fact`, `no_sibling_fact`, `no_sex_fact`,
  `open_world_empty`, `no_rule_giver`, `parent_cycle`. Each kind has an `opinionFillable` flag set by the engine, not by hand per case:
  true for the first five (a well-formed slot "one fact with one hole" exists), false for `parent_cycle` (key conflation: identity's seat).

## 2. Synthetic bars (judged by the janus test file `native/organs/kinship.test.mjs`; seeded families, truth by construction)

Generator: seeded (mulberry32), 4 generations, 2 to 4 children per couple, unique person ids, sex for every person; stated facts = a random subset of the
true parent_of and sex edges (each kept with a seeded probability drawn per family from the closed interval [0.4, 1.0]).
- S1 EXACT. For 200 families (seeds 1..200), for every person X: engine uncle set == an independently coded brute force over the SAME stated facts
  (enumerate every ordered pair, no shared helper), and engine uncle set is a subset of the generator's true uncle set (soundness). Bar: 200 of 200 families.
- S2 CONTROLS SEEN FIRING. Each of three mutants of the engine (drop the sex filter; drop the cycle check; derive sibling without the shared-parent
  requirement) must fail S1 or S3 or S6 on at least one family. Bar: 3 of 3 mutants caught. A mutant that survives is a failed bar, not a comment.
- S3 TYPED GAPS NAME THE MISSING PREMISE. For every question the engine leaves unanswered while the generator's full facts would answer it: the gap's
  named slots include at least one fact that belongs to a true derivation of that answer; zero questions end in an empty answer with no gap.
  Bar: 100 percent of such questions over the 200 families.
- S4 NO GIVER, NO STEP. 100 injected facts with a missing or blank giver or witness are refused at the door (`fact_without_giver`), and no derivation in the 200
  families contains a step without a giver. Bar: 100 of 100 and 0 steps.
- S5 THE OPINION SEAM. For each of the 200 families, file k random opinions (k from 0 to 5) into slots the engine offered (some true, some false facts):
  (a) the mechanical part of every answer (`state`, `items`, `gaps`, `evidence`) is byte-identical (JSON) with and without the opinions;
  (b) every conditional item has `opinionDependent: true`, lists the opinion ids it used, and `evidence.independent` is unchanged by it (an opinion adds 0);
  (c) after a supersede event for an opinion, no conditional item uses it; (d) an opinion whose holder does not match `self:model:<id>` or whose lens is not a
  64-hex sha256 is refused; (e) a true opinion for the only missing fact makes the conditional equal the generator's truth, and a false one does not make
  the mechanical state `answered`. Bar: all of (a) to (e) hold in 200 of 200 families.
- S6 CYCLES. A parent_of cycle (including a person who is his own grandparent, the name-conflation case) yields `parent_cycle`, never an answer, in 100 of 100 injected cases.
- S7 SHUFFLE (redeal). On the synthetic families, permuting the `b` end of parent_of facts changes the answered pairs in at least 95 percent of the families that had at least one answer.

## 3. Real-text bars (fresh regions only; the plain arm; assessable only when its null can separate)

- R1 WITNESS. Every extracted fact's witness span, read back from the pinned file by byte address, contains the kin term (or the patronymic) and the names recorded for its ends.
  Bar: 100 percent of facts, both languages.
- R2 GIVER PER STEP. Every step of every derivation on the real facts has a giver; 0 steps without. Bar: 0.
- R3 INTER-GIVER AGREEMENT. Children c (policy K3) for whom a text-stated father (kin term father, or son/daughter of a named male) AND a patronymic-derived father both exist.
  agreement = same father key. Null: 1000 seeded shuffles of the patronymic fathers among these children (seed 20261027). Bar: observed agreement strictly above the 95th percentile
  of the null. Assessable only if the null's 95th percentile is below 1.0; otherwise reported `unassessed` with n.
- R4 SEX CONSISTENCY. A-statements whose kin term carries a sex and whose holder key also carries a patronymic-derived sex: contradiction rate = fraction where they differ.
  Null: 1000 seeded shuffles of the kin-term sexes. Bar: observed rate strictly below the 5th percentile of the null; assessable only if the null's 5th percentile is above 0.
- R5 THE LIMIT NUMBER (reported, no threshold): for both policies and both languages, N questions; N answered mechanically; N gap by kind; N gap whose every gap is opinionFillable (the
  number an opinion could fill) versus N gap with a non-fillable gap (`parent_cycle`); the premise funnel (persons with at least one parent fact; with a parent that has at least one
  sibling fact stated or derived; with a confirmed-male sibling). Also the statements by category A (both ends named), P (only the possessor), H (only the holder), N (neither)
  by kin term and language: the premise supply lost to unbound ends (the identity seat's gaps, not this seat's).
- R6 SHUFFLE ON REAL FACTS. Permute possessor ends among A-statement facts and fathers among patronymic facts, 200 seeded times: the control is assessed only if the real answered count is at least 1
  (otherwise `control_not_exercised`, reported as a comment, not a pass); bar: the real answered pairs are not reproduced by any shuffle.
- G0 GIVERS' OWN KINSHIP (measured through the door on 127.0.0.1:11450, head fa9add32...): for each kin lemma of the lexicon, the relation rows by type and giver, and how many link two kin lemmas;
  for the 200 most frequent K2 name keys of the fresh Russian text, how many have any relation row to another person-name node by any type. Reported, no threshold.

## 4. Not claimed

That a name key is a referent; that an extracted fact is true (R3 and R4 are agreement checks between independent conventions, not gold; no Russian kinship gold exists); that the patronymic
reading of the father's name is right where several given names fit (flagged `ambiguous`); that the uncle rule is complete (the in-law alternative is a typed gap); that any model's opinion is
right. The opinion seam is built and tested; no model output is in any number above.

## 5. Falsifying control for the whole registration

Any bar above whose check was never seen firing (a mutant that survives, a null that cannot separate) is reported as such, not as a pass. A real-text answer with a step that has no giver
falsifies R2. An opinion that changes a mechanical answer falsifies S5(a).
