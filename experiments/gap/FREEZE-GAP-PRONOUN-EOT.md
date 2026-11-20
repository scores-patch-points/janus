# FREEZE: PREREG-GAP-PRONOUN-EOT, written 2026-11-20T14:42:52Z, BEFORE gap-test is converted, run or read
Pre-registration stamp 78a6d5b750b98ce3. Constants: SEED 20261119; bootstrap 2000 resamples by URL; no threshold other than the pre-registered ones (GP1 0.10, GP2 5%, GP3 0.02, GP6 5%). Language eng (the only codec exercised).

## code, sha256
- experiments/gap/gaprun.mjs a2296cd50285d34feb1505849a2b832866e13d0dcef4d5d1a773d892ada70e01
- experiments/gap/gapscore.py 35ca26af9ed586e8e8434b7a3c8593054a94f7729272431892f84866e106a468
- experiments/gap/gap2json.py 26619bca8fdfbc27ba838c0b5706671290ff3dd2824b52ce54bcf24987259b38
- experiments/gap/eot_law_gap.py b9c71ded67ec7d8e334f049999dff47a049a6af7bd02913fb111fa3405342b3e
- experiments/gap/test_guard_gap.py 6c4716b3d513784a2732b3750d225eeafe35905a68e10fe3ddad9d0e3e0dc2c3
- experiments/context-nomination/eot_law.py 5d753a70637d4da5b69e4ae23fb45a95239f8622382cebb8c8e0e52578ae87b8
- native/organs/nl-eot.mjs abaf6134328b95d7e58d0163bf4e13136afb54cd6cf6609ff9c8a6debcf115b1
- khora adapters/text/ud-tokenizer.js (checkout 65e75da) e39934a0b1d500f3f89762643e6c51e5f4a6571efa32f3a05903cb4905bb0dbd
- khora kernel/eot-rich.js a400ae159e3b5b3e995838bd97333700e9f15cd01b5add973ef7e44f14077136
- khora-pharos-reading the-fold/pharos-reading.mjs 5fbd86889124b9a8be46f7dbff4bdc76da131fd30563798cdf74142b4e68bcc9
- penelope organs/anaphor-commit.mjs (read only; the reference organ for ROWS_P, penelope HEAD f74b671) 0576c63fc7a856fbf14dc40282e9d4a64438553fa2dc797cf81aac895e137311

## data, sha256
- gap-development.tsv b9a01434fcf58d8c2f9bc762480c27e58ce466cf1ffe8b09cfecbc7a20d2d634
- gap-validation.tsv 2d784f66b390404f554704b9aef6dcde8845e79dda9886b8391cf7e9a24fdb98
- gap-test.tsv 1c35e36d5b14f6313ec3f6cd67b275de282595dd59e59390e00cfff9897a6819
- gap-development.json eeef2f0fe61ab9339b143be7901e90726b49bdb9f2cd57876343a1162c74d653
- gap-validation.json d454b1e1e19b69587b1f13ed57ae8e4e29ff8f870ce6f6d5f040c8da2762b44e
- gap-test.json: NOT YET CREATED. It is produced once by gap2json.py and read once by gaprun.mjs under this freeze.

## Declarations made while building (before the test read)
1. GP6 as implemented compares EOT_P (the EOT mirror) with ROWS_P (Penelope's organ run over the reader's surface rows on the same passage): a difference can come from the representation or from the mirror; every difference is listed.
2. ROWS_P maps her verdict: committed -> the defined candidate; no survivor and no gap -> NEITHER; anything else -> HELD. The spectrum is {A, B} with activation 1; no evidence entry is handed to the organ and khora's pronoun calls are absent, so her gender-clash-by-calls rule cannot fire in this setting (stated, not hidden).
3. On English proper names the codec gives no Gender or Number feature, so cube agreement is a hole for nearly every candidate and EOT_J removes almost nothing.

## DEV-2 debugging run on gap-validation (454 rows; NOT claimed; recorded so the test read is not the first look)
coverage / precision / net: EOT_J 0.042/0.316/-0.015; EOT_P 0.086/0.462/-0.007; ROWS_P 0.055/0.600/+0.011; SHUF 0.165/0.427/-0.024; NEAR 1.0/0.489/-0.022; FIRST 1.0/0.412/-0.176; RAND 1.0/0.460/-0.079. GP1 HIT, GP3 HIT, GP4 HIT, GP2 GP5 GP6 not hit (EOT_P vs ROWS_P differ on 21 of 454 rows). In the SEPARABLE stratum (39 rows) EOT_P commits 29 and is right on 38%: a candidate whose cube features differ from its rival is removed, and that removal is often wrong; an observation for the next addendum, nothing was changed. Swap-invariance violations 0.

Commands: python3 gap2json.py gap-test.tsv gap-test.json; node gaprun.mjs gap-test.json run-test.json; python gapscore.py run-test.json --label FRESH. gap-test is read ONCE; a second scoring is REUSED. Any change after the read is an erratum.
