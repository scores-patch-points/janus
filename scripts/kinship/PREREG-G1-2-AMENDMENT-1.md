# PREREG G1-2 — Amendment 1 (written before any bar was scored; no test has been run; found by reasoning about the engine, not by a failing run)

Parent: PREREG-G1-2.md sha256 0ceb5af9bfe0272eb403e365ea6f289a4f0eaffb2cc76e0ffa636c87fb9b193f.

1. S3 is refined, not relaxed in what it demands of a visible case. The parent text says "100 percent of such questions". An engine that is honest about the open world cannot
   point at a parent that no stated fact mentions: if X has one stated parent (with no uncle) and the parent that has the uncle is stated nowhere, no gap slot can name it
   (the alternative, a standing "maybe a second parent" gap on every question, would end every question in a gap and say nothing). So S3 is judged on VISIBLE cases and reports the rest:
   for every question the engine leaves unanswered while the generator's full facts would answer it, let M be the true parents of X that have a true male sibling.
   - VISIBLE if X has no stated parent (the gap must be `no_parent_fact` with slot parent_of(?, X)) or at least one member of M is a stated parent of X (a gap slot must be an
     instance of a true fact of a true derivation that is NOT among the stated facts). Bar: 100 percent of visible cases.
   - INVISIBLE otherwise (X has stated parents, none of them in M). Reported as a count and a share; no bar. This is the premise-starvation floor the open world imposes.
   Zero questions may end in `state: gap` with an empty `gaps` list (all cases, bar unchanged).
2. S2's third mutant is stated literally as implemented: "a sibling is any child of any parent in the base" (the shared-parent requirement removed).
3. A fact's witness must be a byte-span address `src#from-to` unless its giver begins `wiktionary` (a gloss is the witness there). Both stated in the parent only implicitly.
4. The measurement script is `scripts/kinship/measure-kin.mjs`; its sha256 is filed in Addendum 2 before it reads any fresh text.
