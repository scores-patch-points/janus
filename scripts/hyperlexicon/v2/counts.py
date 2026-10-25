"""v2/counts.py — uses counted, not stored (V2-PREREG.md, counters). Every document after its frontmatter, v1's token rule (common.TOKEN,
lower-cased): per type its uses, documents, dated uses and the dated span (the document's P1 resolution, lo..hi). Writes the counts of
EVERY type to <work>/counts-all.tsv.gz; v2/keep.py later keeps only the types a giver names or a record key holds.
  HL_OUT=<v2 dir> HL_ZEN=<zen> python -I v2/counts.py <work dir>"""
import os, sys, json, gzip, glob, collections, time, multiprocessing as mp
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from common import ZEN, OUT, WORKERS, TOKEN, front

def years():
    """doc id -> (lo, hi) from the ground's P1 resolutions (a conflict is undated)"""
    out = {}
    for fn in sorted(glob.glob(os.path.join(OUT, "events", "ground-*.jsonl.gz"))):
        with gzip.open(fn, "rt", encoding="utf8") as f:
            for line in f:
                e = json.loads(line)
                if e.get("k") == "resolution" and e.get("about") == "date" and e.get("lo") is not None: out[e["doc"]] = (e["lo"], e["hi"])
    return out

def count(doc):
    b = open(os.path.join(ZEN, doc["path"]), "rb").read()
    text = b.decode("utf8") if doc["utf8_clean"] else b.decode("utf8", "replace")
    _, body = front(text)
    return doc["id"], collections.Counter(m.group(0).lower() for m in TOKEN.finditer(text, body))

if __name__ == "__main__":
    work = sys.argv[1]; os.makedirs(work, exist_ok=True); t0 = time.time()
    docs = json.load(open(os.path.join(OUT, "docs.json"), encoding="utf8")); Y = years()
    uses, ndocs, duses, lo, hi = collections.Counter(), collections.Counter(), collections.Counter(), {}, {}
    mp.set_start_method("fork")
    with mp.Pool(WORKERS) as pool:
        for k, (did, c) in enumerate(pool.imap(count, docs, chunksize=4)):
            y = Y.get(did)
            for t, n in c.items():
                uses[t] += n; ndocs[t] += 1
                if y:
                    duses[t] += n
                    if t not in lo or y[0] < lo[t]: lo[t] = y[0]
                    if t not in hi or y[1] > hi[t]: hi[t] = y[1]
            if k % 2000 == 0: print(f"counts {k}/{len(docs)} types {len(uses)} {time.time()-t0:.0f}s", flush=True)
    with gzip.GzipFile(os.path.join(work, "counts-all.tsv.gz"), "wb", mtime=0) as f:
        for t in sorted(uses): f.write(f"{t}\t{uses[t]}\t{ndocs[t]}\t{duses.get(t, 0)}\t{lo.get(t, '')}\t{hi.get(t, '')}\n".encode("utf8"))
    s = {"docs": len(docs), "types": len(uses), "tokens": sum(uses.values()), "dated_docs": len(Y), "seconds": round(time.time() - t0)}
    json.dump(s, open(os.path.join(work, "counts.summary.json"), "w"), indent=1); print(json.dumps(s), flush=True)
