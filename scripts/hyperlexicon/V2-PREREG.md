# Hyperlexicon v2: the record of the mind being changed. Pre-registered 2026-10-25, before any v2 code runs

**Why v2.** v1 (head `fa9add32`, 13 GB) holds every use of every token (postings, 11 GB), a fast-reading copy of it (L1, 1.4 GB) and
the givers' records copied as JSON events (740 MB). That is a concordance of the content, and the content already has a home:
Zenodotus keeps the sources unchanged and byte-addressed, and v1's own T2 gate showed the postings are recomputed identically from it.
The user (2026-10-25): the hyperlexicon "is supposed to be measuring DMD, it is the record of the mind being changed", and "this isn't
about the content itself", so it should be well under 1 GB. The canon agrees: the hyperlexicon is "an explicit ledger of
relation-composition affordances: experience nominates, a named giver licenses" (khora `THE-SPINE.md`, `native/kernel/hyperlexicon.js`),
"the record of what the system has learned to recognize" (`kernel/hyperlexicon-abstraction.js`), and a re-sighting that teaches the
ledger nothing appends nothing (`kernel/notes.js`).

**What its readers need** (each a relational question, none a question about the text): the sentence cut (which written forms are words
with their period; the `names` ask, read as written: `DOTTED-PREREG-4.md`); the class fill (what the givers say a word is, for a word the
class prior cannot place; the `context` ask); HL's licenses (may two relations compose; is a relation functional, transitive,
equivalent, converse; with a giver and a standing); identity (janus `correspond`, `resolve`); and change (where a word's company has
moved, with the witnesses that moved it).

**Exploratory sizing before this frame** (not a test; `bench/dmd-size-pilot.mjs`, 150 seeded English documents, 1.2M tokens): 88 to 97%
of what the reader hears is heard once, and the number of distinct keys grows in step with the text (no saturation). Only 2 to 5% of
sightings change a standing (heard once, then corroborated by a second document). A record of first sightings is not small; a record of
changes of standing is.

## What v2 holds (four parts, one directory, one head)

1. **The givers** (given · ungrounded · undecided): the English Wiktionary pack (2026-10-01 v3) and the Spanish one (2026-10-01), walked
   as v1's S2 walks them, keeping only their relational structure: every **name** (the surface **as written**, language, node, kind
   `lemma`/`form-of`, the form it is a form of, part of speech, tags), every **relation** between nodes (syn, ant, hyper, hypo, holo,
   mero, derived, coord), every **translation link**, and per node its lemma, language, parts of speech and the tags its senses carry
   (archaic, regional …: a giver's claim about a cell). **No glosses**: definitions are the giver's content and stay in the giver's
   pack. Node ids are v1's (`n_` + sha256(lang NUL lemma)[:16]), so v1 and v2 name the same node the same way.
2. **The licenses**: the givers' relations above (standing `given`, tier `ungrounded`), and the compositions the record corroborates
   (standing `candidate`, nominated by experience). v2 gives no license itself and earns none: no consequence test runs here.
3. **The record of changes**: what the reader heard, recorded **only where a standing changed**. The instrument is khora's reader
   (`native/reading.js::readDocument`, `lexicon: false`, at the khora commit named in the build summary, priors from janus at its
   commit), reading every Zenodotus document whose ground language claim is English, whole, after its frontmatter. From each arrangement
   it hears (end1, label, end2), two keys:
   - **slot**: the head word of an end (its last word, lower-cased: English's head-final noun phrase, a declared English-scope rule), the
     label (lower-cased) and which end it fills; the company a word keeps;
   - **composition**: two distinct (label, end) pairs that share a head word in one document (sorted): the relation-composition grain
     of `kernel/hyperlexicon.js`'s affordances.

   A key's standing is `kernel/notes.js` `standingOf` over the documents that witness it (one document: `single-witness`; two:
   `corroborated`; with one instrument, `corroborated-independently` cannot occur). **A key reaches the record when its standing first
   changes**, with the two witnesses that changed it (each `document id # byte offset`: the birth and the corroboration) and its
   counters (documents and sightings, the earliest and latest dated witness). Every other sighting is a NUL: counted, not stored.
   Documents are read in **reading order**: dated documents by their P1 year, then undated documents by path.
4. **The ground**: v1's S0, unchanged: one event per document and one claim per thing it says about itself (frontmatter fields, header
   language, folder placement, zen-index and date-ant dates, the P1 resolution), each with its basis.

Plus **counters** for the `context` ask: per corpus type (lower-cased, v1's token rule), its uses, documents, dated uses and dated span,
kept for the types that a giver names in some language or that a record key holds. A type that is in neither makes no difference to
any reader of the hyperlexicon; it is counted in the summary, not stored.

**Not in v2:** postings, L1, the vocabulary of every type, glosses. The door answers the asks that need postings (`uses`, `company`,
`along`, `after`, `reopen`, `nodes`, `dotted`) with a typed gap naming v1, which stays published (release `v1-fa9add32`).

## Bars (fixed here)

| Bar | Test | Bar |
|---|---|---|
| **Z1 size** | Bytes on disk of everything the v2 directory holds (what the door opens, the record, the ground, the manifest) | < 1,000,000,000 |
| **G1 givers' names, as written** | 2,000 seeded surfaces (seed 1) drawn from the packs' headwords and form-of names: v2's `names` answer (`written`: node, kind, of, pos) equals what the pack itself gives for that exact surface (Zenodotus `scripts/wiktionary/lookup.mjs`, `resolve(form, { learn: false })`, the same node-id rule) | exact, 2,000 of 2,000 |
| **R1 serves the cut** | the dotted-words list read from v2's names as written (`build-dotted-priors.mjs`, frame 4's rule) equals `priors/dotted-eng.json` (frame 4's 2,571 forms) as a set, and cuts UD English gold (`s8_dotted_gold.mjs`) with the same errors | identical set; 531 errors |
| **R2 serves the class fill** | 2,000 seeded corpus types with an English candidate: v2's `context` candidates for `lang: en` (node, kind, parts of speech) equal those the pack gives for the lower-cased type | exact, 2,000 of 2,000 |
| **C1 counters** | 50 seeded stored types: uses and documents equal an independent count over the Zenodotus files with v1's token rule | exact |
| **D1 determinism** | the givers, the ground and the counters rebuilt give byte-identical files; 50 seeded documents re-read give byte-identical sightings | identical |
| **W1 witnesses** | 2,000 seeded record witnesses: the document still hashes to its ground sha256, and re-reading it yields the key at that byte offset | 2,000 of 2,000 |

**Reported, no bar (the DMD question).** For every corroborated key, the distance in reading order (documents) between its birth and its
corroboration. With khora `kernel/activation.js` `dmdWindow` (derive = the record's set of corroborated keys; candidate depths 1, 2, 4,
… doubling to the number of documents read; restrict = a first sighting is remembered for `depth` documents), the shallowest depth that
reproduces the whole record exactly, or the typed gap `reach_exceeds_candidates`. This says whether a builder that forgets first
sightings at a measured depth would keep every change of standing, or whether a later frame must hold them longer.

A failed bar is recorded with its cause; the fix is a new build with its own head, and the failed build stays on record. The result is
published either way, with the size of each part.

## Not claimed

That any record entry is a true relation (corroboration is two documents, not a test); any earned or refuted standing (that is HL's and
janus's consequence test, a later stage); change of company across time, place or whom (the counters carry dated spans; drift is a
later, separately pre-registered stage over this record); any language but English in the record (other languages' documents are a
typed gap, `no_reader_record`); the reader's quality (its arrangements are what it heard, nothing more).

## Amendment 1 (2026-10-25, before any v2 run; the smoke on three documents showed the reader's cost)

The reader costs about 6 to 11 KB of text a second a core and about 0.8 KB of heap a character, and the English documents are about
1.3 GB (123 of them over 1 MB, 196 MB in all, some 5 to 8 MB). Part 3's "reading every English document, whole" becomes: **a document longer
than 1,000,000 characters is read in consecutive parts, each cut at the last blank line before 1,000,000 characters (else at 1,000,000)**;
an arrangement is heard inside one part (a reference that crosses a part is a reference the reader does not make), and every byte offset
is still into the whole Zenodotus file. Documents of 1,000,000 characters or fewer are read whole, as pre-registered. Nothing else
changes: the bars above are unchanged.

## Amendment 2 (2026-10-25, before any v2 result; the checker is being written)

**R2**: v2's `context` returns, for a lower-cased type, the candidates of every headword that folds to it ("Polish" and "polish" are one
folded form). The bar compares the candidates **whose surface is exactly the lower-cased type** with what the pack gives for that exact
headword (`resolve(type)`): node, kind and the set of parts of speech, equal. The candidates of other casings are the case-fold's own
extras; their number is reported with the result and no bar rides on it. **G1** is as written: the exact surface.
**C1** counts with a second program (a plain scan over every Zenodotus file for the 50 types, v1's token rule), not counts.py itself.
**W1** re-reads the documents of the 2,000 sampled witnesses with `v2/read.mjs` and compares the key and byte offset it writes.
