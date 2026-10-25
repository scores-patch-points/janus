# The dotted share, frame 2 (H2) — result (scored 2026-10-25 under DOTTED-PREREG-2.md, frozen at 7a50c41)

**B1 FAILS, B2 holds.** The Wiktionary-free reader (the treebank prior ∪ Rule H2) cuts UD English gold better than no list (gain
31) but worse than Wiktionary's list (gain 51): 420 errors against 400 over 20,080 junctions. As
pre-registered, Wiktionary's list stays and the trade is put to the user.

| | value |
|---|---|
| Rule H2 (English) | p0 = 0.8279 (measured: that share of the corpus's own periods is followed by a capital or a line end); 307 words kept; 748 rejected by C2 |
| treebank prior | 60 abbreviations measured from UD English-EWT's training split (khora `train-ud-language.mjs`, UDTokenizer@1) |
| junctions scored | 20,080 (EWT's training split left out) |
| errors: none · W · T · H2 | 451 · 400 · 420 · 420 |
| gain: W · T · H2 | 51 · 31 · 31 |
| what the hyperlexicon adds over the treebank | 0 pooled |
| **B1** gain_H2 ≥ gain_W | **FAIL** |
| **B2** gain_H2 > 0 | **pass** |

| treebank | junctions | err 0 | err W | err T | err H2 | gain W | gain T | gain H2 |
|---|---|---|---|---|---|---|---|---|
| EWT | 1,860 | 45 | 28 | 34 | 37 | 17 | 11 | 8 |
| GUM | 10,894 | 238 | 210 | 221 | 217 | 28 | 17 | 21 |
| LinES | 4,978 | 157 | 156 | 159 | 159 | 1 | -2 | -2 |
| ParTUT | 1,794 | 0 | 1 | 1 | 1 | -1 | -1 | -1 |
| PUD | 554 | 11 | 5 | 5 | 6 | 6 | 6 | 5 |

**Where W and H2 differ** (the 16 commonest of 36):

| form | gold | W | H2 | n |
|---|---|---|---|---|
| sun. | boundary | cut | kept | 3 |
| Capt. | no boundary | kept | cut | 2 |
| Mlle. | no boundary | kept | cut | 2 |
| div. | no boundary | kept | cut | 2 |
| val. | boundary | cut | kept | 1 |
| ext. | no boundary | kept | cut | 1 |
| VII. | boundary | cut | kept | 1 |
| Govt. | boundary | cut | kept | 1 |
| PVT. | no boundary | kept | cut | 1 |
| PS. | no boundary | kept | cut | 1 |
| Drs. | no boundary | kept | cut | 1 |
| Blvd. | no boundary | kept | cut | 1 |
| Wa. | boundary | kept | cut | 1 |
| K. | no boundary | kept | cut | 1 |
| voc. | no boundary | kept | cut | 1 |
| Assoc. | no boundary | kept | cut | 1 |

**What it says.** C2 did its work on the corpus: the Old Bailey's last words ("defence.", "acquitted.", "prosecution.") and the titles
fall out (the titles' periods are followed by a capital, as a sentence end's are), and the titles come back from the treebank. But on
gold the corpus list adds nothing over the treebank's 60 forms: the abbreviations UD's web and news English uses and the treebank's
training split lacks ("Capt.", "Mlle.", "Drs.", "Blvd.", "Assoc.", "ext.") are in neither the treebank nor the older corpus — only in
Wiktionary. H2 is right where W is wrong on a dotted headword used as a sentence's last word ("sun.", "Govt.", Roman numerals).

**A fault in the first scoring, kept.** The first run read the UDTokenizer@1 prior's `words` (its 4 elisions) instead of its `abbrev`
(S8's list reader took `words` before `abbrev`): T had 4 words and gained 0, H2 gained 19. That run is kept as
`DOTTED-RESULT-2-first-run-wrong-field.json`; the reader was fixed to match the frozen text (T is the `abbrev` list) and scored once
more. Neither run passes B1.
