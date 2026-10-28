# LABELLING PROTOCOL (SCENE LENS) — the gold for the scene model (an OPINION, filed as one)

Written 2026-10-28 by the scene-model session (a model, `self:model:claude-sonnet-5-5`) BEFORE the fresh window was chosen and before any label was filed. This file is the LENS of the gold: the gold file carries this file's sha256 as `lens`.
The gold is a **self:model opinion** in the sense of `native/organs/kinship.js`: never evidence, never licensing, supersedable. It is made by a model context that has been given THIS file, the window's text with its paragraphs numbered,
the reader's list of beings with their mentions, and the list of kin statements — and nothing else: **not the scene model's code, not any output of any binder, not the window's chapter or book number, not the novel's cast or plot**
(the labeller reads the window as a text, and where the text does not say who someone is, the end is null). Whatever the labeller's memory of the novel suggests is world knowledge and is not used. The binder's author and the labeller are different contexts of
the same model family: a dependence, declared, not removed.

## What is labelled
1. **The scenes.** The window's narrative paragraphs are numbered from 0 (the numbering of the file you are given). A SCENE is a run of paragraphs in which the same beings are present and the setting (the place and the time) does not change. A chapter
   heading always starts a new scene; a scene may also start inside a chapter where the place, the time or the company changes. List `scene_breaks`: the numbers of the paragraphs at which a NEW scene starts (paragraph 0 starts the first and is not listed).
   Label the scenes first, before the statements, and do not revise them after seeing how a statement would resolve.
2. **Every kin statement** of the list given (all of them, whatever the extractor's category): its `scene` (the scene number, from 0, in the order of the breaks), and its two ends.

## What an end is
HOLDER = the being the kin word names (the son in "the son of X"); POSSESSOR = whose kin (X). Each end gets `ref`: the id of the LEDGER referent (a being in the list given) of a NAME MENTION that identifies the being, or `null`. The being is identified by the
mention the reader wrote, so a ledger identity error (two referents for one person, one referent for two people) is not charged to the model; flag it `doubtful: true` with a `note` when you think the ledger's referent is not the person the text means.

`ref` is given only when a careful reader of **the statement's SCENE** (every paragraph of the scene the statement stands in, before OR after the statement, never a paragraph outside it) can name the being from the scene's own text. NO world knowledge, NO text
outside the scene, NO kin derivation: a sister of X is not named because X's father's daughter is named elsewhere in the scene; but where the scene states a relation outright («Наташа, сестра Николая»; «Николай, брат ее»), the being is named by that statement. If the
scene leaves two beings equally possible, the end is `null` with `why` `unnamed`. Otherwise `null` with `why`:
- `generic`        no particular being («деды», "all that a father can do");
- `unnamed`        a particular being the scene does not name (the bare "his son", "her mother" whose name the scene never gives), or two beings equally possible;
- `not_in_ledger`  the scene names the being but the ledger has no referent for that mention (a vocative in Latin script, a bare title such as «князь», a name the reader did not keep as a being).

## How a bound end was licensed (`kind`) and where its identifying mention stands (`direction`)
`kind`:
- `apposition`   the name written next to the kin word in the same case or after a comma («сына Анатоля», «Борис — офицер, сын ...»);
- `genitive`     the name written in the genitive after the kin word («дочь князя Василия»);
- `pronoun`      a third-person pronoun or possessive («его», «ее», «который») whose antecedent is a name in the same or the previous sentence;
- `reflexive`    «свой» and the subject of its clause;
- `deictic`      first or second person («мой», «ваш», «вы») whose speaker or addressee is named in the turn (a vocative) or its attribution;
- `subject`      the end is the grammatical subject of the clause the kin word is in («Князь Василий желал определить сына»);
- `discourse`    named elsewhere in the same paragraph or dialogue turn with no marker on the kin word;
- `scene`        named elsewhere in the same SCENE, in another paragraph than the statement's, with no marker on the kin word, or tied by a relation the scene states in another paragraph.
`direction`: `same_sentence` (the identifying mention is in the kin word's own sentence), `before` (an earlier sentence of the scene), `after` (a later sentence of the scene: a reader needs the text that follows).
`quote` is the exact text span(s) that license the end (pieces joined by " … ", each an exact substring of the window, copied from the window text, not from the paragraph-number prefix). Leave `quoteAt` out: it is filled mechanically from the quote after you are done (`scripts/kinship/fill-quote-at-scene.mjs`, the occurrence nearest the kin word). For a pronoun, the antecedent's mention and the pronoun both appear in `quote` where
they are within one sentence; otherwise the antecedent's own quote is added.

## Output
One JSON file, `KinSceneGold@1`: `scene_breaks` (the list), `statements` (one record per statement, in the given order, each `{i, term, termSpan, scene, holder:{ref, display, kind, direction, quote, doubtful?, note?} | {ref:null, why, quote, note?}, possessor:{...}}`; `term` and `termSpan` are copied from the statement list given: `term` is its `term`, `termSpan` its `termSpan`).
The structural checker `scripts/kinship/validate-gold-scene.mjs` is run on it by the author of the registration (the labeller is not given it, so that it never sees the scene model's directory); every problem it reports is handed back to the labeller to fix before the file is filed. It checks form (ids, closed sets, quotes that read back), never the labels' truth.

## What the labeller did not do
Did not read or run the scene model or any binder; did not read the window before this lens was fixed; made no call to any other model; did not read any text outside the window; used no knowledge of the novel; did not revise the scene breaks after labelling the statements.
