# The dotted share — pre-registration (frozen 2026-10-25, before any arm is scored)

**Question.** The reader keeps a word's period whole at the sentence cut ("etc.", "Inc.", "Dr.") when it knows the word is written
with its period. Today that knowledge is Wiktionary's list of dotted headwords (janus `priors/dotted-eng.json` at `7b185180`, 2,571
words). Does a list *measured from the hyperlexicon's own corpus* — how the 60,841 Zenodotus documents actually write each word — cut
gold English sentences at least as well?

**What is counted (S6, `s6_dotted.py`).** For every token in every byte-addressed document of the v1 log (head `fa9add32`), in the
document's working language: is the byte straight after the token a period, and if so (and it is not an ellipsis) what follows it —
lower-case letter, upper-case letter, digit, other mark, or the end of the line. `n` is the type's uses in that language (L1's exact
type–document counts); `d` the uses written with a period. Nothing is sampled.

**Rule H (frozen).** A type `t` (letters only, at most 12 characters, as Wiktionary's list was cut) is a dotted word of language `L` when,
over its uses in `L` documents, `d` of `n` passes a one-sided exact binomial test of `d/n > 1/2` at `alpha = 0.01`: the corpus writes it
with its period in most of its uses, beyond chance. Single-dot forms only; a dotted initialism ("U.S.") is the text's own
(`spans.js::deriveAbbreviations`). No hand list, no frequency floor beyond what the test itself needs.

**Arms.** `0` no dotted list · `W` Wiktionary's list (`7b185180`) · `H` the list Rule H yields. In every arm the measured punctuation
prior (`priors/punctuation-eng.json`) and the text's own abbreviations are the same; only `priors.dotted` differs, read through khora's
own `abbreviationsFor` and `splitSentences` with its per-text bare-use test.

**Material.** UD English EWT, GUM, LinES, ParTUT and PUD, every split, documents rebuilt from `# newdoc` / `# newpar` and SpaceAfter.
A *junction* is a token of letters followed by a period, white space and more text. At each junction the gold says whether a sentence
ends there.

**Score.** For each arm, the junctions where its cut disagrees with the gold (`errors`). Improvement over no list: `gain = errors_0 −
errors_arm`.

**Bars (decided now).**
- **B1** `gain_H ≥ gain_W`, all five treebanks pooled.
- **B2** `gain_H > 0`.
- Reported, not gating: per-treebank gains, and the junctions where H and W differ.

**Decision.** H replaces W as `priors/dotted-eng.json` only if B1 and B2 both hold. If either fails, W stays, the result is recorded
as failed, and the next frame is a REC — not a re-tuned alpha.

**Known limits, stated now.** The measured punctuation prior was learnt from EWT's training split, so EWT favours every arm equally.
The corpus is mostly older printed English (Gutenberg-heavy); words whose spelling changed ("Mr" in British print) may read as
undotted. UD's own text is web and news English.

## Amendment 1 (2026-10-25, before any arm is scored)

A 300-document smoke run of S6 counted, as the word's period, a period followed straight by a letter or digit: code and web text
(`nn.Module`, `tf.keras`, `jnp.array`, `www.`) put `nn.`, `tf.`, `keras.`, `jnp.` at the top of Rule H's list. The reader's question is a
*junction*: letters, a period, then white space. So a period followed directly by a letter or digit is inside a longer written form,
not the word's period: S6 counts it apart (column `inner`) and not in `d`, as it already did for an ellipsis. Rule H, the arms, the
material, the score and the bars are unchanged.
