# The dotted share, frame 2 (H2) — pre-registration (frozen 2026-10-25, before H2's list is computed or any arm is scored)

**Why a new frame.** Frame 1 (DOTTED-PREREG.md) failed B1: a list of the words the corpus writes with their period in most uses
gained 81 junctions on UD English gold against Wiktionary's 125 (DOTTED-RESULT.md). It kept a genre's formulaic last words
("defence.", "acquitted.") and lacked the modern abbreviations the older corpus rarely writes ("Corp.", "Wed."). This frame is the REC
the user chose: hyperlexicon only, no Wiktionary; a dotted word must also be followed, after its period, by something that does not
look like a sentence start as often as the corpus's own periods are; titles — whose period is followed by a name, as a sentence end
is followed by a capital — come from the measured treebank prior.

**Inputs.** S6's counts (`<log>/use/dotted.tsv.gz`, head `fa9add32`, s6 `b14eca70…`, unchanged from frame 1). The treebank prior: the
`abbrev` list of `UDTokenizer@1` measured by khora's `native/scripts/train-ud-language.mjs` from UD English-EWT's **training** split
(every non-punctuation token longer than one character that ends in a period, seen at least twice).

**Rule H2 (frozen).** For English documents, a type `t` of letters only (at most 11) with `n` uses, `d` of them written with a period
straight after, and `s` of those `d` followed (after spaces) by an upper-case letter or the end of the line — "what looks like a sentence
start" — is a dotted word when both hold:
- **C1** the corpus writes it with its period in most uses: a one-sided exact binomial test of `d/n > 1/2` at `alpha = 0.01` (frame 1's test);
- **C2** what follows its period looks like a sentence start less often than what follows the corpus's own periods: a one-sided exact
  binomial test of `s/d < p0` at `alpha = 0.01`, where `p0 = Σs / Σd` over every English letters-only row of S6 — the pooled profile of
  the corpus's periods, nearly all of which end sentences. `p0` is measured, not set.
The reader's dotted set in arm H2 is the treebank prior's `abbrev` ∪ Rule H2's list. Nothing from Wiktionary.

**Arms.** `0` no dotted list · `W` Wiktionary's list (`7b185180`, the reader today) · `T` the treebank prior alone (reported) · `H2` the
treebank prior ∪ Rule H2. In every arm the measured punctuation prior (`priors/punctuation-eng.json`) and the text's own abbreviations are
the same; only `priors.dotted` differs, read through khora's `abbreviationsFor` and `splitSentences` with its bare-use test (S8).

**Material.** UD English EWT (dev and test only: its training split is the treebank prior's source), GUM, LinES, ParTUT, PUD (every
split); documents and junctions as in frame 1. Every arm, W included, is scored again on this material.

**Score.** `errors` per arm at the junctions; `gain = errors_0 − errors_arm`.

**Bars (decided now).**
- **B1** `gain_H2 ≥ gain_W`, pooled.
- **B2** `gain_H2 > 0`.
- Reported, not gating: `gain_T`, what the hyperlexicon adds over the treebank (`gain_H2 − gain_T`), per-treebank gains, and the
  junctions where H2 and W differ.

**Decision.** If B1 and B2 hold, the treebank prior ∪ Rule H2 replaces Wiktionary's list as the reader's dotted words. If B2 holds and
B1 fails, Wiktionary's list stays and the trade — a Wiktionary-free reader that cuts gold worse by the measured amount — is put to the
user, not taken here. If B2 fails, H2 failed.

**Known limits, stated now.** A title EWT's training split does not hold ("Gen.", "Col.", "Capt." if absent) is rejected by C2 and so is
cut. The corpus is older print; the treebank is web English; the gold mixes both. C2 also rejects an abbreviation that ends sentences
most of the time it is written.
