"""S3 (CON): the name join and exact counts. Every corpus type gets EVERY candidate lexical node the givers name for it, in every language
(no decision; the language of a document is a claim a consumer filters by, at query time). Exact per-(document, type) counts, so any ground
(a year range, an Atmosphere, a standpoint) is a sum over documents. Documents with no language claim get a `dictionary-coverage` claim:
the share of their tokens each giver language names (appended; the document's other claims are untouched)."""
import sys
import os, glob, json, gzip, collections, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # run with python3 -I: the script's own folder only
from common import *

if __name__ == "__main__":
    t0 = time.time(); docs = read_docs(); vtypes, vcounts = read_vocab(); V = len(vtypes)
    TID = {t: i for i, t in enumerate(vtypes)}
    strip = collections.defaultdict(list)            # marks-stripped key -> type ids, for the languages whose names drop marks
    for i, t in enumerate(vtypes):
        if not t.isascii(): strip[mkey(t, "ru")].append(i)
    from array import array
    TIDS, LANGS, NODES, KINDS = array("I"), array("H"), array("Q"), array("B")   # compact columns: the join can be tens of millions of rows
    LANG_ID, KIND_ID, langs_of = {}, {}, collections.defaultdict(set)
    for fn in sorted(glob.glob(os.path.join(OUT, "names-index", "*.tsv.gz"))):
        with gzip.open(fn, "rt", encoding="utf8") as f:
            for line in f:
                s, lang, node, kind = line.rstrip("\n").split("\t"); key = mkey(s, lang)
                tids = set(strip.get(key, ())) if lang in STRIP_LANGS else set()
                if key in TID: tids.add(TID[key])
                if not tids: continue
                li = LANG_ID.setdefault(lang, len(LANG_ID)); ki = KIND_ID.setdefault(kind, len(KIND_ID)); nv = int(node[2:], 16)
                for tid in tids: TIDS.append(tid); LANGS.append(li); NODES.append(nv); KINDS.append(ki); langs_of[tid].add(lang)
    tids, lng, nds, knd = (np.frombuffer(x, dtype=d) for x, d in ((TIDS, np.uint32), (LANGS, np.uint16), (NODES, np.uint64), (KINDS, np.uint8)))
    o = np.lexsort((knd, nds, lng, tids)); L = {v: k for k, v in LANG_ID.items()}; K = {v: k for k, v in KIND_ID.items()}
    with gzip.GzipFile(os.path.join(OUT, "cands.tsv.gz"), "wb", mtime=0) as f:
        prev, nrows = None, 0                       # a name can reach a type twice (marks stripped and exact): written once
        for i in o.tolist():
            row = (int(tids[i]), L[int(lng[i])], f"n_{int(nds[i]):016x}", K[int(knd[i])])
            if row != prev: f.write(("\t".join(map(str, row)) + "\n").encode("utf8")); prev = row; nrows += 1
    del TIDS, LANGS, NODES, KINDS, tids, lng, nds, knd, o
    named = len(langs_of); print(f"join: {nrows} (type, node) candidates; {named} of {V} types named by a giver {time.time()-t0:.0f}s", flush=True)
    # exact counts per document (CSR), and coverage claims for documents with no language claim
    indptr, T, C = [0], [], []; sh = Shards(os.path.join(OUT, "events"), "coverage"); ncov = 0
    langlist = sorted({l for s in langs_of.values() for l in s}); LI = {l: i for i, l in enumerate(langlist)}
    for d in docs:
        a = postings(d); u, c = np.unique(a[:, 0], return_counts=True) if len(a) else (np.array([], np.uint32), np.array([], np.int64))
        T.append(u.astype(np.uint32)); C.append(c.astype(np.uint32)); indptr.append(indptr[-1] + len(u))
        if d["lang"] == "und" and len(u):
            share = np.zeros(len(langlist)); tot = c.sum()
            for t, n in zip(u.tolist(), c.tolist()):
                for l in langs_of.get(t, ()): share[LI[l]] += n
            top = np.argsort(-share)[:3]
            best = [{"lang": langlist[i], "share": round(float(share[i] / tot), 4)} for i in top if share[i] > 0]
            if best:
                sh.write(event({"k": "claim", "doc": d["id"], "about": "language", "value": best[0]["lang"], "method": "dictionary-coverage",
                                "basis": f"share of tokens a giver names in each language: {best}"})); ncov += 1
                d["lang"], d["lang_method"] = best[0]["lang"], "dictionary-coverage"
    sh.close()
    np.savez_compressed(os.path.join(OUT, "doccounts.npz"), indptr=np.array(indptr, dtype=np.int64), types=np.concatenate(T) if T else np.array([], np.uint32),
                        counts=np.concatenate(C) if C else np.array([], np.uint32), docs=np.array([d["id"] for d in docs]))
    json.dump(docs, open(os.path.join(OUT, "docs.json"), "w", encoding="utf8"))
    summ = {"candidates": nrows, "types_named": named, "types": V, "coverage_claims": ncov, "doc_type_entries": indptr[-1], "seconds": round(time.time() - t0)}
    json.dump(summ, open(os.path.join(OUT, "s3.summary.json"), "w"), indent=1); print(json.dumps(summ), flush=True)
