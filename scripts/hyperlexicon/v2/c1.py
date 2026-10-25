"""v2/c1.py — bar C1 (V2-PREREG.md, Amendment 2): 50 seeded stored types (seed 1), their uses and documents counted by a second program, a
plain scan over every Zenodotus file for just those types with v1's token rule, equal to v2's counters.
  HL_OUT=<v2 dir> HL_ZEN=<zen> python -I v2/c1.py"""
import os, sys, json, gzip, random, multiprocessing as mp
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from common import ZEN, OUT, WORKERS, TOKEN, front

WANT = {}

def scan(doc):
    b = open(os.path.join(ZEN, doc["path"]), "rb").read()
    text = b.decode("utf8") if doc["utf8_clean"] else b.decode("utf8", "replace")
    _, body = front(text); c = {}
    for m in TOKEN.finditer(text, body):
        t = m.group(0).lower()
        if t in WANT: c[t] = c.get(t, 0) + 1
    return c

if __name__ == "__main__":
    rows = [l.rstrip("\n").split("\t") for l in gzip.open(os.path.join(OUT, "counters", "types.tsv.gz"), "rt", encoding="utf8")]
    pick = random.Random(1).sample(rows, 50)
    WANT.update({r[0]: (int(r[1]), int(r[2])) for r in pick})
    docs = json.load(open(os.path.join(OUT, "docs.json"), encoding="utf8"))
    uses, ndocs = {t: 0 for t in WANT}, {t: 0 for t in WANT}
    mp.set_start_method("fork")
    with mp.Pool(WORKERS) as pool:
        for c in pool.imap(scan, docs, chunksize=8):
            for t, n in c.items(): uses[t] += n; ndocs[t] += 1
    bad = [{"type": t, "v2": WANT[t], "scan": (uses[t], ndocs[t])} for t in WANT if WANT[t] != (uses[t], ndocs[t])]
    print(json.dumps({"bar": "C1", "types": len(WANT), "equal": len(WANT) - len(bad), "pass": not bad, "bad": bad[:10]}))
