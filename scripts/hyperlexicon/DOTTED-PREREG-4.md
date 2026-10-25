# Frame 4 — the givers' names read as written (frozen 2026-10-25, before the list is built or scored)

**REC of frame 3.** Frame 3 asked the hyperlexicon's names index, which keeps surfaces lower-cased, and lost the case Wiktionary's headwords
carry (DOTTED-RESULT-3.md: B1 failed by 6, every difference a case fold). Frame 4 asks the same question of the givers' **node records**,
which keep each name as written.

**List HC (frozen).** For every lower-cased surface the names index lists in English with a final period (letters and dots, at most 12
characters), the surfaces as written in the names of the node records it points to whose language is English and whose written form folds
to it; then janus's treebank check, as before. Built by `scripts/build-dotted-priors.mjs --from-hyperlexicon --cased`, reading the node
records through `traverse.mjs::node`.

**Arms, material, score.** As frame 3: `0`, `W` (`7b185180`), `HC`; UD English EWT, GUM, LinES, ParTUT, PUD, every split; S8.

**Bars.** **B1** `gain_HC ≥ gain_W`. **B2** `gain_HC > 0`.

**Decision.** If B1 and B2 hold, `priors/dotted-eng.json` becomes HC (giver: the hyperlexicon, its givers named) and the reader's live
consult asks the hyperlexicon's door (`names`, read as written) instead of a giver's pack. If B1 fails, the differing forms are reported
and the trade goes to the user.
