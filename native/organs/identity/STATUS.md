# STATUS — what is done vs. the spec's "not shown" list

The "What identity is" spec closed with four named gaps. Here is where each
stands after this build.

| gap in the spec | status |
|-----------------|--------|
| 1. nothing has run on the Acmecorp primary documents | **done (thin reader).** `run/acmecorp.mjs` extracts addendum dates, contract codes, and discount lines by structure, then runs the finder. It convicts Addenda 1–2 (`1/17/2024` header vs `1/17/25` ack) and confirms the count and discount range as bound. |
| 2. no real reader that turns a page into assertions | **partial.** The run script is a structural text extractor, not a page→assertions reader; it does no OCR/image input and no general assertion extraction. The perceiver's `/v1/perceive` (tesseract) exists in the khora repo but is not wired to this finder. |
| 3. the finder's premise check is a partial version of the identity formula | **formula built, finder not yet wired to it.** `src/same.mjs` is the full U/Δ/λ formula. The finder compares parsed slot values under declared keys/lifts; it does not yet call `same()` to make the slot-level "same/different" call a full world-fold. Wiring `same()` into `finder.compare` is the next step. |
| 4. the referent design exists only as toy code | **real module, no persistence.** `src/referents.mjs` is a real store (append-only edges, read-time groups, transitive vs threshold lenses, conceptual referents, fission report). It is not yet backed by a durable store or wired into the khora perceiver. |

## What is deliberately not claimed

- The four attack findings are pinned by tests; the numbers "61 tests / 12
  invoices / 6 languages" from the spec are **not** reproduced here — this build
  is a fresh implementation with 19 tests, not a port of the prior toy code.
- OCR-robustness (the `21.05 → 01.05` single-digit substitution that survived
  150–400 dpi) is **not** exercised; there is no OCR pass in this build.

## Next steps, in order

1. Wire `same()` into the finder's slot comparison (close gap 3).
2. Back the referent store with a durable log (khora's EODB events / Matrix /
   Drive), and admit real surfaces (close gap 4).
3. Replace the thin extractor with the perceiver's `/v1/perceive` so a page
   image becomes assertions (close gap 2).

## Finding: the default `estimateNull` stops the fold before some deep differences (2026-10-20)

`deep-difference.test.mjs` plants a difference d hops out (d = 2..5) in a seeded noisy branching world and asks whether
`worldFold` reaches it. With a fixed null (0.01 to 0.20) every difference is reached (100%) and irrelevant added branches
move nothing. With the default `estimateNull` (median one-hop change, ~0.39 here) only ~66% are reached (50 to 73% by depth)
and the stopping hop moves when irrelevant detail is added (roadmap item 4's falsifier). No identical pair was ever called
different, so the failure is only the missed direction. Cause: most nodes are leaves, so the median one-hop change is large
and the first hop never exceeds it. Not claimed: that 0.01 to 0.20 is a good setting (single attribute, one kind, synthetic
graphs), or that a bound which never stops would be caught (the test cannot see that). The last test pins the gap and flips
when the default null is fixed.

## Finding: a conclusion for the fold that survives exhaustion (2026-10-22; `fold-depth.mjs`, not wired into `same()`)

`same()`'s fold stops at `estimateNull` (not DMD) and its descriptor U is cumulative, so folded to a whole connected component any two beings in it are identical and "the conclusion compared with the whole" (dmdWindow) is trivially close. `foldDepth(a, b, world, { lens })` reads the fold as **shells** (the tokens at exactly h hops), takes "close shell by shell out to radius h" as the discrete conclusion, the conclusion at the largest radius as the whole, and returns the shallowest radius that agrees (dmdWindow's rule, cross-checked against khora's `dmdWindow` in the test). A 'close' conclusion owes a null (links re-paired at random, 499 draws, alpha 0.01) or it is the typed gap `close_not_beyond_null`.

Measured (`fold-depth.test.mjs`, 7 tests; identity suite 76 of 76):
- the deep-difference world (d in 2..5, f in {1/6, 3/6, 1}, 30 seeds): every planted difference is reached, at exactly its hop; identical pairs are never called different and are all supported by the null; irrelevant branches move neither the conclusion nor the depth (the default `estimateNull` detects about 66% and moves);
- a connected case (the two roots bridged by a hub): the cumulative descriptor is identical for all 360 planted-different pairs; the shell profiles still reach every one, at its hop;
- typed gaps: no lens, unknown being, two isolated look-alikes.

Limits, both measured and not fixed:
1. **A hub linked to every being** puts everything within two hops, so every shell profile is the same whatever the structure. All 20 planted-different pairs in hub worlds are called close and none is caught by the null (it keeps degrees but not "linked to everyone"). Pinned as KNOWN LIMIT; it flips when a hub-aware metric exists.
2. **Beings with little structure.** In the dense ground of `same.test.mjs` (invoices linked only to a vendor) the planted duplicates a and b are close but the null calls that close often (p 0.39): two degree-one beings are alike by chance. foldDepth returns `close_not_beyond_null` there, where the old method returned `same` on the strength of the cumulative U, Δ and λ. The sameness of such beings rests on their attributes (Δ, λ), not on their relations.

Not built: the other candidate (the full verdict at each depth, with Δ's displacement profile per depth). It would help limit 2 and cost one profile per depth.

Decision for the user before `same()`'s default changes: if foldDepth replaces the fold stop, a 'close' without null support is either a refusal of the verdict, a verdict decided by Δ and λ alone, or a fourth value ('unsupported', in the organ's own words "a miss is a typed gap, never a guess"). And Δ's neighbour folds need a depth of their own.

**Decision taken (2026-10-22, Claude's recommendation after "what's most aligned"): a typed gap, opt-in.** `same(a, b, world, { lens, fold: 'dmd' })` reads U with `foldDepth` and adds a fourth verdict, `unsupported`: U is close but no closer than chance when the relations are destroyed. Δ and λ do not decide in that case, for the reasons the thread already measured: λ's null is 0 (vacuous on 259 of 262 filer pairs) and Δ's floor is a median rank cut, so the two weakest conjuncts carrying the verdict repeat the loose-conjunct false-`same` of the filer probe (234 of 4,262), and the organ's own law is "a miss is a typed gap, never a guess". The default is unchanged (`fold: 'cumulative'`); the dense-ground duplicate is `same` by default and `unsupported` under `fold: 'dmd'` (`same-dmd.test.mjs`, identity suite 80 of 80). Δ still uses its own `foldNull`/`estimateNull`: a Δ conclusion that survives exhaustion is not built, and against the whole a jammed ground returns "nothing is distinct" for everyone, so it needs a jam test, not just a depth.

## 2026-10-23: the round trip and the census

- `../nl-eot.mjs`: any language -> its grammar -> EOT -> back through any language's grammar. Grammars are priors built by
  `khora/native/scripts/train-ud-language.mjs` (parser + tokenizer in, `UDGrammar@1` out: order parameters, form table, marker table).
  A language without a prior is the typed gap `no_grammar`; crossing without a correspondence is `no_correspondence`; a marker the target
  grammar never attested is `no_marker`; a form it never attested is `form_unattested`. Measured on Danish (2,000 training sentences):
  200 held-out sentences come back with order tau 0.64, 84% of forms, 3% exact. The cross-language leg has only the admitted
  correspondences as its lexicon (29 French-Spanish pairs), so it is mostly gaps by construction, and says so.
- `identity-cube.mjs`: all 27 cells covered (see README).
- Grammars for the 95 languages that have both a UDHR edition and a UD treebank are being built (`identity-udhr-emergence/omni/`);
  licences per treebank in `priors/NOTICE-ud-priors.md`. Run 7 (omnilingual correspondence) is pre-registered and waits on them.

**The cross-language leg, first run (2026-10-23).** French UDHR Article 1 read by the French grammar, written by the Spanish grammar with
the 29 admitted French-Spanish correspondences (Run 4b) as the whole lexicon: *el être tout humain naître libre y igual de dignité y de
derechos* — markers re-realized in Spanish, lemmas crossed where a correspondence exists, the rest left in French and counted (6
`no_correspondence`, 8 `form_unattested`). The lexicon's wrong pairs show (sûreté>disfrute, ce>alguno): the null's share, not hidden.
Limitation found: a marker whose source features have no exact entry in the target's marker table falls back to the host-class default,
so agreement is lost at the fallback (*la vie* -> *el vie*). The fix is a nearest-feature match in the marker table; not built.

*Dates corrected 2026-10-23: entries first dated 2026-10-25 were written on 2026-10-22 (correspond.mjs committed 0db1232 at 22:09, fold-depth.mjs 8634259 at 23:09) by a session whose clock ran ahead.*


## 2026-11-14: the text finder (`text-finder.mjs`), development record

Built to the owner's finder spec and design doc "One Log, Many Projections: Backward Folding Under a Declared Ground".
Prototype, pre-registration, hold-out and runs live outside this repo in `ledgers/finder-text/` of the working folder;
this is the kernel, ported.

What was measured before the hold-out (development data only; none of it is a claim):

- A yes/no reader alone (qwen3:8b, thinking off), asked about whole texts, on 84 development pairs written from four
  public procurement documents: 21 of 21 paraphrases found, 0 of 30 contradictions accepted, and 25 of 33 pairs that add or
  change one fact called the same. Its pre-registered bar on false accepts was falsified. On these pairs this reader did
  not notice a surplus.
- The same model with thinking on, on the 46 pairs the first had called the same: 16 of 21 paraphrases kept, 21 of 25
  changed pairs caught. The two are treated as two baselines, so as two grounds, not as a weak and a strong reader.
- This finder on 56 of the 84 pairs: under the strict draft ground 16 of 21 paraphrases kept and 27 of 31 changed pairs
  caught (52 pairs: a row is filed only when every model call for a pair succeeds, and 4 pairs had none); under the casual draft ground 20 of 21 kept and 17 of 35 caught.
- Three adversarial reviews (40 findings; 48 findings, 46 confirmed by checkers who read the code; a re-check). Their
  fixes are pinned by the tests in `text-finder.test.mjs`.

Known limits, stated:

- The reader-state change at the Significance layer is not built; a whole-text reading by a named reader stands in.
- khora's full reading parses English only today. In other languages the readings fall to surface tokens, the checks by
  tags report that they did not run, and the readers of questions carry the verdict.
- The two grounds are drafts by one author and are not ratified. The same pair can stand differently under each; that
  difference is a finding, not an error.
- A figure's scale or unit written as a word ("5 million", "7 days") is not compared by the number parser; it is left to
  the readers of questions.
- A name at the start of a sentence can match a common word spelled the same ("Will" / "Will the tenant…").
- The kind question ("both are X") is not armed with a control.
- Found by an independent review on the day of the merge, and NOT yet fixed, because the kernel here is the instrument
  the hold-out was frozen on and must not change until that run is scored:
  - under a question that keeps only the existence layer, a wording difference nobody decided ("passed" / "failed") is
    pruned as structure and the standing can come back as plain "holds";
  - with no whole-text reader handed in and nothing required by the ground, the significance layer drops out silently
    where it should be reported as not said;
  - `readGround` throws, where it should refuse by name, on an event that decides a name such as "constructor";
  - a reading handed in without tokens throws, where it should be refused;
  - no test covers a reader that throws, a kind question left unanswered, the candidate and typing budgets, per-side
    languages, or negation counted by head. The test of the draft grounds pins their author's byline and will need
    changing when the grounds are ratified.

The pre-registered hold-out (147 pairs, five languages, scan noise) was frozen and its claims stamped on 2026-11-14,
before the finder was run on it (`ledgers/finder-text/PREREG.md`). When this was merged the run had not finished and
NOTHING WAS SCORED: no hold-out result exists yet. It will be added to this file when it does, whatever it is.
