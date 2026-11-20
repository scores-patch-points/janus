# FREEZE: PREREG-PARSE-ENGLISH-LAYERS, written 2026-11-20T15:38:33Z, BEFORE either TEST file is scored
Pre-registration stamp 1738c67947740fc3. Recipe for all three models: khora native/scripts/train-ud-language.mjs, --cap=100000 (every sentence), 10 iterations, no lexicon, prune 1, seed from the treebank and file hash. Bootstrap by document, 2000 resamples, seed 20261119; threshold 0.5 LAS.

## code
- experiments/parse/parselib.mjs 649981fb80e1a3249ed2a52b55887cd6cccf6cc994ba35aad3d3775323deea05
- experiments/parse/parseeval.mjs e7a89458439bb4cfae62093242dff247dc2671f79fb913981a835c0ee6c118a6
- experiments/parse/parsescore.py d604f9d7a5a67abbd5f0b4fce2d80cdf74fa037eb70742ed9dd35ac5c66b0fbf
- experiments/parse/test_parse.mjs 5473a580dab682b3f8c17e29c577756094615c615b5437b7ee84d170b67eaad7
- khora adapters/text/ud-parser.js (checkout 65e75da) 6e59aa06b84d433d318bacf02f39ebf2712ed05420bd9a44c68802e1b59bae20
- khora scripts/train-ud-language.mjs f39597ca6eecb27605b9484b3c057cf3b4d0bf014c72be186d35793b22c4b502
- khora kernel/eot-rich.js a400ae159e3b5b3e995838bd97333700e9f15cd01b5add973ef7e44f14077136

## models (trained on the TRAIN files only)
- ewt ud-parser-eng-english-ewt.json.gz a894efa21144687a93c44d58da7df5569f70e00ccd40f1063d4ff9a9bdd15b88
- gum ud-parser-eng-english-gum.json.gz b079e57e5a8ecbfaf7f49f1499a9d4fa47a7380aced616ea8e7ec7ea65b49d3a
- pool ud-parser-eng-english-pool.json.gz 0d3e24e81f7159f7899f8a03a85372e743eba504d6c0ee53d51e3958d69e61f3
- reference: priors/ud-parser-eng-ewt.json.gz 6da650f8169eac15106716a49aad90de2324c74d1335c121436cd2eab51e5dbd; eng-gum cap-8000 prior ad265ea7dd978db1a7e796361358d7389c279b18a8413db2656f92d082dbf56d

## data, sha256
- en_ewt-ud-train.conllu (local copy ~/Documents/data/ud/en_ewt) 6fe5692f2e02198262483daba0626efe346dd19f0ce6c3ee7728b08af9b90a9c
- en_ewt-ud-dev.conllu (local copy ~/Documents/data/ud/en_ewt) de507882611c54f19934f9a65d654b37f55a5c315da1794b9f13348b28b39c12
- en_ewt-ud-test.conllu (local copy ~/Documents/data/ud/en_ewt) b837531faddd54f5c89cf5259cfe5306b075556a9ff19b2271393df29c6b02f8
- en_gum-ud-train.conllu 4672bc446b6f516877b023384d2e33952bb012aca052506b197c92ddba67b78e
- en_gum-ud-dev.conllu ed955aa38fe62d3c2670701ef92dd577608a9a10c5ee452e6990dc3d1fe3c7ce
- en_gum-ud-test.conllu 40854b004a1475412c8cdd0ba9536d77e4876467238d8e035718dd33bd29c1e3

## DEV (debugging pass on both dev files, 2001 EWT and 1575 GUM sentences; NOT claimed, recorded so the TEST read is not the first look)
macro LAS: POOL 81.74; ENS_MBR 81.62; VARIETY_ORACLE 80.48; BLEND 80.25; BLEND_W75 79.99; BLEND_W25 79.57; REF_EWT_PRIOR 79.24; EWT 78.87; GUM 78.14; REF_GUM_PRIOR 76.73; BLEND_PERM 76.05. By corpus (LAS EWT-dev / GUM-dev): EWT 80.4/77.3; GUM 75.8/80.5; POOL 81.7/81.8; BLEND 80.1/80.4; BLEND_PERM 77.7/74.4; ENS_MBR 81.7/81.5. No falsifier was hit on DEV: P1 +1.23/+1.28, P2 +5.91/+4.51, P3 +1.99/+1.51, P4 +2.35/+6.06, P5 -0.35/-0.11 (blend within noise of the in-domain single), P6 +1.25/+1.03. Side observations (reported, not tested): the shipped EWT prior WITH a lexicon equals the lexicon-free retrain (LAS 80.3 vs 80.4 on EWT-dev), and GUM on all 11,314 sentences scores 80.5 on GUM-dev against 79.0 for the cap-8000 prior (more data helps).

Commands: node parseeval.mjs test out.json; python parsescore.py out.json --label TEST (venv python). The TEST files are read ONCE; a second scoring is REUSED. Any change after the read is an erratum.
