# DATA: GAP coreference (downloaded 2026-11-20 with the owner's word "you may download"; NOT yet used by any arm)
Source: https://github.com/google-research-datasets/gap-coreference (Apache-2.0, last pushed 2020-11-10), files fetched from raw.githubusercontent.com master. Sizes checked against the GitHub API before download and equal after. Stored untrusted in `~/Documents/janus-experiments/gap-raw/` (own empty directory); no code from the repository was run.
| file | rows | bytes | sha256 (first 16) |
|---|---|---|---|
| gap-development.tsv | 2000 | 1080993 | b9a01434fcf58d8c |
| gap-validation.tsv | 454 | 245089 | 2d784f66b390404f |
| gap-test.tsv | 2000 | 1075889 | 1c35e36d5b14f631 |
Columns: ID, Text, Pronoun, Pronoun-offset, A, A-offset, A-coref, B, B-offset, B-coref, URL (Wikipedia passages; gold says whether the pronoun refers to A, to B, or to neither). Use: the document holds the evidence for pronoun binding (REFERENT-FIRST rule 4). Declared split before any use: gap-development = DEV (debug), gap-validation = a second DEV set, gap-test = READ ONCE under a frozen, stamped code. Rule 11 applies: the text goes through the codec to EOT (eotgraph-style extraction), no surface matching. A pre-registration is required before any arm is scored.
