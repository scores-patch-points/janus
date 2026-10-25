# The dotted words read through the hyperlexicon — frame 3 (frozen 2026-10-25, before the list is built or scored)

**What changes.** Not the rule — the source. Today the reader's dotted words (`priors/dotted-eng.json`, `7b185180`) are read from one giver's
pack directly. Read through the hyperlexicon, the same question — "does a named giver list this written form, with its period, in this
language?" — is asked of the ledger's names index (s2), where every giver's claims sit as unlicensed candidates beside the concordance.
The canon's rule is unchanged in the reader: experience (the text, which writes the form at a junction and never bare) nominates; a named
giver licenses.

**List HN (frozen).** Every surface a giver of hyperlexicon v1 (head `fa9add32`) names in English with a final period, letters and dots
only, at most 12 characters (the index keeps surfaces lower-cased), with janus's treebank check (a single-dot form whose base the POS
treebank attests as a word is kept only where the treebank also writes it with its period) — `scripts/build-dotted-priors.mjs
--from-hyperlexicon`.

**Arms and material.** `0`, `W` (`7b185180`), `HN`; frame 1's material (UD English EWT, GUM, LinES, ParTUT, PUD, every split), frame 1's
score (S8, `--W` and `--H` arms).

**Bars.** **B1** `gain_HN ≥ gain_W`. **B2** `gain_HN > 0`.

**Decision.** If B1 and B2 hold, `priors/dotted-eng.json` becomes HN (its giver: the hyperlexicon, with the givers it holds named), and the
reader's live consult asks the hyperlexicon (the door's `names`) instead of a giver's pack. If B1 fails, the forms where HN and W differ
are reported and the trade goes to the user.
