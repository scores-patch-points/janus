# What it means to read, to reason, to decide (and where an edit request falls), 2026-11-27

Grounded in the repos' own documents, gathered by a read-only pass (notes: `scratchpad/read-reason-decide-sources.md`). **Citations below were NOT all checked**: I spot-checked 4 of about 20 (REFERENT-FIRST.md:13, BRIEF.md:9, pharos cells.json modes, PROPOSAL-WRITER-PHASEPOSTS.md header: exact; one cited line, REFERENT-FIRST.md:5, does not say what it was cited for). Sections marked INFERENCE are mine.

## What the documents say
- **Reading (khora)** = meeting anything, finding its codec by surprise reduction, decoding to EOT, (transforming), encoding back (`reading-standard.mjs` R1-R6). What it writes is a **nomination** ("the labels are nominations by the parser prior, not definitions"): Existence and Structure cells only, never DEF/EVA/REC. A language it cannot read is a typed gap; a pronoun resolves to an admitted referent **or abstains**.
- **Reasoning (janus)** = "what follows from the record": it structures, leaves **evidence not conclusions** (bonds, differences, holes), keeps candidates in superposition, treats silence as a hole never as agreement, and "never convicts" (REFERENT-FIRST rule 6).
- **Deciding (penelope)** = DEF (declare a standard, with a named giver), EVA (assert that the evidence stands under it, to a tolerance), REC (revise/apply). "No model judges whether two texts say the same" (BRIEF). A corpus can refute a universal claim and never earn it. Abstention is a first-class outcome.

## The shape underneath (INFERENCE)
Three verbs, one discipline: **every step either nominates with its basis or abstains; judgement lives in one place and has an owner.** Reading reduces surprise and keeps what it could not read as gaps. Reasoning computes what follows while keeping the nominations distinct. Deciding collapses the superposition under a standard some accountable party gave. A modelless system is honest exactly when it never lets a nomination pass for a decision.

## An edit request, decomposed (what is built, what is not)
| step | verb | what | status |
|---|---|---|---|
| the words -> EOT under the sentence's codec | read | khora door -> `text`, `text-codec`, `text-reading` by kind; janus `eot-weave` -> `text-eot` (SYN·Pattern) | built, English only |
| verb, theme, "this" -> selection, act standing | reason | `edit-intent` (CON·Figure) with typed gaps | built (prototype) |
| which span? what is "tight"? | nominate from the material | `edit-propose`: the clip's own speech and gap distribution | built on synthetic timings only; not woven |
| "better pacing" = fewer outlier gaps | **decide** (DEF with a giver) | a criterion a person declares | **no kind, no cell, no writer** |
| this trim meets the criterion | decide (EVA) | EVA·Pattern has no writer ("Nothing here is built") | not built |
| a revised cut | decide (REC) | | not built |
| apply to the timeline | the editor's | Slate / Proteus -> Premiere | Proteus door built against a fake editor; Slate unreached |

## Where the documents strain (cited from the pass; each is a question for the owner)
1. **No document defines deciding an action.** "Decide" in the corpus is about *sameness* of texts and referents. Choosing among edit proposals needs a new DEF kind (proposed: `edit-accept`, written by whoever speaks for the user).
2. **Mode vs domain:** pharos `cells.json` gives each operator a mode (DEF=Differentiate, EVA=Relate, REC=Generate), yet the repos split by domain (khora, janus = Existence/Structure; penelope = Interpretation). "janus = Relate, penelope = Generate" does not match the cells they write.
3. **The rule is law in one place and draft in another:** REFERENT-FIRST states "observing is not defining" as law; the pharos proposal behind it is marked "draft, not adopted".
4. **The decision cell is empty:** EVA·Pattern (standing across independent witnesses) has no writer; janus DESIGN-EVA-PATTERN-STANDING is unbuilt.
5. **Reading is far from competent by the owner's own bar** (referent CoNLL F1 28.2 English vs 94; R3 and R4 not built), while reasoning is told to happen "in EOT".

## Falsifiers for this picture (not run)
- If, on the real edit requests in `scratchpad/edit-transcripts/`, nearly every sentence comes back `gap` or `ambiguous`, a modelless front end is not viable for how this person actually speaks; the layer should then sit behind a model that only *nominates* intents. (Measurable now: run `edit-weave` over those requests, report the status counts; no threshold is hand-set, the report is the count.)
- If the layer returns `ready` for a request a person finds under-determined, the typed-gap discipline is broken.
- If a person accepts the material's trim proposals and then reverses them at a rate no better than a strings-only baseline, the proposals carry no information.
