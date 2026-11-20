# FREEZE: PREREG-PRIOR-COLLAPSE (stamp 6f8682ee607233e7), written 2026-11-20T19:08:36Z, BEFORE any table is mined or any token scored
Constants (labelled): add-one smoothing; margins swept 0 0.5 1 2 3 4; C3 gap 5 points; twin = relation labels permuted by (i*7+3) mod R. Command: node priorcollapse.mjs <stanza.json> 'LinES:<file>|LinES+ParTUT' 'ParTUT:<file>|LinES+ParTUT' 'EWTdev:<file>|EWTdev' 'GUMdev:<file>|GUMdev'
- experiments/parse/priorcollapse.mjs d3862a272ade40fd52ee4d8ac2e257bee845fd25e1cf8ce20a6d8b5b2e3d473f
- experiments/parse/priorlib.mjs bfb0f07bf91753b2e7c69292f75cd5441e640abece10b577c6706162fd04f15b
- experiments/parse/test_prior.mjs 4a916b5caeda4f0236e86c1a150fad9d6eb1621e9dbd2efdb84753e959cc6b5e
- experiments/parse/parselib.mjs 649981fb80e1a3249ed2a52b55887cd6cccf6cc994ba35aad3d3775323deea05
- stanza-fresh.json 7e032c8fcba81e97b0c4e74dfedf9225c0dcb296eaa2ecfab134774340ea047f
- stanza-dev.json 8aa88a329dd5c6893a536bd6b125641e885ee659caf093da4fafd3280356f062
Priors are mined from EWT train + GUM train only (hashes in FREEZE-PARSE-ENGLISH-LAYERS.md). LinES and ParTUT are REUSED sets; EWT dev and GUM dev are DEV (Stanza possibly contaminated). One run; any change after it is an erratum.
