"""v2/fold.py — the record of changes (V2-PREREG.md part 3). The documents read (one sightings file each, v2/read.mjs) in READING ORDER:
dated documents by their P1 year (lo, then hi), then undated documents, each group by path. A key's standing is kernel/notes.js standingOf
over the documents that witness it: one document is single-witness, two are corroborated. A key reaches the record when its standing
first changes, with the two witnesses that changed it (birth, corroboration: <doc id>#<byte offset>) and its counters. Every other
sighting is a NUL: counted, not stored. Keys are spread over 64 buckets by hash so no pass holds them all.
  HL_OUT=<v2 dir> python -I v2/fold.py <work dir>
Writes <v2>/record/record.tsv.gz (sorted: grain, key, birth, corroboration, documents, sightings, earliest, latest), record/summary.json,
and <work>/gaps.tsv.gz: per corroborated key, the reading-order distance from birth to corroboration and the smallest distance between
consecutive witnessing documents (the DMD measurement, v2/dmd.mjs)."""
import os, sys, json, gzip, glob, hashlib, collections, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from common import OUT

NB = 64

def years():
    out = {}
    for fn in sorted(glob.glob(os.path.join(OUT, "events", "ground-*.jsonl.gz"))):
        with gzip.open(fn, "rt", encoding="utf8") as f:
            for line in f:
                e = json.loads(line)
                if e.get("k") == "resolution" and e.get("about") == "date" and e.get("lo") is not None: out[e["doc"]] = (e["lo"], e["hi"])
    return out

if __name__ == "__main__":
    work = sys.argv[1]; t0 = time.time()
    docs = {d["id"]: d for d in json.load(open(os.path.join(OUT, "docs.json"), encoding="utf8"))}; Y = years()
    read = [os.path.basename(p)[:-7] for p in glob.glob(os.path.join(work, "sightings", "*.tsv.gz"))]
    order = sorted(read, key=lambda i: (0, Y[i][0], Y[i][1], docs[i]["path"]) if i in Y else (1, 0, 0, docs[i]["path"]))
    bdir = os.path.join(work, "buckets"); os.makedirs(bdir, exist_ok=True)
    bs = [gzip.open(os.path.join(bdir, f"b{k:02d}.tsv.gz"), "wt", encoding="utf8", compresslevel=1) for k in range(NB)]
    errors, edges = 0, 0
    for i, did in enumerate(order):
        with gzip.open(os.path.join(work, "sightings", did + ".tsv.gz"), "rt", encoding="utf8") as f:
            for line in f:
                if line.startswith("#"):
                    m = json.loads(line[1:]); errors += bool(m.get("error")); edges += m.get("edges") or 0; continue
                g, key, at, n = line.rstrip("\n").split("\t")
                b = int.from_bytes(hashlib.blake2b(key.encode("utf8"), digest_size=2).digest(), "big") % NB
                bs[b].write(f"{i}\t{g}\t{key}\t{at}\t{n}\n")
        if i % 500 == 0: print(f"spread {i}/{len(order)} {time.time()-t0:.0f}s", flush=True)
    for f in bs: f.close()
    rows, gaps = [], []
    S = {g: collections.Counter() for g in ("s", "c")}
    for k in range(NB):
        keys = collections.defaultdict(list)
        with gzip.open(os.path.join(bdir, f"b{k:02d}.tsv.gz"), "rt", encoding="utf8") as f:
            for line in f:
                i, g, key, at, n = line.rstrip("\n").split("\t"); keys[(g, key)].append((int(i), int(at), int(n)))
        for (g, key), ws in keys.items():
            ws.sort(); s = S[g]; n = sum(w[2] for w in ws)
            s["keys"] += 1; s["sightings"] += n
            if len(ws) < 2: s["single_witness_not_stored"] += 1; s["nul"] += n - 1; continue
            (i0, a0, _), (i1, a1, _) = ws[0], ws[1]
            ys = [Y[order[w[0]]] for w in ws if order[w[0]] in Y]
            rows.append((g, key, f"{order[i0]}#{a0}", f"{order[i1]}#{a1}", len(ws), n, min((y[0] for y in ys), default=""), max((y[1] for y in ys), default="")))
            s["corroborated"] += 1; s["nul"] += n - 2
            gaps.append(f"{g}\t{i1 - i0}\t{min(ws[j + 1][0] - ws[j][0] for j in range(len(ws) - 1))}")
        print(f"fold bucket {k}/{NB} rows {len(rows)} {time.time()-t0:.0f}s", flush=True)
    rows.sort(key=lambda r: (r[0], r[1]))
    os.makedirs(os.path.join(OUT, "record"), exist_ok=True)
    with gzip.GzipFile(os.path.join(OUT, "record", "record.tsv.gz"), "wb", mtime=0) as f:
        for r in rows: f.write(("\t".join(str(x) for x in r) + "\n").encode("utf8"))
    with gzip.GzipFile(os.path.join(work, "gaps.tsv.gz"), "wb", mtime=0) as f: f.write(("\n".join(sorted(gaps)) + "\n").encode("utf8"))
    summ = {"documents_read": len(order), "dated": sum(1 for i in order if i in Y), "reader_errors": errors, "arrangements": edges,
            "grains": {("slot" if g == "s" else "composition"): dict(c) for g, c in S.items()},
            "rule": "a key reaches the record when its standing first changes (notes.js standingOf: single-witness -> corroborated), with the two witnesses that changed it; every other sighting is counted",
            "seconds": round(time.time() - t0)}
    json.dump(summ, open(os.path.join(OUT, "record", "summary.json"), "w"), indent=1); print(json.dumps(summ), flush=True)
