# LABELLING PROTOCOL — the gold for the kin binder (an OPINION, filed as one)

Written 2026-10-28 by the kin-binder session (a model: `self:model:claude-sonnet-5-5`) BEFORE any gold label was filed and before any
bar was scored. This file is the LENS of the gold: the gold file carries this file's sha256 as `lens`, holder `self:model:claude-sonnet-5-5`.
The gold is therefore a self:model opinion in the sense of `native/organs/kinship.js` (never evidence, never licensing, supersedable): it is
the labeller's reading, not a giver, and every number scored against it says so. The binder's author and the labeller are the same session;
that is a dependence and is declared, not removed. The held-out labels are made WITHOUT running the binder on the held-out text.

## What is labelled
One record per kin statement the plain extractor (`scripts/kinship/extract-kin.mjs`, unchanged) finds in the window: the kin term at its byte
span (`termAt`), the two ends: HOLDER (the being the kin word names: the son in "the son of X") and POSSESSOR (whose kin: X). Every
statement of the window is labelled (A, P, H and N), not only the unbound ones.

## What an end is
Each end gets `ref`: the id of the LEDGER referent (the reader's referent of standing `referent`) of the NAME MENTION that identifies the
being, or `null`. The being is identified by the mention the reader wrote, so a ledger identity error (two referents for one person, one
referent for two) is not charged to the binder; it is flagged `doubtful: true` when the labeller thinks the ledger's referent is not the
person the text means. `ref` is given only when a careful reader of the statement's own sentence, its dialogue turn or paragraph, and (for a
pronoun) the sentence before it, can name the being. NO world knowledge, NO later text, NO kin derivation (a sister of X is not named because
X's father's daughter is named elsewhere). Otherwise `ref` is `null` and `why` says which:
- `generic`   no particular being («деды», "all that a father can do"); 
- `unnamed`   a particular being the passage does not name in that sentence, turn or paragraph (the bare "his son");
- `not_in_ledger`  named in the text but the ledger has no referent for that mention (a vocative in Latin script, a bare title).

## How a bound end was licensed (`kind`, for the breakdown of what rules can reach)
- `apposition`   the name written next to the kin word in the same case or after a comma («сына Анатоля», «дочь князя Василия, красавица Элен»);
- `genitive`     the name written in the genitive after the kin word («дочь князя Василия»);
- `pronoun`      a third-person pronoun or possessive («его», «ее», «который») whose antecedent is a name in the same or the previous sentence;
- `reflexive`    «свой» and the subject of its clause;
- `deictic`      first or second person («мой», «ваш», «вы») whose speaker or addressee is named in the turn (a vocative) or its attribution;
- `subject`      the end is the grammatical subject of the clause the kin word is in («Князь Василий желал определить сына»);
- `discourse`    named elsewhere in the same paragraph or turn with no marker on the kin word (the description «будущая мать»).
`quote` is the exact text span that licenses the end (for a pronoun, the antecedent mention and the pronoun both appear in `quote` where they are
within one sentence; otherwise `antecedent` is the antecedent's own quote). `at` is the byte span of the identifying mention in the window's file.

## What the labeller did not do
Did not read any binder output before labelling the held-out window; did not read the held-out kin statements (only their counts) before the pre-registration
was hashed; did not use the fold's answer prose or any model reply; made no model call (the labeller is this session reading the text).
