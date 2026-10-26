# Reading capacity — languages with a grammar prior (generated 2026-10-23 by identity-udhr-emergence/omni/capacity.mjs)

Grammar IN (UDParser@1 + UDTokenizer@1): text -> lemma, class, head, relation. Grammar OUT (UDGrammar@1): the way back from EOT — measured
order parameters, form table, marker table. Scores are on the treebank's own held-out split (dev, else test, else every tenth sentence; a
treebank with no train split trains on what it has and its "held-out" is a tenth of the same file — read `split`). Punctuation excluded
from attachment scores. "order τ" is Kendall's tau of the regenerated word order against the gold order; "forms" is the form table's hit rate
on gold (lemma, class, features). Licences: `NOTICE-ud-priors.md`. Codecs whose treebank licence forbids redistribution are pointed at, not committed, and vendored on use (`ud-codecs.json`, `scripts/vendor-ud-codec.mjs`); their rows below describe a codec built on the machine that uses it.

| code | treebank | trained on | split | UPOS | UAS | LAS | order τ | forms | segmenter | note |
|---|---|---|---|---|---|---|---|---|---|---|
| abk | Abkhaz-AbNC | 1391 | trained on ab_abnc-ud-test.conllu; held  | 94.1 | 67.8 | 46.5 | 0.735 | 37.8% | — |  |
| afr | Afrikaans-AfriBooms | 1315 | af_afribooms-ud-dev.conllu | 96.3 | 83 | 77.5 | 0.615 | 80% | — |  |
| aii | Assyrian-AS | 52 | trained on aii_as-ud-test.conllu; held o | 50 | 33.3 | 16.7 | 0.887 | 23.3% | — |  |
| arb | Arabic-PADT | 6075 | ar_padt-ud-dev.conllu | 95.7 | 82.1 | 76 | 0.79 | 79.6% | — |  |
| auv | Occitan-TTB | 830 | oc_ttb-ud-dev.conllu | 90 | 76 | 67.9 | 0.705 | 50% | — |  |
| bam | Bambara-CRB | 924 | trained on bm_crb-ud-test.conllu; held o | 96.3 | 89.4 | 85.5 | 0.926 | 92.6% | — |  |
| bel | Belarusian-HSE | 8000 | be_hse-ud-dev.conllu | 96 | 80.7 | 74.6 | 0.622 | 68.5% | — |  |
| ben | Bengali-BRU | 51 | trained on bn_bru-ud-test.conllu; held o | 72.2 | 51.7 | 27.6 | 0.643 | 48.3% | — |  |
| bho | Bhojpuri-BHTB | 322 | trained on bho_bhtb-ud-test.conllu; held | 79.9 | 59.2 | 43.7 | 0.677 | 58.1% | — |  |
| bre | Breton-KEB | 796 | trained on br_keb-ud-test.conllu; held o | 92.4 | 81.7 | 72.5 | 0.532 | 61.4% | — |  |
| bul | Bulgarian-BTB | 8000 | bg_btb-ud-dev.conllu | 97.9 | 87 | 81.1 | 0.594 | 75.5% | — |  |
| cat | Catalan-AnCora | 8000 | ca_ancora-ud-dev.conllu | 98.1 | 88.7 | 84.6 | 0.711 | 86.9% | — |  |
| ceb | Cebuano-GJA | 179 | trained on ceb_gja-ud-test.conllu; held  | 87.8 | 73.6 | 63.6 | 0.511 | 56.4% | — |  |
| ces | Czech-CAC | 8000 | cs_cac-ud-dev.conllu | 98.7 | 81.8 | 76.3 | 0.574 | 73.4% | — |  |
| cmn | Chinese-GSDSimp | 3997 | zh_gsdsimp-ud-dev.conllu | 90.5 | 70.1 | 64.5 | 0.691 | 84.1% | 94.3% |  |
| cym | Welsh-CCG | 1355 | cy_ccg-ud-dev.conllu | 94.1 | 83.1 | 74.7 | 0.734 | 65.5% | — |  |
| dan | Danish-DDT | 4383 | da_ddt-ud-dev.conllu | 94.9 | 78.5 | 74 | 0.651 | 78.3% | — |  |
| eng | English-EWT | 8000 | en_ewt-ud-dev.conllu | — | — | — | 0.76 | 82.4% | — | ud-parser-eng-ewt (UAS 84.5 / LAS 81.4 on the test split) |
| epo | Esperanto-Prago | 118 | trained on eo_prago-ud-test.conllu; held | 94.7 | 82.9 | 73.6 | 0.802 | 64.7% | — |  |
| est | Estonian-EDT | 8000 | et_edt-ud-dev.conllu | 92.8 | 71.9 | 60 | 0.499 | 59.9% | — |  |
| eus | Basque-BDT | 5396 | eu_bdt-ud-dev.conllu | 93.3 | 74.8 | 65.7 | 0.504 | 61.3% | — |  |
| fao | Faroese-FarPaHC | 1020 | fo_farpahc-ud-dev.conllu | 95.3 | 74.1 | 68.6 | 0.789 | 22.3% | — |  |
| fin | Finnish-TDT | 8000 | fi_tdt-ud-dev.conllu | 91.5 | 71.6 | 61.1 | 0.58 | 62.8% | — |  |
| fra | French-GSD | 8000 | fr_gsd-ud-dev.conllu | — | — | — | 0.797 | 78.1% | — | ud-parser-fra-gsd |
| gla | Scottish_Gaelic-ARCOSG | 3544 | gd_arcosg-ud-dev.conllu | 93.8 | 84.6 | 77.1 | 0.867 | 68.6% | — |  |
| gle | Irish-IDT | 4005 | ga_idt-ud-dev.conllu | 94.9 | 84.1 | 76.1 | 0.754 | 73% | — |  |
| glg | Galician-CTG | 2272 | gl_ctg-ud-dev.conllu | 96.6 | 83.3 | 78.9 | 0.716 | 62.1% | — |  |
| glv | Manx-Cadhan | 1172 | gv_cadhan-ud-test.conllu | 95.2 | 89.1 | 83.6 | 0.859 | 68.8% | — |  |
| gsw | Alemannic-DIVITAL | 880 | trained on gsw_divital-ud-test.conllu; h | 89.4 | 71.4 | 59.5 | 0.643 | 11.6% | — |  |
| gug | Guarani-OldTuDeT | 54 | trained on gn_oldtudet-ud-test.conllu; h | 60 | 60 | 53.3 | 0.467 | 33.3% | — |  |
| guj | Gujarati-GujTB | 169 | trained on gu_gujtb-ud-test.conllu; held | 70.2 | 52.3 | 33.3 | 0.636 | 30.8% | — |  |
| hat | Haitian_Creole-Adolphe | 2605 | ht_adolphe-ud-dev.conllu | 94.7 | 62.1 | 56.8 | 0.694 | 85.5% | — |  |
| hau | Hausa-SouthernAutogramm | 1735 | trained on ha_southernautogramm-ud-test. | 94 | 77.6 | 68 | 0.683 | 81.1% | — |  |
| heb | Hebrew-HTB | 5168 | he_htb-ud-dev.conllu | 95.4 | 84.8 | 80.1 | 0.693 | 83.3% | — |  |
| hin | Hindi-HDTB | 8000 | hi_hdtb-ud-dev.conllu | 95.3 | 88.8 | 84 | 0.709 | 87.4% | — |  |
| hrv | Croatian-SET | 6914 | hr_set-ud-dev.conllu | 96.6 | 81.1 | 75 | 0.709 | 77% | — |  |
| hsb | Upper_Sorbian-UFAL | 580 | trained on hsb_ufal-ud-test.conllu; held | 92.4 | 72.5 | 66.1 | 0.578 | 49.7% | — |  |
| hun | Hungarian-Szeged | 910 | hu_szeged-ud-dev.conllu | 94.4 | 74.1 | 62.4 | 0.596 | 55% | — |  |
| hye | Armenian-ArmTDP | 4352 | hy_armtdp-ud-dev.conllu | 95.9 | 78.5 | 68.1 | 0.465 | 66.8% | — |  |
| ind | Indonesian-GSD | 4482 | id_gsd-ud-dev.conllu | 93.6 | 83.1 | 74.2 | 0.776 | 75.4% | — |  |
| isl | Icelandic-IcePaHC | 8000 | is_icepahc-ud-dev.conllu | 94.7 | 76.9 | 69.7 | 0.693 | 77.1% | — |  |
| ita | Italian-ISDT | 8000 | it_isdt-ud-dev.conllu | 96.9 | 87.7 | 83.7 | 0.678 | 84.2% | — |  |
| jav | Javanese-CSUI | 900 | trained on jv_csui-ud-test.conllu; held  | 88.6 | 78.8 | 65.9 | 0.767 | 69.8% | — |  |
| jpn | Japanese-GSD | 7050 | ja_gsd-ud-dev.conllu | — | — | — | 0.824 | 82.2% | — | ud-parser-jpn-gsd |
| kat | Georgian-GLC | 2214 | ka_glc-ud-dev.conllu | 95.3 | 77.8 | 71.1 | 0.605 | 64.5% | — |  |
| kaz | Kazakh-KTB | 31 | kk_ktb-ud-test.conllu | 61.1 | 43.3 | 19.9 | 0.599 | 7.5% | — |  |
| kir | Kyrgyz-KTMU | 1308 | ky_ktmu-ud-test.conllu | 87.8 | 76.7 | 59.8 | 0.586 | 25.4% | — |  |
| koi | Komi_Permyak-UH | 34 | koi_uh-ud-test.conllu | 46.4 | 35 | 11.9 | 0.51 | 8% | — |  |
| kor | Korean-Kaist | 8000 | ko_kaist-ud-dev.conllu | 94.2 | 69.5 | 60.2 | 0.728 | 56.9% | — |  |
| krl | Karelian-KKPP | 206 | trained on krl_kkpp-ud-test.conllu; held | 86 | 63.2 | 45.5 | 0.546 | 48.2% | — |  |
| lat | Latin-ITTB | 8000 | la_ittb-ud-dev.conllu | 96.8 | 72.1 | 64.3 | 0.441 | 82% | — |  |
| lav | Latvian-LVTB | 8000 | lv_lvtb-ud-dev.conllu | 95.5 | 73.5 | 65.2 | 0.618 | 67.1% | — |  |
| lij | Ligurian-GLT | 20 | lij_glt-ud-test.conllu | 53.2 | 35.3 | 22.2 | 0.535 | 37.1% | — |  |
| lit | Lithuanian-ALKSNIS | 2341 | lt_alksnis-ud-dev.conllu | 93.4 | 66.1 | 55.9 | 0.579 | 54.6% | — |  |
| ltz | Luxembourgish-LuxBank | 18 | trained on lb_luxbank-ud-test.conllu; he | 66.7 | 11.8 | 0 | 0.548 | 23.5% | — |  |
| mal | Malayalam-UFAL | 197 | trained on ml_ufal-ud-test.conllu; held  | 70.1 | 48.1 | 35.4 | 0.869 | 21.7% | — |  |
| mar | Marathi-CMUPAN | 7616 | mr_cmupan-ud-dev.conllu | 90.6 | 77.8 | 66.8 | 0.766 | 55.8% | — |  |
| mkd | Macedonian-MTB | 140 | trained on mk_mtb-ud-test.conllu; held o | 86.6 | 72 | 59.8 | 0.585 | 43% | — |  |
| mlt | Maltese-MUDT | 1123 | mt_mudt-ud-dev.conllu | 92.9 | 79.5 | 71.5 | 0.647 | 16.3% | — |  |
| nds | Low_Saxon-LSDC | 500 | nds_lsdc-ud-test.conllu | 83.4 | 63.7 | 50.9 | 0.629 | 45.6% | — |  |
| nep | Nepali-BK | 63 | trained on ne_bk-ud-test.conllu; held ou | 75.8 | 59.5 | 40.5 | 0.517 | 54.4% | — |  |
| nld | Dutch-LassySmall | 8000 | nl_lassysmall-ud-dev.conllu | 95.2 | 79.7 | 73.8 | 0.746 | 76.8% | — |  |
| pan | Punjabi-CS | 73 | pa_cs-ud-dev.conllu | 71.3 | 55.7 | 39 | 0.607 | 39% | — |  |
| pbu | Pashto-Sikaram | 180 | trained on ps_sikaram-ud-test.conllu; he | 88 | 66.5 | 60.4 | 0.639 | 70.1% | — |  |
| pcm | Naija-NSC | 7279 | pcm_nsc-ud-dev.conllu | 97.7 | 87.2 | 82.8 | 0.758 | 93.8% | — |  |
| pes | Persian-PerDT | 8000 | fa_perdt-ud-dev.conllu | 94.9 | 82.8 | 76.6 | 0.709 | 84% | — |  |
| pol | Polish-PDB | 8000 | pl_pdb-ud-dev.conllu | 97.4 | 86.6 | 77.9 | 0.754 | 82% | — |  |
| quc | Kiche-IU | 1292 | trained on quc_iu-ud-test.conllu; held o | 96 | 87 | 81 | 0.674 | 65.9% | — |  |
| ron | Romanian-Nonstandard | 8000 | ro_nonstandard-ud-dev.conllu | 96.1 | 84.4 | 76.7 | 0.686 | 74.2% | — |  |
| rus | Russian-SynTagRus | 8000 | trained on ru_syntagrus-ud-dev.conllu; h | 96.9 | 81.3 | 75.3 | 0.614 | 72.4% | — |  |
| sah | Yakut-YKTDT | 270 | trained on sah_yktdt-ud-test.conllu; hel | 90.9 | 84.8 | 73.5 | 0.773 | 59.1% | — |  |
| san | Sanskrit-Vedic | 8000 | sa_vedic-ud-dev.conllu | 91.1 | 64.4 | 49.8 | 0.573 | 75.5% | — |  |
| sin | Sinhala-STB | 90 | trained on si_stb-ud-test.conllu; held o | 77.8 | 60 | 37.5 | 0.794 | 33.8% | — |  |
| slk | Slovak-SNK | 8000 | sk_snk-ud-dev.conllu | 94.5 | 80 | 72.8 | 0.538 | 50% | — |  |
| slv | Slovenian-SSJ | 8000 | sl_ssj-ud-dev.conllu | 96.8 | 81.4 | 76.8 | 0.609 | 71% | — |  |
| sms | Skolt_Sami-Giellagas | 20 | sms_giellagas-ud-test.conllu | 45.6 | 30.2 | 11.6 | 0.649 | 7.4% | — |  |
| spa | Spanish-AnCora | 8000 | es_ancora-ud-dev.conllu | — | — | — | 0.67 | 85.9% | — | ud-parser-spa-ancora |
| swe | Swedish-Talbanken | 4315 | sv_talbanken-ud-dev.conllu | 94.8 | 80.8 | 75.1 | 0.695 | 78.9% | — |  |
| tam | Tamil-TTB | 400 | ta_ttb-ud-dev.conllu | 82 | 65.7 | 53.3 | 0.687 | 50.2% | — |  |
| tat | Tatar-NMCTT | 134 | trained on tt_nmctt-ud-test.conllu; held | 83.2 | 64.8 | 42.8 | 0.754 | 39% | — |  |
| tel | Telugu-MTG | 1051 | te_mtg-ud-dev.conllu | 91.4 | 86.5 | 70.1 | 0.855 | 7.9% | — |  |
| tgl | Tagalog-TRG | 116 | trained on tl_trg-ud-test.conllu; held o | 93.5 | 92 | 82 | 0.428 | 72% | — |  |
| tha | Thai-TUD | 2902 | th_tud-ud-dev.conllu | 87.8 | 77.3 | 66.6 | 0.744 | 13.6% | 96.5% |  |
| tsn | Tswana-Popapolelo | 18 | trained on tn_popapolelo-ud-test.conllu; | 55 | 58.8 | 29.4 | 0.546 | 0% | — |  |
| tur | Turkish-Penn | 8000 | tr_penn-ud-dev.conllu | 93 | 77.6 | 61.4 | 0.846 | 68.6% | — |  |
| ukr | Ukrainian-IU | 5521 | uk_iu-ud-dev.conllu | 96 | 80.3 | 74.1 | 0.647 | 61.9% | — |  |
| urd | Urdu-UDTB | 4043 | ur_udtb-ud-dev.conllu | 93.1 | 82.3 | 75.8 | 0.738 | 83.8% | — |  |
| vep | Veps-VWT | 93 | trained on vep_vwt-ud-test.conllu; held  | 85 | 48.5 | 36.4 | 0.698 | 46.5% | — |  |
| vie | Vietnamese-VTB | 1400 | vi_vtb-ud-dev.conllu | 84.7 | 63.2 | 46.4 | 0.773 | 74.2% | — |  |
| wol | Wolof-WTB | 1188 | wo_wtb-ud-dev.conllu | 92.4 | 78.1 | 70.1 | 0.715 | 73.9% | — |  |
| wuu | Shanghainese-ShUD | 786 | wuu_shud-ud-dev.conllu | 83 | 64 | 52.3 | 0.692 | 81.1% | 91.8% |  |
| ydd | Yiddish-YiTB | 1877 | yi_yitb-ud-dev.conllu | 90.4 | 78 | 70.2 | 0.737 | 62.3% | — |  |
| yor | Yoruba-YTB | 286 | trained on yo_ytb-ud-test.conllu; held o | 89.4 | 67.4 | 56.5 | 0.806 | 84.4% | — |  |
| yrk | Nenets-Tundra | 153 | trained on yrk_tundra-ud-test.conllu; he | 83.2 | 77.1 | 60.2 | 0.757 | 43.2% | — |  |
| yue | Cantonese-HK | 904 | trained on yue_hk-ud-test.conllu; held o | 91.4 | 69.3 | 61.3 | 0.745 | 91% | 95.8% |  |

95 languages. A language absent here is the typed gap `no_grammar` in `janus/native/organs/nl-eot.mjs`.
