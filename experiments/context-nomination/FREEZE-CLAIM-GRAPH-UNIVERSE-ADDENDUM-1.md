# FREEZE of ADDENDUM-1 (the full-graph arms), written 2026-11-20T05:48:00Z, BEFORE any fresh or REUSED-DOCUMENTS read
ADDENDUM-1 stamp 29ce09fac21d8a0d (parent 1a37523f89f6567a unchanged). Constants: SEED 20261119, K10 10, HMAXF 8, TAU 0.8 (swept 0.6, 1.0). The parent's freeze file lists the other dependencies; test_guard_alias.py was extended and is re-hashed here.
- experiments/context-nomination/fullgraph.mjs 375bad3f1d9570085c8022736b2a17565d89d68ef9511bd1bb65a7b17e5c2cef
- experiments/context-nomination/ctxfull.py 0c474489f96a638a9cc1bc9b39dfc04ea032732b1d62ed50369ad8c4b5e1803a
- experiments/context-nomination/ctxalias.py 3462afd1d2fed775e69f544060959d0a5decc62168fd9b34265d9ec5a07ecab0
- experiments/context-nomination/claimgraph.mjs d50f10f0533981ffc7c2e97c5fe1e98fd124a4aba9527a4b91d1628aa98e80c9
- experiments/context-nomination/test_guard_alias.py 7d08cff2756377960b1d585f6f8927c2bddaaf544d9d73319a1ffc8ead848823
- fg-dev.json 63b29625e55cfa46835a04cc5e21320f3d497e94dc8b0429e1e5c967d3d1d101

## DEV: one debugging run of the full-graph arms (after the addendum stamp). NOT claimed. Recorded so the fresh read is not the first look:
FG (all connections, lemma handle) DISJOINT 0.124 vs bare anchor A0 0.483, adjacency 0.270, T_FG 0.079, FLATF 0.112; FG_NOLEM (anchor-class merge only) 0.360; universe median 159 sentences: the lemma handle makes hub nouns connect everything, and the stopping rule (top-10 stability) did not bound it. FG_NOLEM was compared to FG's twin size, not its own: a gap in the registered controls, to be handled in a further addendum before any fresh read.

Any change after a fresh read is an erratum.
