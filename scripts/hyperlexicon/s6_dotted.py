"""S6 (USE): the dotted share (DOTTED-PREREG.md). For every token of every byte-addressed document in the log, in the document's working
language: is the byte straight after it a period, and when it is (and is not an ellipsis), what follows the period — a lower-case letter,
an upper-case letter, a digit, another mark, or the end of the line. A use-derived count, read off L0's postings and the Zenodotus bytes,
written beside L1; nothing is sampled, and nothing is claimed about any word (the reader's rule is DOTTED-PREREG.md's Rule H).
Out: <OUT>/use/dotted.tsv.gz       lang, type id, type, n (its uses in that language, L1's exact counts), d (written with a period),
                                   then after the period: lower, upper, digit, mark, end, and ellipsis (".." — not counted in d)
     <OUT>/use/dotted.manifest.json  the L0 head, this script's sha256, documents and tokens read, rows written
Run with the build's own environment: HL_ZEN, HL_OUT, HL_WORKERS (python3 -I s6_dotted.py)."""
import sys
import os, json, gzip, time, hashlib
from multiprocessing import Pool
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

L1 = os.path.join(OUT, "l1")
USE = os.environ.get("HL_USE", os.path.join(OUT, "use"))   # a smoke run writes elsewhere
PERIOD, SPACE, TAB, LF, CR = 46, 32, 9, 10, 13
# the columns after d, in order
AFTER = ("lower", "upper", "digit", "mark", "end", "ellipsis")


def scan(doc):
    """One document: {type id: [d, lower, upper, digit, mark, end, ellipsis]} for the types written with a period straight after."""
    try:
        src = open(os.path.join(ZEN, doc["path"]), "rb").read()
    except OSError:
        return doc["lang"], None, 0
    p = np.load(os.path.join(OUT, "postings", doc["id"] + ".npy"))
    if p.size == 0:
        return doc["lang"], {}, 0
    arr = np.frombuffer(src, dtype=np.uint8); size = len(arr)
    ends = p[:, 1].astype(np.int64) + p[:, 2].astype(np.int64)
    inside = ends < size
    dot = np.zeros(len(p), dtype=bool); dot[inside] = arr[ends[inside]] == PERIOD
    out = {}
    for i in np.nonzero(dot)[0]:
        t = int(p[i, 0]); at = int(ends[i]) + 1
        c = out.get(t)
        if c is None: c = out[t] = [0, 0, 0, 0, 0, 0, 0]
        if at < size and arr[at] == PERIOD:          # an ellipsis is not the word's period
            c[6] += 1; continue
        c[0] += 1
        j = at
        while j < size:                              # spaces, tabs and no-break spaces before what follows
            if arr[j] in (SPACE, TAB): j += 1
            elif arr[j] == 0xC2 and j + 1 < size and arr[j + 1] == 0xA0: j += 2
            else: break
        if j >= size or arr[j] in (LF, CR):
            c[5] += 1; continue
        b = arr[j]
        ch = chr(b) if b < 128 else (src[j:j + 4].decode("utf8", "ignore")[:1] or "?")
        if ch.islower(): c[1] += 1
        elif ch.isupper(): c[2] += 1
        elif ch.isdigit(): c[3] += 1
        else: c[4] += 1
    return doc["lang"], out, len(p)


def main():
    t0 = time.time()
    docs = [json.loads(l) for l in open(os.path.join(L1, "docs.jsonl"), encoding="utf8")]   # every document: L1's counts index them all
    scanned = docs[:SMOKE] if SMOKE else docs
    head = json.load(open(os.path.join(L1, "manifest.json")))["compiled_from_head"]
    acc = {}                                          # (lang, type) -> counts
    read = absent = tokens = 0
    with Pool(WORKERS) as pool:
        for lang, out, n in pool.imap_unordered(scan, scanned, chunksize=16):
            if out is None: absent += 1; continue
            read += 1; tokens += n
            for t, c in out.items():
                k = (lang, t); a = acc.get(k)
                if a is None: acc[k] = c
                else:
                    for x in range(7): a[x] += c[x]
            if read % 5000 == 0: print(f"{read} documents · {len(acc)} (lang, type) pairs · {time.time() - t0:.0f} s", flush=True)
    # n: the type's uses in the language, from L1's exact type-document counts
    off = np.fromfile(os.path.join(L1, "t2d.off"), dtype=np.uint64)
    tdoc = np.memmap(os.path.join(L1, "t2d.doc"), dtype=np.uint32, mode="r")
    tcnt = np.memmap(os.path.join(L1, "t2d.cnt"), dtype=np.uint32, mode="r")
    langs = sorted({d["lang"] for d in docs}, key=str)
    lid = {l: i for i, l in enumerate(langs)}
    doclang = np.array([lid[d["lang"]] for d in docs], dtype=np.int32)
    vb = open(os.path.join(L1, "vocab.bin"), "rb").read(); voff = np.fromfile(os.path.join(L1, "vocab.off"), dtype=np.uint64)
    os.makedirs(USE, exist_ok=True)
    rows = 0
    raw = open(os.path.join(USE, "dotted.tsv.gz"), "wb")
    with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as f:
        f.write(("\t".join(("lang", "type", "surface", "n", "d") + AFTER) + "\n").encode("utf8"))
        for (lang, t) in sorted(acc, key=lambda k: (str(k[0]), k[1])):
            a, b = int(off[t]), int(off[t + 1])
            ds = np.asarray(tdoc[a:b]); cs = np.asarray(tcnt[a:b])
            n = int(cs[doclang[ds] == lid[lang]].sum())
            surface = vb[int(voff[t]):int(voff[t + 1])].decode("utf8")
            f.write(("\t".join([str(lang), str(t), surface, str(n)] + [str(x) for x in acc[(lang, t)]]) + "\n").encode("utf8"))
            rows += 1
    raw.close()
    me = hashlib.sha256(open(os.path.abspath(__file__), "rb").read()).hexdigest()
    man = {"schema": "HyperlexiconUse@1", "stage": "s6 dotted share", "compiled_from_head": head, "script_sha256": me,
           "documents_read": read, "documents_absent": absent, "tokens": tokens, "rows": rows, "columns": ["lang", "type", "surface", "n", "d", *AFTER],
           "seconds": round(time.time() - t0, 1), "prereg": "scripts/hyperlexicon/DOTTED-PREREG.md"}
    json.dump(man, open(os.path.join(USE, "dotted.manifest.json"), "w"), indent=1)
    print(json.dumps(man))


if __name__ == "__main__":
    main()
