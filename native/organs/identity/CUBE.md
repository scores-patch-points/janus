# The identity organs on the cube

A reading, not a result: cube.js (`native/kernel/cube.js` in the khora) defines the cells; the placements below are hypotheses about where each organ's
question sits, and the code wins any disagreement. Cell names were checked against `cellOf` on 2026-10-22.

Grain says what is being identified (Ground: the conditions of sameness; Figure: which being; Pattern: what kind it is). Domain says what the identity is of
(Existence: the being; Structure: its arrangement; Interpretation: its frame).

| Organ | The question it answers | Cube cell (terrain · stance) |
|---|---|---|
| `resolve.mjs`, an assertion | this mention is that being | SIG·Figure (Entity · Binding) |
| `resolve.mjs`, an ask and its `nextQuestion` | which missing evidence would settle it | SIG·Ground (Void · Tending) |
| `resolve.mjs`, a gap, and the refusal without a lens | is the extent of an absence declared | DEF·Ground (Atmosphere · Clearing); the lens itself DEF·Figure (Lens) |
| `resolve.mjs`, `centered` | a being's deviation from its kind's average | the Kind grain (SIG·Pattern, NUL·Pattern) |
| `same.mjs` | a figure above the null, folds agreeing, deviations aligned | NUL·Figure (being a figure), then CON·Figure for the pair |
| `correspond.mjs` (landing separately), a confirmed pair | these two nodes correspond across graphs | CON·Figure (Structure, Link · Binding) |
| `correspond.mjs`, the class of aligned nodes | a network of correspondences is established | SYN·Pattern (Network · Composing) |
| `correspond.mjs`, its rewiring null | the condition that makes a pairing count | Ground |

## How they fit

`correspond` works in Structure: it licenses links between graphs and composes them into a network. `resolve` works in Existence: it binds one mention to one
entity among a stated pool and says what would settle it when it cannot. An Existence claim ("this mention is that being") is licensed by Structure claims
("these nodes correspond"), so the order is `correspond` supplies, `resolve` decides:

- `correspond`'s confirmed pairs are a candidate bridge or neighbour source for `resolve` (a foreign lemma aligned to an English lemma becomes a node of the
  mention). Whether a structure-derived bridge beats a dictionary-derived one (the Wiktionary gloss pivot) is a measurement, not an assumption.
- `fold-depth.mjs` (DMD) owns how deep a fold must be read; `resolve` today reads one fixed hop and could take that depth instead.
- The null and the lens are Ground and live once each: `correspond` owns the rewiring null for alignment, `resolve` owns the between-candidate null for a pool.

## Where it is thin

Almost everything here is Existence and Structure. The lens is a plain object (`name`, `giver`, `assertAt`), not an addressed object in the log; nothing composes a
Pattern from two addressed Figure claims (kind induction over resolved referents); identity of a frame (REC·Pattern) is untouched; `correspond` does not check
cycle consistency. `resolve`'s assertions are proposals that nothing records yet.
