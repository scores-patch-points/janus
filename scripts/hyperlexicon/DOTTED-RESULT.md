# The dotted share — result (scored 2026-10-25 under DOTTED-PREREG.md, frozen at 474fc58 + Amendment 1)

**FAILED B1.** Rule H's list does not cut UD English gold as well as Wiktionary's. Wiktionary's list (`priors/dotted-eng.json`,
`7b185180`) stays; H is not landed. The next frame is a REC, not a re-tuned alpha.

| | value |
|---|---|
| S6 | 60,841 documents, 899,224,642 tokens, 1,174,582 (lang, type) rows, head `fa9add3225efd7ff` |
| Rule H (English) | 1,055 words kept of 184,643 letter-only types written with a period at least once |
| junctions scored | 27,946 |
| errors: no list · W · H | 656 · 531 · 575 |
| gain: W · H | 125 · 81 |
| **B1** gain_H ≥ gain_W | **FAIL** |
| **B2** gain_H > 0 | **pass** |

| treebank | junctions | errors 0 | errors W | errors H | gain W | gain H |
|---|---|---|---|---|---|---|
| EWT | 9,726 | 250 | 159 | 190 | 91 | 60 |
| GUM | 10,894 | 238 | 210 | 221 | 28 | 17 |
| LinES | 4,978 | 157 | 156 | 156 | 1 | 1 |
| ParTUT | 1,794 | 0 | 1 | 1 | -1 | -1 |
| PUD | 554 | 11 | 5 | 7 | 6 | 4 |

**Where W and H differ** (the 16 commonest of 104 junctions):

| form | gold | W | H | n |
|---|---|---|---|---|
| Corp. | no boundary | kept | cut | 7 |
| t. | boundary | kept | cut | 6 |
| No. | no boundary | kept | cut | 5 |
| Wed. | no boundary | kept | cut | 4 |
| Sat. | no boundary | kept | cut | 4 |
| R. | no boundary | kept | cut | 4 |
| no. | boundary | kept | cut | 4 |
| No. | boundary | kept | cut | 4 |
| defence. | boundary | cut | kept | 3 |
| ext. | no boundary | kept | cut | 2 |
| Gov. | no boundary | kept | cut | 2 |
| Sun. | no boundary | kept | cut | 2 |
| Mon. | no boundary | kept | cut | 2 |
| Reps. | no boundary | kept | cut | 2 |
| III. | boundary | cut | kept | 2 |
| s. | boundary | kept | cut | 2 |

**What it says.** The corpus is mostly older printed English: it rarely writes the modern abbreviations UD's web and news text uses
("Corp.", "Wed.", "Sat.", "Gov.", "Reps.", "ext."), so H leaves them to be cut. And a word a genre ends its sentences with is written with
a period in most of its uses: the Old Bailey records put "defence.", "sworn.", "acquitted.", "prosecution.", "servitude." on H's list —
the majority-of-uses test cannot tell a formulaic last word from an abbreviation. What follows the period separates some of them
(`etc.` is followed by another mark 5,776 times; `mr.` by an upper-case letter 743,614 times — as a sentence end would be), which is a
frame for the REC, not a change to this one.
