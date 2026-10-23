# resolve — which one is it?

`resolve.mjs` picks which candidate referent a mention is about, as a best assertion with odds. `read-nodes.mjs` turns plain text into the referent nodes
a mention is attached to, against an injected title index. Both are pure, deterministic and carry no word lists.

**Status: experimental (2026-10-21).** Measured on Wikipedia people whose referents editors had already linked (7 names, 55–110 persons each) and, in
the non-human and structure-free runs, on raw prose; the evidence and every miss are in `IDENTITY-WHICH-ONE.md` in the workspace root. Known misses: plain-text
reading asserts at 0.73–0.77 precision on two of six names (bar 0.80); dates abstain (a misreporting source breaks them); Janus-induced kinds gave no gain.

How it decides: an amplitude state over nodes (an attached node carries sqrt of its surprisal in the pool; the nodes related to it share one unit), cosine
similarity, the Born rule p ~ s^2 for the posterior (no fitted temperature), a between-candidate null for gaps, `lens.assertAt` (the stated willingness to be
wrong) for assertion, a question loop (`nextQuestion`, expected information gain) and a `verification` question that lets a wrong earlier answer be reopened.

Interface: `resolveReferent({ mention: {nodes}, candidates: [{id, nodes}], neighbors: (node) => node[], lens, answers })` returns
`{ decision: 'assert' | 'ask' | 'gap' | 'refused', ... }`. The referent graph is injected through `neighbors`; anything that can emit nodes (a text reader, a table
reader, an image or audio reader) plugs in the same way.

No consumer in this repository imports these modules yet (they are tested and ready to be wired in by a reader such as khora's); `resolve.test.mjs` and `read-nodes.test.mjs` are the only importers.
The wall-clock bound in `read-nodes.test.mjs` is a guard against a cubic blow-up (the first version took several seconds on 1000 tokens), not a performance claim.
