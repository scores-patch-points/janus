# NOTICE — Universal Dependencies priors (ud-parser-*, ud-tokenizer-*, ud-grammar-*)

## The ruling (2026-10-26, the operator): commit what the licence allows; point at the rest, vendored on use

- **Committed** (78 codecs): the treebank's licence permits redistribution (CC BY-SA 4.0 / 3.0, CC BY 4.0). These priors are
  derived from those treebanks and are distributed **under the same licence as their treebank** (ShareAlike), with the attribution
  below. Each prior's own `meta` names its treebank, the exact file and its sha256.
- **Pointed at** (17 codecs): the licence does not permit redistribution here — C-UDA 1.0, CC BY-NC-SA 3.0, CC BY-NC-SA 4.0. Their files are never committed (`.gitignore`,
  generated from `ud-codecs.json`; a test fails if one is tracked). `ud-codecs.json` pins each one's source (repo, file, sha256);
  `scripts/vendor-ud-codec.mjs <code>` builds it on the machine that uses it, from the treebank's own files, into the local codec cache
  (`$FOLD_UD_CODECS`, else `~/.fold/ud-codecs`); `native/organs/nl-eot.mjs::loadGrammar` does so in the background on first use and
  answers `codec_vendoring` meanwhile. The treebank's licence governs that local use (non-commercial / research-only).
- The licence column is **machine-read** from each treebank's README "License:" line (2026-10-26). The treebank's own LICENSE.txt
  governs; a row found wrong moves between the two lists by editing `ud-codecs.json` (and regenerating `.gitignore`).

### Attribution — committed codecs

| code | treebank (github.com/UniversalDependencies/…) | licence |
|---|---|---|
| abk | UD_Abkhaz-AbNC | CC BY-SA 4.0 |
| afr | UD_Afrikaans-AfriBooms | CC BY-SA 4.0 |
| aii | UD_Assyrian-AS | CC BY-SA 4.0 |
| bam | UD_Bambara-CRB | CC BY-SA 4.0 |
| bel | UD_Belarusian-HSE | CC BY-SA 4.0 |
| ben | UD_Bengali-BRU | CC BY-SA 4.0 |
| bho | UD_Bhojpuri-BHTB | CC BY-SA 4.0 |
| bre | UD_Breton-KEB | CC BY-SA 4.0 |
| cat | UD_Catalan-AnCora | CC BY 4.0 |
| ceb | UD_Cebuano-GJA | CC BY-SA 4.0 |
| ces | UD_Czech-CAC | CC BY-SA 4.0 |
| cmn | UD_Chinese-GSDSimp | CC BY-SA 4.0 |
| cym | UD_Welsh-CCG | CC BY-SA 4.0 |
| dan | UD_Danish-DDT | CC BY-SA 4.0 |
| eng | UD_English-EWT | CC BY-SA 4.0 |
| epo | UD_Esperanto-Prago | CC BY-SA 4.0 |
| fao | UD_Faroese-FarPaHC | CC BY-SA 4.0 |
| fin | UD_Finnish-TDT | CC BY-SA 4.0 |
| fra | UD_French-GSD | CC BY-SA 4.0 |
| gla | UD_Scottish_Gaelic-ARCOSG | CC BY-SA 4.0 |
| gle | UD_Irish-IDT | CC BY-SA 3.0 |
| glv | UD_Manx-Cadhan | CC BY-SA 4.0 |
| gsw | UD_Alemannic-DIVITAL | CC BY-SA 4.0 |
| gug | UD_Guarani-OldTuDeT | CC BY-SA 4.0 |
| guj | UD_Gujarati-GujTB | CC BY-SA 4.0 |
| hat | UD_Haitian_Creole-Adolphe | CC BY-SA 4.0 |
| hau | UD_Hausa-SouthernAutogramm | CC BY-SA 4.0 |
| hrv | UD_Croatian-SET | CC BY-SA 4.0 |
| hsb | UD_Upper_Sorbian-UFAL | CC BY-SA 4.0 |
| hye | UD_Armenian-ArmTDP | CC BY-SA 4.0 |
| ind | UD_Indonesian-GSD | CC BY-SA 4.0 |
| isl | UD_Icelandic-IcePaHC | CC BY-SA 4.0 |
| jav | UD_Javanese-CSUI | CC BY-SA 4.0 |
| jpn | UD_Japanese-GSD | CC BY-SA 4.0 |
| kat | UD_Georgian-GLC | CC BY-SA 4.0 |
| kaz | UD_Kazakh-KTB | CC BY-SA 4.0 |
| kir | UD_Kyrgyz-KTMU | CC BY-SA 4.0 |
| koi | UD_Komi_Permyak-UH | CC BY-SA 4.0 |
| kor | UD_Korean-Kaist | CC BY-SA 4.0 |
| krl | UD_Karelian-KKPP | CC BY-SA 4.0 |
| lav | UD_Latvian-LVTB | CC BY-SA 4.0 |
| lit | UD_Lithuanian-ALKSNIS | CC BY-SA 4.0 |
| ltz | UD_Luxembourgish-LuxBank | CC BY-SA 4.0 |
| mal | UD_Malayalam-UFAL | CC BY-SA 4.0 |
| mar | UD_Marathi-CMUPAN | CC BY-SA 4.0 |
| mkd | UD_Macedonian-MTB | CC BY-SA 4.0 |
| mlt | UD_Maltese-MUDT | CC BY-SA 4.0 |
| nds | UD_Low_Saxon-LSDC | CC BY-SA 4.0 |
| nep | UD_Nepali-BK | CC BY-SA 4.0 |
| nld | UD_Dutch-LassySmall | CC BY-SA 4.0 |
| pan | UD_Punjabi-CS | CC BY-SA 4.0 |
| pbu | UD_Pashto-Sikaram | CC BY-SA 4.0 |
| pcm | UD_Naija-NSC | CC BY-SA 4.0 |
| pes | UD_Persian-PerDT | CC BY-SA 4.0 |
| quc | UD_Kiche-IU | CC BY-SA 4.0 |
| ron | UD_Romanian-Nonstandard | CC BY-SA 4.0 |
| sah | UD_Yakut-YKTDT | CC BY-SA 4.0 |
| san | UD_Sanskrit-Vedic | CC BY-SA 4.0 |
| sin | UD_Sinhala-STB | CC BY-SA 4.0 |
| slk | UD_Slovak-SNK | CC BY-SA 4.0 |
| slv | UD_Slovenian-SSJ | CC BY-SA 4.0 |
| sms | UD_Skolt_Sami-Giellagas | CC BY-SA 4.0 |
| spa | UD_Spanish-AnCora | CC BY 4.0 |
| swe | UD_Swedish-Talbanken | CC BY-SA 4.0 |
| tat | UD_Tatar-NMCTT | CC BY-SA 4.0 |
| tel | UD_Telugu-MTG | CC BY-SA 4.0 |
| tgl | UD_Tagalog-TRG | CC BY-SA 4.0 |
| tha | UD_Thai-TUD | CC BY-SA 4.0 |
| tsn | UD_Tswana-Popapolelo | CC BY-SA 4.0 |
| tur | UD_Turkish-Penn | CC BY-SA 4.0 |
| vep | UD_Veps-VWT | CC BY-SA 4.0 |
| vie | UD_Vietnamese-VTB | CC BY-SA 4.0 |
| wol | UD_Wolof-WTB | CC BY-SA 4.0 |
| wuu | UD_Shanghainese-ShUD | CC BY-SA 4.0 |
| ydd | UD_Yiddish-YiTB | CC BY-SA 4.0 |
| yor | UD_Yoruba-YTB | CC BY-SA 4.0 |
| yrk | UD_Nenets-Tundra | CC BY-SA 4.0 |
| yue | UD_Cantonese-HK | CC BY-SA 4.0 |

### Pointed at — vendored on use, never committed

| code | treebank | licence |
|---|---|---|
| arb | UD_Arabic-PADT | CC BY-NC-SA 3.0 |
| auv | UD_Occitan-TTB | CC BY-NC-SA 4.0 |
| bul | UD_Bulgarian-BTB | CC BY-NC-SA 3.0 |
| est | UD_Estonian-EDT | CC BY-NC-SA 4.0 |
| eus | UD_Basque-BDT | CC BY-NC-SA 3.0 |
| glg | UD_Galician-CTG | CC BY-NC-SA 3.0 |
| heb | UD_Hebrew-HTB | CC BY-NC-SA 4.0 |
| hin | UD_Hindi-HDTB | CC BY-NC-SA 4.0 |
| hun | UD_Hungarian-Szeged | CC BY-NC-SA 3.0 |
| ita | UD_Italian-ISDT | CC BY-NC-SA 3.0 |
| lat | UD_Latin-ITTB | CC BY-NC-SA 3.0 |
| lij | UD_Ligurian-GLT | C-UDA 1.0 |
| pol | UD_Polish-PDB | CC BY-NC-SA 4.0 |
| rus | UD_Russian-SynTagRus | CC BY-NC-SA 4.0 |
| tam | UD_Tamil-TTB | CC BY-NC-SA 3.0 |
| ukr | UD_Ukrainian-IU | CC BY-NC-SA 4.0 |
| urd | UD_Urdu-UDTB | CC BY-NC-SA 4.0 |

---

## The original notice (2026-10-21), kept as written

Built by `khora/native/scripts/train-ud-language.mjs` from the treebanks below. Source of the data: Universal Dependencies treebanks, every file listed in Zenodotus/scripts/ud-manifest.json (727 files, 269 languages), fetched 2026-10-21T02:32:36.972Z from raw.githubusercontent.com/UniversalDependencies/<repo>/master. Licences are per treebank (see each repo's LICENSE).

**Licences are not on disk.** The fetch took the `.conllu` files only; each treebank's licence is stated in its own README.md
("License:" in the machine-readable block) at the repository named in its row. UD treebanks are variously CC BY-SA 4.0, CC BY-NC-SA,
CC BY-NC-ND, GPL and C-UDA (research-use); the earlier POS-prior notice found two treebanks mislabelled as CC BY-SA. **Every row below is
unverified until a person reads that README; none of these priors may be redistributed before that.** Every prior's own `meta` names its
treebank, file and sha256, so the row to check is unambiguous.

| code | treebank | licence: where to read it | priors |
|---|---|---|---|
| abk | UD_Abkhaz-AbNC | https://github.com/UniversalDependencies/UD_Abkhaz-AbNC (README.md, "License:") | parser, tokenizer, grammar |
| afr | UD_Afrikaans-AfriBooms | https://github.com/UniversalDependencies/UD_Afrikaans-AfriBooms (README.md, "License:") | parser, tokenizer, grammar |
| aii | UD_Assyrian-AS | https://github.com/UniversalDependencies/UD_Assyrian-AS (README.md, "License:") | parser, tokenizer, grammar |
| arb | UD_Arabic-NYUAD | https://github.com/UniversalDependencies/UD_Arabic-NYUAD (README.md, "License:") | parser, tokenizer, grammar |
| bel | UD_Belarusian-HSE | https://github.com/UniversalDependencies/UD_Belarusian-HSE (README.md, "License:") | parser, tokenizer, grammar |
| bul | UD_Bulgarian-BTB | https://github.com/UniversalDependencies/UD_Bulgarian-BTB (README.md, "License:") | parser, tokenizer, grammar |
| bho | UD_Bhojpuri-BHTB | https://github.com/UniversalDependencies/UD_Bhojpuri-BHTB (README.md, "License:") | parser, tokenizer, grammar |
| bam | UD_Bambara-CRB | https://github.com/UniversalDependencies/UD_Bambara-CRB (README.md, "License:") | parser, tokenizer, grammar |
| ben | UD_Bengali-BRU | https://github.com/UniversalDependencies/UD_Bengali-BRU (README.md, "License:") | parser, tokenizer, grammar |
| bre | UD_Breton-KEB | https://github.com/UniversalDependencies/UD_Breton-KEB (README.md, "License:") | parser, tokenizer, grammar |
| cat | UD_Catalan-AnCora | https://github.com/UniversalDependencies/UD_Catalan-AnCora (README.md, "License:") | parser, tokenizer, grammar |
| ceb | UD_Cebuano-GJA | https://github.com/UniversalDependencies/UD_Cebuano-GJA (README.md, "License:") | parser, tokenizer, grammar |
| ces | UD_Czech-CAC | https://github.com/UniversalDependencies/UD_Czech-CAC (README.md, "License:") | parser, tokenizer, grammar |
| cym | UD_Welsh-CCG | https://github.com/UniversalDependencies/UD_Welsh-CCG (README.md, "License:") | parser, tokenizer, grammar |
| dan | UD_Danish-DDT | https://github.com/UniversalDependencies/UD_Danish-DDT (README.md, "License:") | parser, tokenizer, grammar |
| eng | UD_English-EWT | https://github.com/UniversalDependencies/UD_English-EWT (README.md, "License:") | grammar only |
| epo | UD_Esperanto-Prago | https://github.com/UniversalDependencies/UD_Esperanto-Prago (README.md, "License:") | parser, tokenizer, grammar |
| spa | UD_Spanish-AnCora | https://github.com/UniversalDependencies/UD_Spanish-AnCora (README.md, "License:") | grammar only |
| est | UD_Estonian-EDT | https://github.com/UniversalDependencies/UD_Estonian-EDT (README.md, "License:") | parser, tokenizer, grammar |
| eus | UD_Basque-BDT | https://github.com/UniversalDependencies/UD_Basque-BDT (README.md, "License:") | parser, tokenizer, grammar |
| pes | UD_Persian-PerDT | https://github.com/UniversalDependencies/UD_Persian-PerDT (README.md, "License:") | parser, tokenizer, grammar |
| 067 | UD_Finnish-TDT | https://github.com/UniversalDependencies/UD_Finnish-TDT (README.md, "License:") | parser, tokenizer, grammar |
| fao | UD_Faroese-FarPaHC | https://github.com/UniversalDependencies/UD_Faroese-FarPaHC (README.md, "License:") | parser, tokenizer, grammar |
| fra | UD_French-GSD | https://github.com/UniversalDependencies/UD_French-GSD (README.md, "License:") | grammar only |
| gle | UD_Irish-IDT | https://github.com/UniversalDependencies/UD_Irish-IDT (README.md, "License:") | parser, tokenizer, grammar |
| gla | UD_Scottish_Gaelic-ARCOSG | https://github.com/UniversalDependencies/UD_Scottish_Gaelic-ARCOSG (README.md, "License:") | parser, tokenizer, grammar |
| glg | UD_Galician-CTG | https://github.com/UniversalDependencies/UD_Galician-CTG (README.md, "License:") | parser, tokenizer, grammar |
| gug | UD_Guarani-OldTuDeT | https://github.com/UniversalDependencies/UD_Guarani-OldTuDeT (README.md, "License:") | parser, tokenizer, grammar |
| gsw1 | UD_Alemannic-DIVITAL | https://github.com/UniversalDependencies/UD_Alemannic-DIVITAL (README.md, "License:") | parser, tokenizer, grammar |
| guj | UD_Gujarati-GujTB | https://github.com/UniversalDependencies/UD_Gujarati-GujTB (README.md, "License:") | parser, tokenizer, grammar |
| glv | UD_Manx-Cadhan | https://github.com/UniversalDependencies/UD_Manx-Cadhan (README.md, "License:") | parser, tokenizer, grammar |
| hau | UD_Hausa-SouthernAutogramm | https://github.com/UniversalDependencies/UD_Hausa-SouthernAutogramm (README.md, "License:") | parser, tokenizer, grammar |
| heb | UD_Hebrew-HTB | https://github.com/UniversalDependencies/UD_Hebrew-HTB (README.md, "License:") | parser, tokenizer, grammar |
| hin | UD_Hindi-HDTB | https://github.com/UniversalDependencies/UD_Hindi-HDTB (README.md, "License:") | parser, tokenizer, grammar |
| hrv | UD_Croatian-SET | https://github.com/UniversalDependencies/UD_Croatian-SET (README.md, "License:") | parser, tokenizer, grammar |
| hsb | UD_Upper_Sorbian-UFAL | https://github.com/UniversalDependencies/UD_Upper_Sorbian-UFAL (README.md, "License:") | parser, tokenizer, grammar |
| hat | UD_Haitian_Creole-Adolphe | https://github.com/UniversalDependencies/UD_Haitian_Creole-Adolphe (README.md, "License:") | parser, tokenizer, grammar |
| hun | UD_Hungarian-Szeged | https://github.com/UniversalDependencies/UD_Hungarian-Szeged (README.md, "License:") | parser, tokenizer, grammar |
| hye | UD_Armenian-ArmTDP | https://github.com/UniversalDependencies/UD_Armenian-ArmTDP (README.md, "License:") | parser, tokenizer, grammar |
| ind | UD_Indonesian-GSD | https://github.com/UniversalDependencies/UD_Indonesian-GSD (README.md, "License:") | parser, tokenizer, grammar |
| isl | UD_Icelandic-IcePaHC | https://github.com/UniversalDependencies/UD_Icelandic-IcePaHC (README.md, "License:") | parser, tokenizer, grammar |
| ita | UD_Italian-ISDT | https://github.com/UniversalDependencies/UD_Italian-ISDT (README.md, "License:") | parser, tokenizer, grammar |
| jpn | UD_Japanese-GSD | https://github.com/UniversalDependencies/UD_Japanese-GSD (README.md, "License:") | grammar only |
| jav | UD_Javanese-CSUI | https://github.com/UniversalDependencies/UD_Javanese-CSUI (README.md, "License:") | parser, tokenizer, grammar |
| kat | UD_Georgian-GLC | https://github.com/UniversalDependencies/UD_Georgian-GLC (README.md, "License:") | parser, tokenizer, grammar |
| kaz | UD_Kazakh-KTB | https://github.com/UniversalDependencies/UD_Kazakh-KTB (README.md, "License:") | parser, tokenizer, grammar |
| kor | UD_Korean-Kaist | https://github.com/UniversalDependencies/UD_Korean-Kaist (README.md, "License:") | parser, tokenizer, grammar |
| koi | UD_Komi_Permyak-UH | https://github.com/UniversalDependencies/UD_Komi_Permyak-UH (README.md, "License:") | parser, tokenizer, grammar |
| krl | UD_Karelian-KKPP | https://github.com/UniversalDependencies/UD_Karelian-KKPP (README.md, "License:") | parser, tokenizer, grammar |
| kir | UD_Kyrgyz-KTMU | https://github.com/UniversalDependencies/UD_Kyrgyz-KTMU (README.md, "License:") | parser, tokenizer, grammar |
| lat | UD_Latin-ITTB | https://github.com/UniversalDependencies/UD_Latin-ITTB (README.md, "License:") | parser, tokenizer, grammar |
| ltz | UD_Luxembourgish-LuxBank | https://github.com/UniversalDependencies/UD_Luxembourgish-LuxBank (README.md, "License:") | parser, tokenizer, grammar |
| lij | UD_Ligurian-GLT | https://github.com/UniversalDependencies/UD_Ligurian-GLT (README.md, "License:") | parser, tokenizer, grammar |
| lit | UD_Lithuanian-ALKSNIS | https://github.com/UniversalDependencies/UD_Lithuanian-ALKSNIS (README.md, "License:") | parser, tokenizer, grammar |
| 041 | UD_Latvian-LVTB | https://github.com/UniversalDependencies/UD_Latvian-LVTB (README.md, "License:") | parser, tokenizer, grammar |
| mkd | UD_Macedonian-MTB | https://github.com/UniversalDependencies/UD_Macedonian-MTB (README.md, "License:") | parser, tokenizer, grammar |
| mal | UD_Malayalam-UFAL | https://github.com/UniversalDependencies/UD_Malayalam-UFAL (README.md, "License:") | parser, tokenizer, grammar |
| mar | UD_Marathi-CMUPAN | https://github.com/UniversalDependencies/UD_Marathi-CMUPAN (README.md, "License:") | parser, tokenizer, grammar |
| mlt | UD_Maltese-MUDT | https://github.com/UniversalDependencies/UD_Maltese-MUDT (README.md, "License:") | parser, tokenizer, grammar |
| nds | UD_Low_Saxon-LSDC | https://github.com/UniversalDependencies/UD_Low_Saxon-LSDC (README.md, "License:") | parser, tokenizer, grammar |
| nep | UD_Nepali-BK | https://github.com/UniversalDependencies/UD_Nepali-BK (README.md, "License:") | parser, tokenizer, grammar |
| nld | UD_Dutch-LassySmall | https://github.com/UniversalDependencies/UD_Dutch-LassySmall (README.md, "License:") | parser, tokenizer, grammar |
| auv | UD_Occitan-TTB | https://github.com/UniversalDependencies/UD_Occitan-TTB (README.md, "License:") | parser, tokenizer, grammar |
| pan | UD_Punjabi-CS | https://github.com/UniversalDependencies/UD_Punjabi-CS (README.md, "License:") | parser, tokenizer, grammar |
| pcm | UD_Naija-NSC | https://github.com/UniversalDependencies/UD_Naija-NSC (README.md, "License:") | parser, tokenizer, grammar |
| pol | UD_Polish-PDB | https://github.com/UniversalDependencies/UD_Polish-PDB (README.md, "License:") | parser, tokenizer, grammar |
| pbu | UD_Pashto-Sikaram | https://github.com/UniversalDependencies/UD_Pashto-Sikaram (README.md, "License:") | parser, tokenizer, grammar |
| quc | UD_Kiche-IU | https://github.com/UniversalDependencies/UD_Kiche-IU (README.md, "License:") | parser, tokenizer, grammar |
| ron | UD_Romanian-Nonstandard | https://github.com/UniversalDependencies/UD_Romanian-Nonstandard (README.md, "License:") | parser, tokenizer, grammar |
| rus | UD_Russian-SynTagRus | https://github.com/UniversalDependencies/UD_Russian-SynTagRus (README.md, "License:") | parser, tokenizer, grammar |
| san | UD_Sanskrit-Vedic | https://github.com/UniversalDependencies/UD_Sanskrit-Vedic (README.md, "License:") | parser, tokenizer, grammar |
| sah | UD_Yakut-YKTDT | https://github.com/UniversalDependencies/UD_Yakut-YKTDT (README.md, "License:") | parser, tokenizer, grammar |
| sin | UD_Sinhala-STB | https://github.com/UniversalDependencies/UD_Sinhala-STB (README.md, "License:") | parser, tokenizer, grammar |
| slk | UD_Slovak-SNK | https://github.com/UniversalDependencies/UD_Slovak-SNK (README.md, "License:") | parser, tokenizer, grammar |
| slv | UD_Slovenian-SSJ | https://github.com/UniversalDependencies/UD_Slovenian-SSJ (README.md, "License:") | parser, tokenizer, grammar |
| 061 | UD_Skolt_Sami-Giellagas | https://github.com/UniversalDependencies/UD_Skolt_Sami-Giellagas (README.md, "License:") | parser, tokenizer, grammar |
| swe | UD_Swedish-Talbanken | https://github.com/UniversalDependencies/UD_Swedish-Talbanken (README.md, "License:") | parser, tokenizer, grammar |
| tam | UD_Tamil-TTB | https://github.com/UniversalDependencies/UD_Tamil-TTB (README.md, "License:") | parser, tokenizer, grammar |
| tel | UD_Telugu-MTG | https://github.com/UniversalDependencies/UD_Telugu-MTG (README.md, "License:") | parser, tokenizer, grammar |
| tha | UD_Thai-TUD | https://github.com/UniversalDependencies/UD_Thai-TUD (README.md, "License:") | parser, tokenizer, grammar |
| tgl | UD_Tagalog-TRG | https://github.com/UniversalDependencies/UD_Tagalog-TRG (README.md, "License:") | parser, tokenizer, grammar |
| tsn | UD_Tswana-Popapolelo | https://github.com/UniversalDependencies/UD_Tswana-Popapolelo (README.md, "License:") | parser, tokenizer, grammar |
| tur | UD_Turkish-Penn | https://github.com/UniversalDependencies/UD_Turkish-Penn (README.md, "License:") | parser, tokenizer, grammar |
| tat | UD_Tatar-NMCTT | https://github.com/UniversalDependencies/UD_Tatar-NMCTT (README.md, "License:") | parser, tokenizer, grammar |
| ukr | UD_Ukrainian-IU | https://github.com/UniversalDependencies/UD_Ukrainian-IU (README.md, "License:") | parser, tokenizer, grammar |
| urd | UD_Urdu-UDTB | https://github.com/UniversalDependencies/UD_Urdu-UDTB (README.md, "License:") | parser, tokenizer, grammar |
| vep | UD_Veps-VWT | https://github.com/UniversalDependencies/UD_Veps-VWT (README.md, "License:") | parser, tokenizer, grammar |
| vie | UD_Vietnamese-VTB | https://github.com/UniversalDependencies/UD_Vietnamese-VTB (README.md, "License:") | parser, tokenizer, grammar |
| wol | UD_Wolof-WTB | https://github.com/UniversalDependencies/UD_Wolof-WTB (README.md, "License:") | parser, tokenizer, grammar |
| wuu | UD_Shanghainese-ShUD | https://github.com/UniversalDependencies/UD_Shanghainese-ShUD (README.md, "License:") | parser, tokenizer, grammar |
| ydd | UD_Yiddish-YiTB | https://github.com/UniversalDependencies/UD_Yiddish-YiTB (README.md, "License:") | parser, tokenizer, grammar |
| yor | UD_Yoruba-YTB | https://github.com/UniversalDependencies/UD_Yoruba-YTB (README.md, "License:") | parser, tokenizer, grammar |
| yrk | UD_Nenets-Tundra | https://github.com/UniversalDependencies/UD_Nenets-Tundra (README.md, "License:") | parser, tokenizer, grammar |
| yue | UD_Cantonese-HK | https://github.com/UniversalDependencies/UD_Cantonese-HK (README.md, "License:") | parser, tokenizer, grammar |
| cmn | UD_Chinese-GSDSimp | https://github.com/UniversalDependencies/UD_Chinese-GSDSimp (README.md, "License:") | parser, tokenizer, grammar |

## Machine-read licence column (2026-10-26) — NOT the person's verification

Read from each treebank's own README.md (or README.txt) "License:" line at UniversalDependencies/<repo>@master, by script. The gate above stands: a person confirms each row before any prior is pushed. Tally: CC BY-SA 4.0 77 · CC BY-SA 3.0 1 · CC BY 4.0 2 · **CC BY-NC-SA 15** · **C-UDA 1.0 (research use) 1**. The non-commercial and C-UDA rows must not be published by the formal account without a decision; the share-alike rows carry attribution + ShareAlike on whatever is derived.

| code | treebank | licence (machine-read) |
|---|---|---|
| bul | UD_Bulgarian-BTB | CC BY-NC-SA 3.0 **(restricted)** |
| gle | UD_Irish-IDT | CC BY-SA 3.0 |
| 067 | UD_Finnish-TDT | CC BY-SA 4.0 |
| afr | UD_Afrikaans-AfriBooms | CC BY-SA 4.0 |
| nld | UD_Dutch-LassySmall | CC BY-SA 4.0 |
| lij | UD_Ligurian-GLT | C-UDA 1.0 **(restricted)** |
| cat | UD_Catalan-AnCora | CC BY 4.0 |
| spa | UD_Spanish-AnCora | CC BY 4.0 |
| eus | UD_Basque-BDT | CC BY-NC-SA 3.0 **(restricted)** |
| glg | UD_Galician-CTG | CC BY-NC-SA 3.0 **(restricted)** |
| hun | UD_Hungarian-Szeged | CC BY-NC-SA 3.0 **(restricted)** |
| ita | UD_Italian-ISDT | CC BY-NC-SA 3.0 **(restricted)** |
| lat | UD_Latin-ITTB | CC BY-NC-SA 3.0 **(restricted)** |
| tam | UD_Tamil-TTB | CC BY-NC-SA 3.0 **(restricted)** |
| auv | UD_Occitan-TTB | CC BY-NC-SA 4.0 **(restricted)** |
| est | UD_Estonian-EDT | CC BY-NC-SA 4.0 **(restricted)** |
| heb | UD_Hebrew-HTB | CC BY-NC-SA 4.0 **(restricted)** |
| hin | UD_Hindi-HDTB | CC BY-NC-SA 4.0 **(restricted)** |
| pol | UD_Polish-PDB | CC BY-NC-SA 4.0 **(restricted)** |
| rus | UD_Russian-SynTagRus | CC BY-NC-SA 4.0 **(restricted)** |
| ukr | UD_Ukrainian-IU | CC BY-NC-SA 4.0 **(restricted)** |
| urd | UD_Urdu-UDTB | CC BY-NC-SA 4.0 **(restricted)** |
| 041 | UD_Latvian-LVTB | CC BY-SA 4.0 |
| 061 | UD_Skolt_Sami-Giellagas | CC BY-SA 4.0 |
| abk | UD_Abkhaz-AbNC | CC BY-SA 4.0 |
| aii | UD_Assyrian-AS | CC BY-SA 4.0 |
| arb | UD_Arabic-NYUAD | CC BY-SA 4.0 |
| bam | UD_Bambara-CRB | CC BY-SA 4.0 |
| bel | UD_Belarusian-HSE | CC BY-SA 4.0 |
| ben | UD_Bengali-BRU | CC BY-SA 4.0 |
| bho | UD_Bhojpuri-BHTB | CC BY-SA 4.0 |
| bre | UD_Breton-KEB | CC BY-SA 4.0 |
| ceb | UD_Cebuano-GJA | CC BY-SA 4.0 |
| ces | UD_Czech-CAC | CC BY-SA 4.0 |
| cmn | UD_Chinese-GSDSimp | CC BY-SA 4.0 |
| cym | UD_Welsh-CCG | CC BY-SA 4.0 |
| dan | UD_Danish-DDT | CC BY-SA 4.0 |
| eng | UD_English-EWT | CC BY-SA 4.0 |
| epo | UD_Esperanto-Prago | CC BY-SA 4.0 |
| fao | UD_Faroese-FarPaHC | CC BY-SA 4.0 |
| fra | UD_French-GSD | CC BY-SA 4.0 |
| gla | UD_Scottish_Gaelic-ARCOSG | CC BY-SA 4.0 |
| glv | UD_Manx-Cadhan | CC BY-SA 4.0 |
| gsw1 | UD_Alemannic-DIVITAL | CC BY-SA 4.0 |
| gug | UD_Guarani-OldTuDeT | CC BY-SA 4.0 |
| guj | UD_Gujarati-GujTB | CC BY-SA 4.0 |
| hat | UD_Haitian_Creole-Adolphe | CC BY-SA 4.0 |
| hau | UD_Hausa-SouthernAutogramm | CC BY-SA 4.0 |
| hrv | UD_Croatian-SET | CC BY-SA 4.0 |
| hsb | UD_Upper_Sorbian-UFAL | CC BY-SA 4.0 |
| hye | UD_Armenian-ArmTDP | CC BY-SA 4.0 |
| ind | UD_Indonesian-GSD | CC BY-SA 4.0 |
| isl | UD_Icelandic-IcePaHC | CC BY-SA 4.0 |
| jav | UD_Javanese-CSUI | CC BY-SA 4.0 |
| jpn | UD_Japanese-GSD | CC BY-SA 4.0 |
| kat | UD_Georgian-GLC | CC BY-SA 4.0 |
| kaz | UD_Kazakh-KTB | CC BY-SA 4.0 |
| kir | UD_Kyrgyz-KTMU | CC BY-SA 4.0 |
| koi | UD_Komi_Permyak-UH | CC BY-SA 4.0 |
| kor | UD_Korean-Kaist | CC BY-SA 4.0 |
| krl | UD_Karelian-KKPP | CC BY-SA 4.0 |
| lit | UD_Lithuanian-ALKSNIS | CC BY-SA 4.0 |
| ltz | UD_Luxembourgish-LuxBank | CC BY-SA 4.0 |
| mal | UD_Malayalam-UFAL | CC BY-SA 4.0 |
| mar | UD_Marathi-CMUPAN | CC BY-SA 4.0 |
| mkd | UD_Macedonian-MTB | CC BY-SA 4.0 |
| mlt | UD_Maltese-MUDT | CC BY-SA 4.0 |
| nds | UD_Low_Saxon-LSDC | CC BY-SA 4.0 |
| nep | UD_Nepali-BK | CC BY-SA 4.0 |
| pan | UD_Punjabi-CS | CC BY-SA 4.0 |
| pbu | UD_Pashto-Sikaram | CC BY-SA 4.0 |
| pcm | UD_Naija-NSC | CC BY-SA 4.0 |
| pes | UD_Persian-PerDT | CC BY-SA 4.0 |
| quc | UD_Kiche-IU | CC BY-SA 4.0 |
| ron | UD_Romanian-Nonstandard | CC BY-SA 4.0 |
| sah | UD_Yakut-YKTDT | CC BY-SA 4.0 |
| san | UD_Sanskrit-Vedic | CC BY-SA 4.0 |
| sin | UD_Sinhala-STB | CC BY-SA 4.0 |
| slk | UD_Slovak-SNK | CC BY-SA 4.0 |
| slv | UD_Slovenian-SSJ | CC BY-SA 4.0 |
| swe | UD_Swedish-Talbanken | CC BY-SA 4.0 |
| tat | UD_Tatar-NMCTT | CC BY-SA 4.0 |
| tel | UD_Telugu-MTG | CC BY-SA 4.0 |
| tgl | UD_Tagalog-TRG | CC BY-SA 4.0 |
| tha | UD_Thai-TUD | CC BY-SA 4.0 |
| tsn | UD_Tswana-Popapolelo | CC BY-SA 4.0 |
| tur | UD_Turkish-Penn | CC BY-SA 4.0 |
| vep | UD_Veps-VWT | CC BY-SA 4.0 |
| vie | UD_Vietnamese-VTB | CC BY-SA 4.0 |
| wol | UD_Wolof-WTB | CC BY-SA 4.0 |
| wuu | UD_Shanghainese-ShUD | CC BY-SA 4.0 |
| ydd | UD_Yiddish-YiTB | CC BY-SA 4.0 |
| yor | UD_Yoruba-YTB | CC BY-SA 4.0 |
| yrk | UD_Nenets-Tundra | CC BY-SA 4.0 |
| yue | UD_Cantonese-HK | CC BY-SA 4.0 |
