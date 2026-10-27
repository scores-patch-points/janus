"""Measure a Russian ending inventory from the givers' form-of rows in HyperlexiconBin@1 (no word list, no model).
For each (form, lemma) pair a giver lists with kind form-of in ru and the same pos, the stem is their longest common prefix; the rule is
(lemma suffix -> form suffix). Kept with its count, distinct lemmas, and witnesses (the first pairs seen). usage: python -I ending_inventory_rus.py <v2 dir> <out json>"""
import sys, json, collections
import numpy as np
D, OUT = sys.argv[1] + "/", sys.argv[2]
m = json.load(open(D + "manifest.json")); langs, kinds, pos = m["langs"], m["kinds"], m["pos"]
ru, fo = langs.index("ru"), kinds.index("form-of")
def tbl(p):
    off = np.fromfile(D + p + ".off", "<u8"); return off, open(D + p + ".bin", "rb").read()
so, sb = tbl("names.surface"); oo, ob = tbl("names.of")
grp = np.fromfile(D + "names.grp", "<u4"); nl = np.fromfile(D + "names.lang", "<u2"); nk = np.fromfile(D + "names.kind", "u1"); np_ = np.fromfile(D + "names.pos", "u1"); nof = np.fromfile(D + "names.of", "<u4")
sel = np.nonzero((nl == ru) & (nk == fo) & (nof != 0xFFFFFFFF))[0]
surf_of_row = np.repeat(np.arange(len(grp) - 1), np.diff(grp))
rules = collections.defaultdict(lambda: {"count": 0, "lemmas": set(), "witnesses": []})
pairs = 0
for r in sel:
    f = sb[so[surf_of_row[r]]:so[surf_of_row[r] + 1]].decode("utf8").replace("\u0301", "").replace("\u0300", ""); l = ob[oo[nof[r]]:oo[nof[r] + 1]].decode("utf8").replace("\u0301", "").replace("\u0300", "")   # the giver marks stress; the text does not
    if not f or not l or " " in f or " " in l or not f.islower() or not l.islower(): continue   # single lower-case words only
    k = 0
    while k < min(len(f), len(l)) and f[k] == l[k]: k += 1
    if k < 2 or len(f) - k > 4 or len(l) - k > 4: continue                                         # a stem of 2+ letters, endings of at most 4
    key = (pos[np_[r]], l[k:], f[k:]); R = rules[key]; R["count"] += 1; R["lemmas"].add(l); pairs += 1
    if len(R["witnesses"]) < 3: R["witnesses"].append([f, l])
inv = [{"pos": p, "lemmaEnd": le, "formEnd": fe, "forms": R["count"], "lemmas": len(R["lemmas"]), "witnesses": R["witnesses"]}
       for (p, le, fe), R in rules.items() if len(R["lemmas"]) >= 20]
inv.sort(key=lambda x: -x["lemmas"])
json.dump({"schema": "EndingInventory@1", "language": "rus",
           "provenance": {"giver": "English Wiktionary form-of rows in HyperlexiconBin@1", "built_from": m["from_v1_head"], "pairs_used": pairs,
                          "rule": "stem = longest common prefix (>=2 letters, endings <=4 letters, single lower-case words); a rule is kept when >=20 distinct lemmas carry it"},
           "declared": {"scope": "inflectional endings the givers list for Russian; a form no rule reaches returns a gap in the consuming organ"},
           "rules": inv}, open(OUT, "w"), ensure_ascii=False, indent=1)
print("pairs", pairs, "rules kept", len(inv)); [print(x["pos"], repr(x["lemmaEnd"]), "->", repr(x["formEnd"]), x["lemmas"], x["witnesses"][:2]) for x in inv[:14]]
