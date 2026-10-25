"""v2/keep.py — the counters v2 keeps (V2-PREREG.md, counters): of every type's counts (<work>/counts-all.tsv.gz), only the types a giver
names in some language (a name's surface, lower-cased) or a record key holds (a slot's head word). Any other type makes no difference to a
reader of the hyperlexicon: it is counted in the summary, not stored. Then the v2 manifest and head.
  HL_OUT=<v2 dir> python -I v2/keep.py <work dir>"""
import os, sys, json, gzip, hashlib, subprocess, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from common import OUT

if __name__ == "__main__":
    work = sys.argv[1]; t0 = time.time(); want = set()
    with gzip.open(os.path.join(OUT, "givers", "names.tsv.gz"), "rt", encoding="utf8") as f:
        for line in f: want.add(line.split("\t", 1)[0])
    named = len(want)
    with gzip.open(os.path.join(OUT, "record", "record.tsv.gz"), "rt", encoding="utf8") as f:
        for line in f:
            g, key = line.split("\t", 2)[:2]
            if g == "s": want.add(key.split("|", 1)[0])
    kept = dropped = dropped_uses = 0
    os.makedirs(os.path.join(OUT, "counters"), exist_ok=True)
    with gzip.open(os.path.join(work, "counts-all.tsv.gz"), "rt", encoding="utf8") as f, gzip.GzipFile(os.path.join(OUT, "counters", "types.tsv.gz"), "wb", mtime=0) as o:
        for line in f:
            t = line.split("\t", 1)[0]
            if t in want: o.write(line.encode("utf8")); kept += 1
            else: dropped += 1; dropped_uses += int(line.split("\t")[1])
    s = {"kept": kept, "not_stored": dropped, "not_stored_uses": dropped_uses, "named_surfaces": named, "seconds": round(time.time() - t0),
         "rule": "a type is kept when a giver names it (lower-cased surface) or a record slot holds it; the rest are counted here"}
    json.dump(s, open(os.path.join(OUT, "counters", "summary.json"), "w"), indent=1)
    # the manifest: sha256 of every file v2 holds, then the head (sha256 of the manifest)
    files = sorted(os.path.relpath(os.path.join(r, x), OUT) for r, _, fs in os.walk(OUT) for x in fs if x not in ("manifest.sha256", "head.sha256"))
    with open(os.path.join(OUT, "manifest.sha256"), "w") as m:
        for p in files: m.write(f"{hashlib.sha256(open(os.path.join(OUT, p), 'rb').read()).hexdigest()}  {p}\n")
    head = hashlib.sha256(open(os.path.join(OUT, "manifest.sha256"), "rb").read()).hexdigest()
    open(os.path.join(OUT, "head.sha256"), "w").write(f"{head}  manifest.sha256\n")
    total = sum(os.path.getsize(os.path.join(OUT, p)) for p in files) + os.path.getsize(os.path.join(OUT, "manifest.sha256"))
    print(json.dumps({**s, "head": head, "bytes": total}), flush=True)
