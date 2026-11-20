# PREREG-CONTEXT-NOMINATION: does an embedder given a meaningful spread of context nominate better than one given a bare name, and does the mechanical paraphrase add anything?
Written 2026-11-19 by the Janus session, BEFORE any run. Nothing here is measured. Owner of the data, harness and embedder environment: the Penelope session (experiments/zero-overlap/referent). The Janus machine has no embedder libraries (no torch, transformers or sentence_transformers in any Python on it), so the Janus session CANNOT run the embedder arms and did not. Stamp: sha256 of this file, first 16 hex, in PREREG-CONTEXT-NOMINATION.md.sha256short. Any change after seeing data is an ERRATUM file, never an edit.

## 1. What row 30 gave the embedder (read from senses.py and score.py, not from the ledger prose)
- EMBED-N: the query is the embedding of the bare NAME (one to three words: `model.encode([q["name"]])`), the candidates are every sentence encoded ALONE. Result on ZERO 0.276 (null 0.064, control with another target's name 0.038).
- EMBED-C: the query is the MEAN of the name-bearing sentences' vectors (an average, a blur), the candidates are the same isolated sentences, name sentences excluded. Result on ZERO 0.152.
- Neither side is a meaningful spread of information. A bare name is a handful of tokens the model has no context for; a mean of sentence vectors is the centre of a cloud, not a statement; an isolated sentence loses the neighbours that say what it is about.
- Row 30's own caveat: "one small model with the bare name as query; no other model or query form was tried." Erratum 2: the ZERO stratum is 12.1% trivial lexical variants on DEV, so EMBED-N's 0.276 is an upper bound and a ZERO-CLEAN claim needs a NEW fresh set.
- The mechanical paraphrase (khora/identity/novels/PREREG-PARAPHRASE.md, round 2): a model-free word fold. Two words are folded when their company (positive PMI over a window of +-4 words) is similar beyond what their own spread allows (cosine, robust z >= sqrt(2 ln V), the universal threshold derived from the vocabulary size, not chosen). It was built because 37 of 103 answer sentences shared no content word even by a 5-character stem. Its result is not read here; it has never been run on this task.

## 2. Senses compared (every one is a NOMINATOR: it returns a list of passages and nothing else; no verdict, no model judges)
- N0 EMBED-N: row 30's, RE-RUN in the same environment as the others (not quoted from the ledger), as the baseline.
- N1 EMBED-P (the query is a spread): the query is the referent's PARAPHRASE: a text assembled WITHOUT a model and WITHOUT regex from the document itself: the first K = 5 name-bearing sentences in document order (found by token match on the name or by khora's referents; gold links never an input), each cut by the sentence cuts khora writes (`text-cuts`), joined in order and truncated at the embedder's token limit. Candidates stay isolated sentences. This isolates the effect of the QUERY.
- N2 EMBED-X (the candidate is a spread): the query is the bare name; each candidate is embedded WITH its context: the sentence and its neighbours (window w = 3 primary: previous, itself, next; w in {1, 5} reported), the score of a window assigned to its centre sentence. This isolates the effect of the CANDIDATE context.
- N3 EMBED-PX: N1's query against N2's candidates.
- M1 FOLD (the mechanical paraphrase): the khora round-2 word fold applied to the name's tokens; a sentence's score is the surprisal-weighted count of fold-class anchors it carries, accumulated over the same window w; background text = the other documents of the same set (text only, never links), as in the khora design. Built and frozen on DEV before any fresh read.
- U1: the best embedder arm and M1 interleaved at equal size (K = 10, round robin, first K distinct), as row 30's size-matched union.
Controls, as row 30's: random-10 null; and the TARGET-SWAP control for N1, N3 and M1: the same arm built from ANOTHER target's paraphrase of the same document, which must fall near the null if the arm is tied to the referent and not to the document's topic.
Hard constraints: the paraphrase builder uses no model and no regex (set membership over tokens and the cuts' offsets); one embedder model, all-MiniLM-L6-v2, for comparability with row 30 (a second model only as a labelled exploratory arm).

## 3. Strata and data
Primary stratum: ZERO-CLEAN = gold sentences with no relation to the name after case folding, diacritic folding and the declared English plural rule (the normaliser of ERRATUM 2, declared before the run). Also reported: ZERO (row 30's), DIFFERENT, NAMEFREE. The DEV set (30 articles) may be used to BUILD and DEBUG; DEV numbers are not claimed. The scored set is a NEW never-read fresh set, read ONCE (a rescoring of the row-30 FRESH set would be REUSED and cannot support a ZERO-CLEAN claim). State the gold counts per stratum before scoring; a stratum under 30 gold passages is reported as unjudgeable. Every number carries its split label and stamp; `node gym/ledger-check.mjs` must pass.

## 4. Falsifiers, written now
F1 (context buys nothing): the best of N1, N2, N3 does not beat N0 on ZERO-CLEAN by 0.05 recall@10 with a document-bootstrap interval above 0.
F2 (topical, not referent-tied): for any arm, the TARGET-SWAP control reaches 50% or more of that arm's true recall on ZERO-CLEAN.
F3 (the mechanical paraphrase finds nothing): M1 does not exceed the random-10 null by 0.05 on ZERO-CLEAN.
F4 (the senses together are not more than the parts, row 30's F2): U1 does not beat its best member by 0.05 at equal size.
F5 (it is the query's length, not its meaning): a control query of the same length made of the document's most frequent content words, in shuffled order, reaches 50% or more of N1's recall.
F6 (cost without gain): the best arm's precision@10 is below half of N0's, so the gain is bought by returning junk.
The claim "a meaningful spread of context nominates better" stands only if F1, F2 and F5 are NOT hit for that arm. Any hit is a finding and is reported as one.

## 5. What this does NOT claim
That nomination is sameness: a nominator orders attention and Penelope's DEF, EVA and REC decide. Nothing here is cross-document, cross-language or about pronouns (links mark first mentions; pronoun binding needs a different gold). The embedder is never a judge: the ledger's row 31 found it keeps a planted contradiction as the nearest neighbour of its original 1,717 of 1,718 times.

## 6. Handoff
The Penelope session owns the harness, the data and the embedder environment, so it runs this if its user agrees. The Janus session can write the model-free paraphrase builder (set membership over the reader's rows and the sentence cuts; pure; tested) if wanted.
