# The time vocabulary — result (scored 2026-10-25 under S9-TIME-PREREG.md, frozen at `dd09dc9` + Amendments 1 and 2)

**PASSED under REC-1 for months and weekdays; FAILED B3 for relative terms.** Months and weekdays land as `priors/time-prior.json`
(`TimePrior@1`, sha256 `31613cc62c34402c…`, the same bytes from a fresh process). Relative terms are not landed. Every form in the prior is
a **candidate**: S9 reads no corpus, so nothing here is evidence of use.

| gate | bar | value | |
|---|---|---|---|
| B1 months agree | ≥ 0.80 | **0.811** (1,074 of 1,325 cells) | pass |
| B2 weekdays agree | ≥ 0.80 | **0.810** (742 of 916 cells) | pass |
| B3 relative terms agree | ≥ 0.60 | **0.541** (72 of 133 cells, 21 languages) | **FAIL**, recorded, not landed (REC-1) |
| B4 coverage | ≥ 100 languages with 6+ months in A | 207 | pass |
| B5 order | 12 and 7, single cycles, order equals CLDR's | 12 and 7; both orders equal CLDR's English calendar | pass |
| B6 no hand list | none of what the run found appears in the code | 31 words checked (every month, weekday and ordinal word the glosses gave), 0 leaked | pass |
| B7 determinism | two builds, same bytes | identical, and identical again from a fresh process | pass |
| B8 controls fall | ≤ 0.10 | deranged months 0.0008, weekdays 0.000, relative 0.000 | pass |
| B9 candidates only | every row a candidate naming its giver(s) | 9,447 rows | pass |

**How the run went (all of it kept).** Run 1 (`S9-TIME-RESULT-1-first-run.json`, 22 s) passed B1, B4, B7, B9 and failed B3. It found **no weekdays**:
the weekdays are common nouns in Wiktionary and word their neighbours "It follows Sunday and precedes Tuesday", while the stage looked for names
and "following X and preceding Y". B6 also flagged "short", which the first ordinal rule collected from "The short month…". Amendment 2 repaired
those two and the stray-bracket handling, and changed the decision rule so a failing class no longer holds the others back; **no bar moved**.
B2 and B5 for weekdays are therefore bars registered before, on a method repaired after run 1 had found no weekday at all.

## What was found

| class | concepts | languages in A (6+ cells) | also in CLDR | A only | cells | agree | agreement |
|---|---|---|---|---|---|---|---|
| months | 12 | 207 | 125 | 82 | 1,325 | 1,074 | **0.811** |
| weekdays | 7 | 221 | 132 | 89 | 916 | 742 | **0.810** |
| relative terms (not landed) | 15 | 21 | 20 | 1 | 133 | 72 | 0.541 |

**The two givers agree on the structure, not only the forms.** The months were never listed: they are the English entries whose gloss says
"month … Gregorian", ordered by the neighbours the glosses name ("following X and preceding Y"). The 8 candidates that did not join the chain
(other calendars' months, and a Latin form) were dropped. The weekdays are the nouns whose gloss says "day of the week" that close into a cycle
of 7; the 15 candidates that did not close into it fell away (Blursday, Caturday, Lord's Day, market day, payday, garbage day, weekday, and so on). Numbered by ISO 8601 and read against
CLDR's own English names, the order matches exactly.

**Where they disagree** (reported, not gating; the rules were frozen):

| class | numeral | inflection | other |
|---|---|---|---|
| months (251 cells) | 51 | 77 | 123 |
| weekdays (174 cells) | 6 | 62 | 106 |

- *numeral*: CLDR gives digits where Wiktionary spells the numeral, in languages that build month names from numbers: ja `1月` against `一月` and `睦月`; yue `1月` against `一月`; ko `3월` against `삼월(三月)`; vi `tháng 1` against `tháng giêng` and `tháng một`.
- *inflection*: CLDR's date form carries case, definiteness or a preposition (Greek `Ιανουαρίου`, Basque `urtarrila`, Occitan `de genièr`).
- *other*: a native name against a loan (Chechen `Дечкен-бутт` against `январь`), a variety (Levantine `كَانُون اَلثَّانِي`), and **accent marks**.
  Slovenian disagrees on every month (0 of 11) and weekday (0 of 7) because Wiktionary writes `jánuar`, `ponedéljek` where CLDR writes `januar`,
  `ponedeljek`; janus strips marks only for `STRIP_LANGS`, which Slovenian is not in. Stripping marks for every language would turn 72 more
  month-and-weekday cells into agreement (1,873 of 2,338 now; 1,945 if all were stripped), led by sl (18), haw, sd, lkt, jv, te. The prior keeps
  the raw `form`, so a consumer can fold further; the registered normalization is janus's own.

## The prior

454 languages, 19 concepts, 9,447 rows: **1,907 converged** (both givers), 3,521 Wiktionary-only, 4,019 CLDR-only. 82 months-languages and 89
weekday-languages are in Wiktionary and not in CLDR at all. 108 forms are bare digits (`1`) that CLDR gives for numeral-composed languages: a
consumer should not join a bare digit to a corpus token. One typed gap: `month:8` has 27 translation pairs against a class median of 263 (the
main entry of the month carries few; the rest sit elsewhere in the pack), so August is thin in every language.

## Relative terms: why they failed, and what a new registration must ask

B3 failed on the merits; the stage was not at fault. Looking at the cells (not tuning anything):
- A's slim extraction **truncates multiword translations mid-link** (`[[в]] [[прошлый`, `в [[этот`, `[[la]] [[semana]] [[pasado`), so "last year",
  "next week" are partly unreadable in A. Where a phrase survived, the givers agree (fr `l'année dernière`, de `letztes Jahr`).
- A holds **no translation of "today" or "tomorrow"** for several languages (ru, de, fr): Wiktionary keeps long translation tables on
  subpages, and the slim does not read them. "yesterday" (476 pairs) is intact and agrees (ru `вчера`, es `ayer`, de `gestern`, fr `hier`, hu `tegnap`).
- CLDR's phrase carries an article or preposition (`в прошлом году`, `el año pasado`) that a headword's translation does not; and A lists lexical
  variants CLDR does not (hu `idén`, es `hogaño`).
- 5 of 15 concepts are absent from A altogether (last, this, next month; this, next quarter): typed gaps, `absent_in_giver_A`.

A further attempt (S9r) needs its own registration. Its first questions: read the translation subpages; repair the truncation at the source
(`fast-read.mjs`); decide whether a relative term is compared as a phrase, or as the lexical head after stripping the article and preposition.

## Not claimed

Nothing about use: no row is `given`, and S9 reads no corpus. Role words (in, on, since, until, between, by, during, "according to") are not in
S9: A keeps translation pairs per part of speech, not per sense, so "until" carries "before" and "since" carries "because"; a role is a slot
class (the word, the case it governs, a time-like complement), which is a later stage with its own registration. Non-Gregorian calendars are not
covered. The result holds for Wiktionary 2026-10-01 v3 and CLDR 47.0 (ICU 77.1); another CLDR changes giver B and this result would say which.

## Reproduce

```
node scripts/hyperlexicon/s9_time.mjs           # measure, write S9-TIME-RESULT.json, land nothing
node scripts/hyperlexicon/s9_time.mjs --land    # the same, then write priors/time-prior.json and its manifest entry, only if every gating bar holds
```
Needs the Wiktionary slim pack (`~/.cache/live_priors/wiktionary/`, or `WIKTIONARY_PACK`), Zenodotus's `lookup.mjs` (or `WIKTIONARY_READER`),
and a node whose ICU carries CLDR 47. About 25 seconds.
