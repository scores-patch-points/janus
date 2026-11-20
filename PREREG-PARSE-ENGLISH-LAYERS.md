# PREREG: how well can we parse English, and does a codec COMPUTED from several sources beat a discrete one? (frozen before any model of this experiment is trained or scored; nothing run)
Written 2026-11-20 by the Janus session at its user's direction ("keep trying to prove that we can parse English as good as possible"). Context: codec-for.mjs (REFERENT-FIRST rule 12) now holds two English sources, UD_English-EWT (web) and UD_English-GUM (multi-genre, licence CC BY-NC-SA 4.0: vendored on this machine, never committed). Stamp: sha256 first 16 hex in PREREG-PARSE-ENGLISH-LAYERS.md.sha256short.

## 0. What the earlier numbers do and do not say
The existing EWT prior (priors/ud-parser-eng-ewt.json.gz) was trained on 12,544 sentences with a UniMorph lexicon and scored UPOS 94.3, UAS 84.5, LAS 81.4 on a 2,077-sentence test file (priors/ud-codecs.json hash d68e0612... for its training file). The GUM prior I trained today used 8,000 of 11,314 sentences, no lexicon, and scored UPOS 95.9, UAS 83.5, LAS 79.3 on GUM's dev file. Different recipe, different data, different test set: they are NOT comparable and are REFERENCE numbers only. The local EWT copy at ~/Documents/data/ud/en_ewt has a training file hash (6fe5692f...) different from the registry's (d68e0612...): the data used here is the local copy, its hashes are frozen below, and the registry's hash is not assumed to describe it. No English UniMorph lexicon is on this machine (fra, spa and others are), so NO model here uses a lexicon.

## 1. Models, all trained with ONE recipe (native/scripts/train-ud-language.mjs of khora: Zhang-Nivre features, dynamic oracle, jackknifed tags, 10 iterations, no lexicon, no cluster prior, cap = every training sentence, prune 1, seed from the treebank and file hash)
- M_EWT: trained on the local EWT train file. M_GUM: trained on GUM train. M_POOL: trained on EWT train followed by GUM train (a directory UD_English-POOL whose train file is their concatenation; its dev and test files are never used for any claim).
- Computed arms (nothing retrained): BLEND = the uniform weight average (0.5, 0.5, the codec-for default when no context is known) of M_EWT and M_GUM, tagger and parser tables, classes aligned by NAME (a feature absent from one model counts as weight 0 in it). BLEND_W25 and BLEND_W75 (0.25/0.75 and 0.75/0.25) are a sweep REPORTED, never primary. ENS_MBR = for each sentence, the candidate analysis among {M_EWT, M_GUM, M_POOL} that agrees most (heads and labels, summed) with the other two (minimum Bayes risk); ties go to M_POOL.
- Strings-only twin of the blend (rule 3): BLEND_PERM = M_EWT averaged (0.5, 0.5) with M_GUM whose feature weight vectors are permuted among the feature keys (seeded), tagger and parser: the same weights, the association between feature and weight destroyed.
- VARIETY_ORACLE = M_EWT on EWT text and M_GUM on GUM text (what codecFor does when the variety is declared). Reference rows (not in falsifiers): the shipped EWT prior and today's GUM prior.

## 2. Evaluation
Gold tokenization is given to every model (the experiment measures tagging, attachment and labelling, not tokenizing). Metrics: UPOS accuracy, UAS, LAS, punctuation excluded (as the trainer reports). Sets: EWT-test (2,077 sentences, 316 documents) and GUM-test (1,464 sentences, 30 documents), local files hashed below. Bootstrap by DOCUMENT (newdoc id), 2,000 resamples, seed 20261119; a difference counts only with an interval above 0 and a size of at least 0.5 LAS points. DEV (debugging only, numbers not claimed) = the dev files of both treebanks; TEST files are read ONCE under a freeze file.

## 3. Falsifiers, written first (all on LAS; each judged on both test sets)
- P1: M_POOL does not beat the in-domain single model on its own corpus (pooling adds nothing even at home).
- P2: M_POOL does not beat the out-of-domain single model on each corpus (M_EWT on GUM text, M_GUM on EWT text): pooling does not even fix the mismatch.
- P3: BLEND does not beat the mean LAS of M_EWT and M_GUM on that corpus (a computed codec with NO context is not better than picking one source at random).
- P4: BLEND does not beat BLEND_PERM (the association between feature and weight is decoration; nothing was learned that a permutation keeps).
- P5: BLEND loses more than 0.5 LAS to the in-domain single model on either corpus (the blend costs at home).
- P6: ENS_MBR does not beat the best single model on that corpus.
- Reported, not falsified: VARIETY_ORACLE against M_POOL and against BLEND; the weight sweep; training cost (minutes) against the blend's cost (seconds); per-document spread.
- Reading rule: the headline is the macro-average LAS over the two test sets per arm. If P1 and P2 are NOT hit, pooled training is the way to a better English parser at the price of retraining. If P3 and P4 are NOT hit and P5 is NOT hit, a computed codec (blend, no retraining) is earning its place. A hit names what failed. No claim beyond English, this parser family and these two treebanks.

## 4. Levers for later addenda (not in this run; each needs its own stamp before it is scored)
A lexicon for English (none on this machine: a download I would name first), beam search (the parser supports k-best), more iterations, richer features, a Brown-cluster prior, and any neural parser (a different family, a model: it would be a nominator under the standing rule, never a judge).

## 5. Discipline
Stamp before training or scoring; one freeze file with hashes of code, data and models before the TEST read; the TEST files are read once; a second scoring is REUSED. Ask before any download or push. No regex, no word list, no model judging, in the harness.
