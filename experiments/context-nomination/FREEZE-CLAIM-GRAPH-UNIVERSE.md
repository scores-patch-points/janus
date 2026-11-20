# FREEZE: PREREG-CLAIM-GRAPH-UNIVERSE, written 2026-11-20T05:42:13Z, BEFORE any fresh or REUSED-DOCUMENTS read
Pre-registration: PREREG-CLAIM-GRAPH-UNIVERSE.md sha256 first 16 hex 1a37523f89f6567a (includes section 6). Constants: SEED 20261119, K10 10, HMAX 6, TAU 0.8 (swept 0.6, 1.0). Venv python 3.12 with sentence-transformers; reader English parser prior.

## code, sha256
- experiments/context-nomination/claimgraph.mjs d50f10f0533981ffc7c2e97c5fe1e98fd124a4aba9527a4b91d1628aa98e80c9
- experiments/context-nomination/ctxalias.py 3462afd1d2fed775e69f544060959d0a5decc62168fd9b34265d9ec5a07ecab0
- experiments/context-nomination/test_guard_alias.py 302c976710734a1fa7dc806e8d75874ae40109a6d1dfac327d23263719e80fce
- experiments/context-nomination/ctxnom.py 95c57dfd2f71e7819d1780389e999848fcbf893c66f9d0ef3fd3c525627bbc17
- native/organs/binding-evidence.mjs 23676c223add80848f2c4b2dbda84ad7e1fc31b37a2d58b7f80557fdf699847e
- khora-pharos-reading/native/the-fold/pharos-reading.mjs f70a8187e49325bce92046a129053bcaed83996253ad690ee94c747939a074c0
- referent/zero_clean.py (imported through ctxnom.py, read only) 49fab8d8d63823daef8e6b0a207e81136154eacf679d4f26d2bda5258e0a8f1f
- referent/lib.py (imported through ctxnom.py, read only) bd3fd75a2f4bf4a7fdd9db16b6baa54ef142ff2effce583f53321af6f6ad9ac0
- referent/score.py (imported through ctxnom.py, read only) 061cf1e1c03f0d503c76cd002c64108c07bc8e00dc38a734300ca910fa6e2a1a
- all-MiniLM-L6-v2 model.safetensors 675124690d56e46f07b91be24721b00328dcf35c9962067d94d2894dc6970402

## DEV (debugging only, numbers not claimed)
- dev-queries.json 183a7074d4ae47d6c4863acb6bfd8dfe85b7486b77a2170bdcfe309edbce55e4; cg-dev.json c2d021804c993c93814e41f4ed413e28e0c97435d92bc6c0f74c6af6e09820e4; census: aliasgold.py (mention level 309 alias pairs, 106 disjoint) and class level 250 / 89

Any change after a fresh read is an erratum. A second scoring of the same documents is REUSED.
