# FREEZE of ADDENDUM-4 (the same frozen arms on documents parsed into EOT), written 2026-11-20T06:17:59Z. The EOT arms were run once on DEV as a debugging run AFTER the stamp 207eef4b0b96094f; no fresh read.
- experiments/context-nomination/eotgraph.mjs 10a37490d5425cc365c965212c93922a5fb9f2f192e081dadb2b609a9ea61ec2
- experiments/context-nomination/ctxeot.py c910aeb1083874d17a8e3b8d1a9b86a4367a7cb069ef72c1e1808c0a8445d6a7
- experiments/context-nomination/eot_law.py 76afac0424f1f3bef9acbdb6b4d3d812fb1d5bfbbd9488e20c7d59411f0ce629
- experiments/context-nomination/kinds.mjs d935408a238d4d2e51e4b5b09b615355603e01976176da0eba84b0df4047f798
- experiments/context-nomination/ctxvoid.py 11d46aa9f6fdefa1df6bc460b01b0a03ec4197ba43565c02866bfac8f5e0c48f
- experiments/context-nomination/ctxadmit.py 327bd01dd729800131e7e9b69cc4134bf6c4a7680bff6b86c4050bfccf580a92
- experiments/context-nomination/test_guard_alias.py 4c85f2b66f427938f2880b0f2c89d557abc564d68bca0da8720962e0322c9f6c
- native/organs/nl-eot.mjs abaf6134328b95d7e58d0163bf4e13136afb54cd6cf6609ff9c8a6debcf115b1
- khora kernel/eot-rich.js (checkout 65e75da) a400ae159e3b5b3e995838bd97333700e9f15cd01b5add973ef7e44f14077136
- eot-dev.json 90eb614a90c70475b3afda72f4ac99e5bfca0f183fee8ff103843ffca1d26576

## DEV, EOT-level debugging run (NOT claimed; gold: DISJOINT 184 on the content-lemma classes, was 178)
A0 0.413 (was 0.483 on surface anchors); VG 0.386 (0.376); VGB 0.163 (0.152); VGR 0.288 (0.281); NG 0.370 (0.360); ADJF 0.299 (0.270); T_VG 0.114 (0.124); VG equals VG_RAND to three decimals and grew past its own sentences for 8 of 479 queries (5 of 416); bindings still widen reach to ~93 classes per query and lower recall; admits: A0A 0.370 vs A0 0.413, kinds placed 60% with median largest-kind share 0.65 (was 1.00), 28 of 274 gold pairs refused (0.10), K1 K2 K3 HIT, K4 not hit. EOT parsing alone did not change the picture of ADDENDA 1 to 3.
Commands: node eotgraph.mjs <docs> eot-<set>.json <eotdocs-dir> [lang]; node kinds.mjs eot-<set>.json eotkinds-<set>.json; python ctxeot.py void eot-<set>.json out.json; python ctxeot.py admit eot-<set>.json eotkinds-<set>.json out.json
