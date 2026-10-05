# janus — the logos · the reasoner · the mark

*Janus (formerly part of eoreader7, extracted 2026-10-04). Two faces at one
door: the **reason** — what follows from the record — and the **mark** — what
stands first in that order. One repo, the threshold god.*

janus owns the **Relate** mode of the Fold's three-body spine: khora
*Differentiates* (the perceiver — reading, ground, measurement), janus
*Relates* (what follows from the record), penelope *Generates* (the artifact,
the record, the mouth).

## What it hosts

The reasoning closure moved out of the khora (`JANUS-EXTRACTION.md`, 2026-10-04):
`native/kernel/*` (reaction, refutation, cascade, relation-composition,
terrain-activation, experience-priors, hypergraph, hyperlexicon, task-log),
`native/organs/*` (reasoning-lint, regime, reasoning-core, talk-reason,
derivation, logos, and the Relate helpers), `native/interpretation/declarations.js`.

The seam is `classifyTurn`'s `derive` (`reason-gate.js:143`): khora settles →
janus derives → khora surfaces. The notes/hyperlexicon/task-log bundles are
**injected, never imported**; corroboration's witness-read is wired via
`wireWitnessRead`. The shared contract (`kernel/cube.js`, `kernel/gfp-claim.js`)
is crossed from the khora as siblings — never duplicated.

## The two faces

- **The logos** — the derivation kernel, the precedence regime, the constraint
  solver, the veto. Its verdicts are `measured`/`refused` by the organs it hosts.
- **The mark** — the identity, served static brand assets, `received` (its
  giver is the designer, II.1). The reason orders what a reader meets; the mark
  is what stands first in that order (III.1).

## Standing rule

The seam is the contract: a derive call returns `{ settled, reason?, derivation? }`
or `{ settled: false }` — never a model's own conclusion, never a fabricated
fact (II.9). The closure never imports the reader: no `adapters/text`, no
`source.js`, no surface (II.3's descent is the boundary, mechanically checked).
## Mounting janus (the one Fold server)

```js
import { createJanusHandlers } from "janus";            // native/handlers.js
import { sourceOfWitness, recipeOfWitness } from "../khora/native/kernel/notes.js";
const janus = createJanusHandlers({ notesRead: { sourceOfWitness, recipeOfWitness }, khoraDir, deriveContext, claimOf, log });
// janus.handle(req, res) -> true iff consumed (GET|POST /v1/reason, /api/reason); never a 404
// janus.derive(task, ctx) -> { settled, reason?, derivation? }   (classifyTurn's `derive`)
// janus.close()
```

`npm test` runs `test/*.test.mjs` (handlers, derive, closure). The compat tests compare against a sibling `../khora` checkout and skip if it is absent.
