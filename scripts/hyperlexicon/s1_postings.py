"""S1 (SIG): every use, kept and addressed. Two passes over the documents S0 inventoried: the vocabulary (lowercased types, ordered by count,
then by spelling), then exact postings for EVERY token of every document: (type id, start, length), in UTF-8 bytes when the file decodes
strictly (the weft's address `<source>#<byteOffset>`), else in code points with the document marked `offsets: char`. The fetcher's
frontmatter is metadata, not text: tokens start after it. No sampling, no stop list, no window."""
import os, sys, json, collections, time, multiprocessing as mp
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # run with python3 -I: the script's own folder only
from common import *

def read(doc):
    b = open(os.path.join(ZEN, doc["path"]), "rb").read()
    text = b.decode("utf8") if doc["utf8_clean"] else b.decode("utf8", "replace")
    _, body = front(text)
    return text, body

def pass1(doc):
    text, body = read(doc)
    return doc["id"], collections.Counter(m.group(0).lower() for m in TOKEN.finditer(text, body))

VOC = None
def pass2(doc):
    text, body = read(doc); rows = []
    if doc["utf8_clean"]:
        cpos, bpos = 0, 0
        for m in TOKEN.finditer(text, body):
            s, e = m.span(); bpos += len(text[cpos:s].encode("utf8")); cpos = s
            rows.append((VOC[m.group(0).lower()], bpos, len(text[s:e].encode("utf8"))))
    else:
        for m in TOKEN.finditer(text, body): rows.append((VOC[m.group(0).lower()], m.start(), m.end() - m.start()))
    a = np.array(rows, dtype=np.uint32).reshape(-1, 3)
    p = os.path.join(OUT, "postings", doc["id"] + ".npy"); np.save(p, a)
    return doc["id"], sha256_hex(open(p, "rb").read()), len(rows)

if __name__ == "__main__":
    mp.set_start_method("fork"); t0 = time.time(); os.makedirs(os.path.join(OUT, "postings"), exist_ok=True)
    docs = read_docs(); glob = collections.Counter()
    with mp.Pool(WORKERS) as pool:
        for k, (did, c) in enumerate(pool.imap(pass1, docs, chunksize=4)):
            glob.update(c)
            if k % 1000 == 0: print(f"pass1 {k}/{len(docs)} types {len(glob)} {time.time()-t0:.0f}s", flush=True)
    order = sorted(glob.items(), key=lambda kv: (-kv[1], kv[0]))
    with gzip.GzipFile(os.path.join(OUT, "vocab.tsv.gz"), "wb", mtime=0) as f:
        for t, c in order: f.write(f"{t}\t{c}\n".encode("utf8"))
    VOC = {t: i for i, (t, _) in enumerate(order)}; del glob, order
    print(f"vocab {len(VOC)} types {time.time()-t0:.0f}s", flush=True)
    byid = {d["id"]: d for d in docs}; sh = Shards(os.path.join(OUT, "events"), "postings")
    with mp.Pool(WORKERS) as pool:
        for k, (did, psha, n) in enumerate(pool.imap(pass2, docs, chunksize=4)):
            d = byid[did]; d["postings_sha256"], d["tokens"], d["offsets"] = psha, n, "byte" if d["utf8_clean"] else "char"
            sh.write(event({"k": "postings", "doc": did, "sha256": psha, "tokens": n, "offsets": d["offsets"], "columns": ["type", "start", "length"]}))
            if k % 1000 == 0: print(f"pass2 {k}/{len(docs)} {time.time()-t0:.0f}s", flush=True)
    sh.close(); json.dump(docs, open(os.path.join(OUT, "docs.json"), "w", encoding="utf8"))
    summ = {"docs": len(docs), "types": len(VOC), "tokens": sum(d["tokens"] for d in docs), "char_offset_docs": sum(1 for d in docs if d["offsets"] == "char"), "seconds": round(time.time() - t0)}
    json.dump(summ, open(os.path.join(OUT, "s1.summary.json"), "w"), indent=1); print(json.dumps(summ), flush=True)
