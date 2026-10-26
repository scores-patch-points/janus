# The time vocabulary — pre-registration (frozen 2026-10-25, before weekdays and relative terms are scored)

**Question.** The reader has to know which words name a month, a weekday, or "yesterday" / "last year" in each language. Today that
knowledge is hand-typed: English closed classes in khora `grammar-en.js`, and four hand-typed month sets (es, fr, de, ja) in
`grammar-packs.js`. Can a time vocabulary be *found* in the hyperlexicon's givers instead — the concepts located by what Wiktionary's
English glosses say, the forms carried by its translation pairs — and does it converge with an independent giver (CLDR), with no
hand-typed list of month names, weekday names, or ordinals anywhere in the stage?

**Disclosure.** A read-only prototype of the month arm ran on 2026-10-25, before this registration: 207 languages with at least 6 months
from the Wiktionary giver, 125 of them also in CLDR 47, 1,108 of 1,325 cells agreeing (83.6%). That prototype normalized marks away
for every language, which janus does not (see Normalization); S9 does not. The month arm is therefore a *reproduction under a corrected
normalization*, not a discovery. Weekdays and relative terms have not been run or looked at.

**Givers.** `A` = the Wiktionary slim pack 2026-10-01-v3 (CC BY-SA 4.0), read through Zenodotus's own `lookup.mjs`
(`Dictionary.resolve(form, { learn: false })`), pack sha256 recorded. `B` = CLDR through the runtime's ICU (`Intl`), the Gregorian
calendar forced (`-u-ca-gregory`), versions recorded (CLDR, ICU, Unicode, node). Neither has precedence. Every form either giver yields
is a **candidate** (`standing: "candidate"`): the hyperlexicon's rule is that a giver's claim licenses nothing until use earns it, and
S9 reads no corpus.

**What is found.**
- *Months.* English `name` entries of A with a sense whose gloss says "month" and "Gregorian". They are ordered by the neighbours the
  glosses name ("following X and preceding Y"): the month whose predecessor is "of the previous year" is first, and successors are
  followed. No ordinal word and no month name is used. Entries that do not join the chain are dropped and listed.
- *Weekdays.* The same, for English `name` entries whose gloss says "day of the week". The chain is a cycle; it is numbered by ISO 8601
  (Monday = 1), the one declared choice, fixed by CLDR's English name for 2024-01-01, so no weekday name is typed in the stage.
- *Relative terms.* The inventory is CLDR's own: for unit in day, week, month, quarter, year and offset in -2 … +2, a concept exists
  when English CLDR has a lexicalized phrase there (`Intl.RelativeTimeFormat('en', { numeric: 'auto' })` differs from `numeric: 'always'`).
  That phrase is the concept's English headword. A is asked for an English entry with that headword; an absent entry is a typed gap
  (`absent_in_giver_A`), not an error.

**Forms.** For a concept, A's forms are the `[lang, form]` translation pairs of the English entry (all parts of speech; for relative terms
the headword's entries). B's forms are CLDR's: for months and weekdays, long and short, standalone and in a date (`formatToParts`
month/weekday part); for relative terms, `RelativeTimeFormat(lang, { numeric: 'auto' })` at the offset, kept only where it differs
from `numeric: 'always'` (a lexicalized phrase). Language key = `Intl.getCanonicalLocales(code)[0]` of A's code (cmn → zh, arb → ar,
iw → he …), pooled; a language B does not support is A-only.

**Normalization (frozen, janus's own).** NFKC, lower-case; combining marks stripped **only** for the languages `common.py::STRIP_LANGS`
names (read from that file, not copied), then spaces, apostrophes, full stops, hyphens and middle dots removed. This is how the
hyperlexicon's type keys are made, so a form here joins a corpus type there.

**Agreement.** A *cell* is (language, concept) where both givers hold at least one form. A cell **agrees** when the two sets of normalized
forms intersect. `agreement` = agreeing cells / cells, over languages with at least 6 of the class's cells in A.

**Disagreement classes (reported, not gating; rules frozen now).** `numeral` — B's form contains a decimal digit and A's does not.
`inflection` — after normalization one form contains the other and the lengths differ by at most 4 (case, definiteness, a preposition).
`other` — anything else (native against loan, a variety, an orthographic variant).

**Controls built to fail.** *Deranged*: each A cell is compared with the *next* concept's B cell (month n against month n+1, weekday n
against n+1, relative offset k against -k). If the metric cannot fall, it measures nothing.

**Bars (decided now).**
- **B1** months: `agreement ≥ 0.80` (a reproduction; the prototype's 0.836 is disclosed above).
- **B2** weekdays: `agreement ≥ 0.80`. Not looked at.
- **B3** relative terms: `agreement ≥ 0.60`. Not looked at; lower because B's phrase often carries a preposition, article or case that A's headword translation does not.
- **B4** coverage: at least 100 languages with 6 or more months in A.
- **B5** order: A's gloss chain gives exactly 12 months and 7 weekdays, each a single cycle, and its order equals B's English calendar order. Two givers must agree on the order, not only on the forms.
- **B6** no hand list: no month name, weekday name, or ordinal word found by the run appears in the stage's source (checked by the stage itself, case-insensitive whole words).
- **B7** determinism: two builds from the same givers are byte-identical.
- **B8** the controls fall: deranged agreement `≤ 0.10` in every class.
- **B9** every form row is a candidate and names its giver(s); no row is `given`.
- Reported, not gating: per-language agreement; the three disagreement classes; the A-only languages (not in CLDR); the typed gaps; the languages where A has too few forms.

**Decision.** If B1 through B9 all hold, the prior lands as `priors/time-prior.json` (`TimePrior@1`) with its manifest entry. If any
fails, the prior is not landed, the result is recorded as failed, and the next frame is a REC — not a re-tuned threshold.

**Not in S9.** Role words (in, on, since, until, between, by, during, "according to") and their case government. A's translation pairs
are kept per part of speech, not per sense, so "until" carries "before" and "since" (conj) carries "because"; a role is a slot class
(the word, the case it governs, and a time-like complement), which is a later stage with its own registration. Non-Gregorian calendars.
Anything read from the corpus, so nothing here is evidence of use.

**Known limits, stated now.** A is one dump (2026-10-01) and one extraction (`fast-read.mjs`, templates collapsed); A's `August` entry
carried only 27 pairs in the prototype, so month 8 will be thin and is reported as a gap. B is one CLDR version; another changes B and
this result says which. A lists varieties and traditional names that B does not (a Levantine month name, 睦月); B lists the standard
only. Some languages compose month names from numerals (ja, ko, vi, yue, zh): their cells will disagree by construction (`numeral`).
Language-code pooling is CLDR's, so a language it does not alias stays under A's code.
