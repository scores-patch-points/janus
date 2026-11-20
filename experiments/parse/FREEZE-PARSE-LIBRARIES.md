# FREEZE: PREREG-PARSE-LIBRARIES (stamp 02c3fbc2bddf0d59) and PREREG-PARSE-TEACHERS (stamp 7d808bfbb4c601a9), written 2026-11-20T18:42:32Z, BEFORE the fresh sets are parsed or scored
Bootstrap by document (by sentence where a set carries no document ids: ParTUT), 2000 resamples, seed 20261119; size 0.5 LAS points; L2 ratio constant 2. Our arms are the frozen POOL, BLEND, EWT, GUM models of FREEZE-PARSE-ENGLISH-LAYERS.md. Library: Stanza 1.15.1, English combined_charlm pos + lemma + depparse + tokenize(pretokenized), gold tokens in.

## code, sha256
- experiments/parse/stanza_parse.py d55731c657571dc47c310c2e6e148e8d27528c880c199836e0125fab8a60b0b3
- experiments/parse/libeval.mjs bec1e21c39f2b7fe1894d139efd4d169fbd0d366749e6600bfbf407fc98422fd
- experiments/parse/libscore.py 1596f4ba79e37ce216aa5e6b0d39865a6f667feeef2f906579237201681baf8d
- experiments/parse/parselib.mjs 649981fb80e1a3249ed2a52b55887cd6cccf6cc994ba35aad3d3775323deea05

## Stanza model files (hashes recorded at download; the three unapproved extras were deleted)
- resources.json 541284 bytes sha256 a09dd4834c631e10dd5a91d68c8c7d3112a7cd5d43a7b656a557545feb07801b
- en/mwt/combined.pt 512405 bytes sha256 daa12616ba687534ce00cca11835b0fb9c3e15a2d2d48586a50d8de14e02a997
- en/depparse/combined_charlm.pt 142384846 bytes sha256 e2b22ebadcfd35998f64f2beec01faa6a3854d582ba55d60dc412a1db0010752
- en/pos/combined_charlm.pt 38769190 bytes sha256 5e05528957de2470e36bcaa8250312970fb9ce069f368a13aca0a2dc5b829c66
- en/pretrain/conll17.pt 106701210 bytes sha256 edde4c195f91ba45aab3f3a6254202011f284559da8a5ead5e62ce522f819c5e
- en/lemma/combined_charlm.pt 34670242 bytes sha256 9b403b310334da74fc4bcfdfba2ed5223987b806bda3d5721c2ba34da5bb7fee
- en/backward_charlm/1billion.pt 22743430 bytes sha256 5d8cb2306650e4fc2b4f7517cc0fb33b38269e05bbf8d05e712e481471052225
- en/forward_charlm/1billion.pt 22743428 bytes sha256 8a32ac2226dda8ea5d30f2a15fe3f835639977f299cfda315ce1b8a656596fd2
- en/tokenize/combined_nocharlm.pt 660797 bytes sha256 becae178f59cd8adba655a9dc8b3cac68311e1706da0a331706c7804f0d0c42d
- pip freeze before and after: /Users/mlacy/Documents/janus-experiments/stanza/pip-freeze-BEFORE.txt, pip-freeze-AFTER.txt (13 packages added, all removable)

## data, sha256
- UD_English-LinES/en_lines-ud-test.conllu a33e96c663bb1e03d119c29e02462a6ba465b82c125daf7163038d7504524cc2
- UD_English-ParTUT/en_partut-ud-test.conllu c625f76a815f34392d7976435a8334e3fd64fe4f966c9761718fc1c07da5d23f
- UD_English-PUD/en_pud-ud-test.conllu befc5e901b58732f2308b1aac5cdd804d938362ab31c9fe400c61c28e8e155d8

## DEV debugging run (EWT dev and GUM dev, Stanza possibly contaminated there; NOT claimed): LAS POOL 81.7/81.8, STANZA 89.2/90.9, ENS_LIB 83.4/83.8; UPOS STANZA 96.9/98.2; L2 ratio 16.4 (POOL wrong 85.5% where STANZA disagrees, 5.2% where it agrees); L1 not hit, L3 HIT (the three-way majority ensemble with two weak voters is below STANZA alone). Arms were not changed after this look.

Fresh sets are read ONCE: LinES test and ParTUT test (primary, fresh for all arms) and PUD test (fresh for ours only: Stanza trained on PUD: reported, excluded from L1 to L3). Any change after the read is an erratum.
