# "Trim this clip", "make the pacing better": reading an edit request without a model (2026-11-27, exploratory THEORY)

Status: a prototype of the reading half only (`native/organs/edit-intent.mjs`, `edit-propose.mjs`, 11 tests). **It edits nothing.** Slate (the editor repo) was not reachable from this session (`scores-patch-points/slate`: no access), so no part of this has touched Slate, a timeline, or a recording. The word timings in the tests are synthetic.

## The path (rule 11: language goes through its codec to EOT)
sentence -> `nl-eot.mjs read` (the English UD codec) -> EOT record -> `intentOf` reads only STRUCTURE: the root verb, its `obj` and `xcomp` arcs, a determiner marker's `PronType`, an adjective's `Degree`. The verb's meaning is a lookup in the VerbNet act prior (Zenodotus act-priors; every candidate kept, `contested` stays contested). No string is matched, no regex.

## What the reading says about each request (real reader, real prior)
| request | result | why |
|---|---|---|
| Trim this clip. | `needs_params` remove_span, theme clip, bound to the selection | the prior is contested for *trim*; one of its classes (wipe_manner) is a removal; **which span** is not in the sentence |
| Remove the silence at the start. | `needs_params` remove_span (prior unanimous), anchor "start" carried | the span is still open |
| Shorten this clip. | `needs_params` change_state | needs a target |
| Cut the pause after the second sentence. | `ambiguous` change_state / remove_span / split | *cut* has six classes; reported, not chosen |
| Make the pacing better. | `gap: no_criterion` | a resultative ("better"); nothing declares what better pacing is |

So the honest answer to "can it do 'make the pacing better'": **not as an edit.** It becomes executable only when a person DEFINES a criterion. `pacingProposals` shows one candidate: "better" = fewer gaps above the material's own Tukey fence (Q3 + 1.5 IQR of its own gap distribution), each shortened to the median gap. That is a proposal with its measured saving (on synthetic words: the one 2.0 s hole saves 1.8 s; uniform pauses give no proposal, a recorded negative). "Trim this clip" similarly gets a proposal from the clip's own speech timing (`trimProposal`: silent head and tail, padded by the clip's own median gap).

## Findings against the reader (kept, with falsifiers)
- Sentence-initial imperatives are read badly: "Trim that clip." gives Trim=PROPN, clip=VERB; "Tighten this clip." Trim=PROPN. 10 of my 14 phrasings have a root verb (exploratory, one parser prior). Lower-case or "Please ..." read. Falsifier: a reader that tags the imperative gives 14 of 14. This is the reader's (khora's) defect, not this layer's: the layer answers `no_predicate` and does not guess.
- "that clip": *that* is tagged SCONJ with no PronType, so its deixis is lost; the layer does not bind it.
- `EDIT_CLASSES` (VerbNet class -> editing primitive) is the one hand-authored table, 9 rows, each with its reason; it is a claim for the owner to review, not a measurement.

## Proposed contract with Slate (NOT built; no kind is declared)
janus writes `edit-intent` (CON·Figure, of the utterance) and `edit-proposal` (SEG·Figure, of the intent, with its measured effect); a PERSON's acceptance is a DEF (`edit-accept`, DEF·Figure, written by whoever speaks for the user); Slate reads accepted proposals by kind and writes `placement` entries; Proteus/Premiere follow (proteus `docs/PREMIERE.md`). Observing is not defining: janus never writes the DEF.

## Not measured
Real audio or transcripts; any editor; other languages (a language with no codec is a typed gap); spoken input (this reads typed text); accuracy against human edits; whether editors would accept the proposed criterion.

## Correction and incident, 2026-11-27 (falsification, then the owner's steer)
- **Falsified:** the layer silently dropped negation, questions, coordination, a constraint clause and a sequencing adverb ("Never delete this clip." read as a delete; "Should I trim this clip?" read as a trim). On the 24 short human turns in the real transcripts (`scratchpad/edit-transcripts/`, unique, <=300 chars, exploratory) it produced **no `ready` and no usable `needs_params` intent** (one `needs_params` was a garbled fragment); most real requests are goals ("we need corruption in there as many times as possible"), content directions, or terse fragments, not bare imperatives.
- **Fixed:** negation is now read as the nexus already reads it (UD `Polarity=Neg` or `PronType=Neg`, as in khora `negation-read.js`; this finds "never" too): a negator of the root verb makes a **prohibition** (`polarity: "-"`, not an edit); everything else it does not consume is a typed gap. Questions are only caught by a stand-in (a subject on the verb): the solved reader (khora `question-grammar.en.js`, `wh-role.mjs`, `ask.mjs`) is **not reachable by kind**: nothing weaves it, and it reads the trailing "?" off the text, which an EOT record does not carry.
- **My earlier claim was wrong:** I wrote that "'never' carries no Polarity in this reader"; true of `Polarity`, but it carries `PronType=Neg`, which I did not check because my probe filtered on three feature names.
- **Why it was missed:** see `native/organs/capability-index.json` and `capability-guard.test.mjs`.
