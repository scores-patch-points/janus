# FREEZE: PREREG-ANT-COLONY-SURPRISE (stamp 8465cb986b159817) and ADDENDUM-1 (stamp 7f5fe2ea1e0dfbb9), written 2026-11-20T18:16:55Z, BEFORE the full run
Constants (all labelled ARBITRARY in the pre-registration): MIN 20, DEPTH 4, STOP 0.25, EXPLORE 0.35, CAP 300, alpha 1. Budget: ROUNDS 8 x ANTS 24 = 192 programs per run; seeds 20261119 to 20261123 (ANT, ANT_NOGUARD, RAND) and the first three (ANT_CONF, RAND_CONF). Command: node colony.mjs <EWT train> <EWT dev> <GUM dev> (defaults). A smoke run at 1 seed, 1 round, 4 ants was used for debugging (numbers not claimed).

## code, sha256
- experiments/ants/colony.mjs 86151fc78826081f4128d97eae7f0726ad657e0412bf5abaecb1736d2621936d
- experiments/ants/antlib.mjs cefaa17052f96af5b28bf0e7c643d170128ca7d5c0a6efffaa2ef4869cc619b0
- experiments/ants/test_ants.mjs 18619f3fa935f0fdd98bfb87fc85ec2bf2e3a134fd2490911a563d419b6a5e4c
- native/organs/segmentation-surprise.mjs 2ad402ab8c4d14866b8a89987e5d2f20ced3e060f9ba79185fb39a0e494f0496
- experiments/parse/parselib.mjs 649981fb80e1a3249ed2a52b55887cd6cccf6cc994ba35aad3d3775323deea05
- khora kernel/stigmergy.js (checkout 65e75da, IMPORTED, never edited) 999d7af8df83216a96d6170af947ba353f930f4d105d1e6a5a0ebd35ead5c1dc
- khora adapters/text/ud-parser.js 6e59aa06b84d433d318bacf02f39ebf2712ed05420bd9a44c68802e1b59bae20
- khora adapters/text/ud-tokenizer.js e39934a0b1d500f3f89762643e6c51e5f4a6571efa32f3a05903cb4905bb0dbd
- pooled English parser (its tagger scores the confidence) 0d3e24e81f7159f7899f8a03a85372e743eba504d6c0ee53d51e3958d69e61f3

## data, sha256 (only the raw sentence text is read, plus gold tokens by goldF1 on EWT dev)
- en_ewt-ud-train.conllu 6fe5692f2e02198262483daba0626efe346dd19f0ce6c3ee7728b08af9b90a9c
- en_ewt-ud-dev.conllu de507882611c54f19934f9a65d654b37f55a5c315da1794b9f13348b28b39c12
- en_gum-ud-dev.conllu (non-commercial: numbers only) ed955aa38fe62d3c2670701ef92dd577608a9a10c5ee452e6990dc3d1fe3c7ce

The TEST files are untouched. Nothing is written to any log by this harness. Any change after the run is an addendum stamped before a fresh read.
