# DEV-only gold census for the claim-graph-universe pre-registration (EXPLORATORY, no arm scored).
# Gold = link TARGETS in the document's own wikitext: two in-prose mentions with the same target are the same being (alias gold);
# the target is never given to any arm. DISJOINT = the two anchors share no stemmed token (no string handle between them).
import json, sys, collections, unicodedata
def fold(t): return "".join(c for c in unicodedata.normalize("NFKD", t) if not unicodedata.combining(c))
def stem(t):
    if len(t) >= 5 and t.endswith("es"): return t[:-2]
    if len(t) >= 4 and t.endswith("s"): return t[:-1]
    return t
def toks(s):
    out, cur = [], []
    for c in fold(s).lower():
        if c.isalnum(): cur.append(c)
        elif cur: out.append("".join(cur)); cur = []
    if cur: out.append("".join(cur))
    return {stem(t) for t in out}
Q = json.load(open(sys.argv[1])); tot = collections.Counter(); per = []
for q in Q:
    d = json.load(open(q["file"])); by = collections.defaultdict(list)
    for l in d["links"]: by[l["target"]].append(l)
    pairs = dis = 0
    for t, ls in by.items():
        for i in range(len(ls)):
            for j in range(i):
                a, b = toks(ls[i]["anchor"]), toks(ls[j]["anchor"])
                if ls[i]["anchor"].lower() == ls[j]["anchor"].lower(): continue
                pairs += 1; dis += not (a & b)
    tot["docs"] += 1; tot["mentions"] += len(d["links"]); tot["alias pairs (distinct anchor strings)"] += pairs; tot["  of which DISJOINT (no shared stemmed token)"] += dis
    per.append(dis)
print(dict(tot)); print("DISJOINT pairs per document:", sorted(per))
