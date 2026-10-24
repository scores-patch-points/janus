"""S5 (SYN): compile L1, the fast-reading projection of the L0 log (HYPERLEXICON-V1-JANUS-PLAN.md section 3; HYPERLEXICON-FORMAT.md section 2,
without the smear: no sampled witnesses, no company lists, no fingerprints). Everything here is recomputable from L0; the postings stay cold
beside it and are read on demand. Sections (flat little-endian arrays plus small JSON):
  vocab.bin + vocab.off(u64)     type strings by type id (UTF-8)            sorted.ids(u32)   type ids in UTF-8 byte order, for lookup
  cands.off(u64) cands.lang(u16) cands.kind(u8) cands.node(u64)            every candidate node per type, undecided (langs.json, kinds.json)
  t2d.off(u64) t2d.doc(u32) t2d.cnt(u32)                                   the documents each type occurs in, with exact counts
  docs.jsonl                     per document: id, path, sha256, offsets, tokens, and its ground claims as {value, basis}
  nodes.bin + nodes.idx.json     the givers' records per lexical node (names, senses, relations, links, standing), gzip chunks by node id
  manifest.json                  sha256 of every section, counts, and the L0 head hash it was compiled from"""
import sys
import os, json, gzip, glob, collections, subprocess, time, tempfile
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # run with python3 -I: the script's own folder only
from common import *

L1 = os.path.join(OUT, "l1")
PRIORITY = {"frontmatter": 0, "header-line": 1, "folder": 2, "dictionary-coverage": 3}

def save(name, arr): arr.tofile(os.path.join(L1, name))

def sections_types():
    types, _ = read_vocab(); enc = [t.encode("utf8") for t in types]
    off = np.zeros(len(enc) + 1, dtype=np.uint64); off[1:] = np.cumsum([len(b) for b in enc])
    with open(os.path.join(L1, "vocab.bin"), "wb") as f:
        for b in enc: f.write(b)
    save("vocab.off", off)
    save("sorted.ids", np.array(sorted(range(len(enc)), key=lambda i: enc[i]), dtype=np.uint32))
    return len(enc)

def sections_cands(V):
    langs, kinds, rows = {}, {}, []
    T, Lg, K, N = [], [], [], []
    with gzip.open(os.path.join(OUT, "cands.tsv.gz"), "rt", encoding="utf8") as f:
        for line in f:
            t, lang, node, kind = line.rstrip("\n").split("\t")
            T.append(int(t)); Lg.append(langs.setdefault(lang, len(langs))); K.append(kinds.setdefault(kind, len(kinds))); N.append(int(node[2:], 16))
    T = np.array(T, dtype=np.uint32); off = np.zeros(V + 1, dtype=np.uint64); np.add.at(off, T.astype(np.int64) + 1, 1); off = np.cumsum(off).astype(np.uint64)
    save("cands.off", off); save("cands.lang", np.array(Lg, dtype=np.uint16)); save("cands.kind", np.array(K, dtype=np.uint8)); save("cands.node", np.array(N, dtype=np.uint64))
    json.dump(sorted(langs, key=langs.get), open(os.path.join(L1, "langs.json"), "w")); json.dump(sorted(kinds, key=kinds.get), open(os.path.join(L1, "kinds.json"), "w"))
    return len(T)

def sections_t2d(V):
    z = np.load(os.path.join(OUT, "doccounts.npz")); indptr, types, counts = z["indptr"], z["types"], z["counts"]
    docidx = np.repeat(np.arange(len(indptr) - 1, dtype=np.uint32), np.diff(indptr).astype(np.int64))
    o = np.argsort(types, kind="stable")                      # stable: within a type, documents stay in document order
    off = np.zeros(V + 1, dtype=np.uint64); np.add.at(off, types.astype(np.int64) + 1, 1); off = np.cumsum(off).astype(np.uint64)
    save("t2d.off", off); save("t2d.doc", docidx[o]); save("t2d.cnt", counts[o].astype(np.uint32))
    return len(types)

def sections_docs():
    docs = read_docs(); idx = {d["id"]: i for i, d in enumerate(docs)}; ground = [dict() for _ in docs]
    def put(i, about, value, basis, method):
        g = ground[i]; p = PRIORITY.get(method, 9)
        if about not in g or p < g[about][2]: g[about] = (value, basis, p)
    for prefix in ("ground", "coverage"):
        for e in read_events(prefix):
            i = idx.get(e.get("doc"))
            if i is None: continue
            if e["k"] == "claim" and e.get("method") not in ("zen-index", "date-ants"):   # dates enter through their P1 resolution
                put(i, e["about"], e.get("value"), e.get("basis"), e.get("method"))
            elif e["k"] == "resolution" and e.get("about") == "date":
                v = None if e.get("gap") else {"lo": e.get("lo"), "hi": e.get("hi")}
                put(i, "date_p1", v, "resolution P1 of zen-index and date-ant claims" + (f" (gap: {e['gap']})" if e.get("gap") else ""), "resolution")
    with open(os.path.join(L1, "docs.jsonl"), "w", encoding="utf8") as f:
        for i, d in enumerate(docs):
            g = {k: {"value": v[0], "basis": v[1]} for k, v in sorted(ground[i].items())}
            f.write(json.dumps({"i": i, "id": d["id"], "path": d["path"], "sha256": d["sha256"], "offsets": d.get("offsets"), "tokens": d.get("tokens", 0),
                                "lang": d.get("lang"), "lang_method": d.get("lang_method"), "atmosphere": d.get("atmosphere"), "ground": g}, ensure_ascii=False) + "\n")
    return len(docs)

def sections_nodes():
    """Group the givers' name/def/rel/link events by node with an external sort (bounded memory), then write gzip chunks of 2,048 nodes."""
    tmp = tempfile.mkdtemp(dir=OUT); raw = os.path.join(tmp, "byn.tsv")
    with open(raw, "w", encoding="utf8") as out:
        for fn in sorted(glob.glob(os.path.join(OUT, "events", "dict-*.jsonl.gz"))):
            with gzip.open(fn, "rt", encoding="utf8") as f:
                for line in f:
                    e = json.loads(line); k = e["k"]
                    if k == "giver": continue
                    node = e.get("node") if k in ("name", "def") else e.get("from")
                    if node: out.write(node + "\t" + line.rstrip("\n").replace("\t", " ") + "\n")
    srt = raw + ".sorted"
    subprocess.run(["sort", "-S", "3G", "-t", "\t", "-k1,1", "-s", "-o", srt, raw], check=True, env={**os.environ, "LC_ALL": "C"})
    os.remove(raw); idx, nnodes = [], 0
    with open(srt, encoding="utf8") as f, open(os.path.join(L1, "nodes.bin"), "wb") as out:
        cur, recs, chunk, first = None, [], [], None
        def flush_node():
            nonlocal nnodes
            if cur is None: return
            r = {"node": cur, "names": [], "senses": [], "rel": [], "links": [], "givers": set()}
            for e in recs:
                k = e["k"]; r["givers"].add(e.get("giver"))
                if k == "name": r["names"].append({x: e.get(x) for x in ("surface", "lang", "kind", "pos", "of", "tags")})
                elif k == "def": r.setdefault("lang", e.get("lang")); r.setdefault("lemma", e.get("lemma")); r["senses"].append({x: e.get(x) for x in ("pos", "sense", "g", "tags", "giver")})
                elif k == "rel": r["rel"].append({x: e.get(x) for x in ("rel", "to", "to_lemma", "label", "level", "sense", "giver", "standing", "tier")})
                elif k == "link": r["links"].append({x: e.get(x) for x in ("kind", "to", "to_lang", "to_lemma", "giver", "standing", "tier")})
            if "lang" not in r and r["names"]: r["lang"] = r["names"][0]["lang"]; r["lemma"] = next((n["surface"] for n in r["names"] if n["kind"] == "lemma"), None)
            r["givers"] = sorted(g for g in r["givers"] if g); chunk.append(json.dumps(r, ensure_ascii=False)); nnodes += 1
        def flush_chunk():
            if not chunk: return
            b = gzip.compress(("\n".join(chunk) + "\n").encode("utf8"), mtime=0); idx.append([first, out.tell(), len(b), len(chunk)]); out.write(b); chunk.clear()
        for line in f:
            node, ev = line.split("\t", 1)
            if node != cur:
                flush_node(); recs = []
                if len(chunk) >= 2048: flush_chunk()
                if not chunk: first = node
                cur = node
            recs.append(json.loads(ev))
        flush_node(); flush_chunk()
    os.remove(srt); os.rmdir(tmp)
    json.dump(idx, open(os.path.join(L1, "nodes.idx.json"), "w"))
    return nnodes

if __name__ == "__main__":
    t0 = time.time(); os.makedirs(L1, exist_ok=True); counts = {}
    counts["types"] = sections_types(); print(f"types {counts['types']} {time.time()-t0:.0f}s", flush=True)
    counts["candidates"] = sections_cands(counts["types"]); print(f"cands {counts['candidates']} {time.time()-t0:.0f}s", flush=True)
    counts["type_doc_entries"] = sections_t2d(counts["types"]); print(f"t2d {counts['type_doc_entries']} {time.time()-t0:.0f}s", flush=True)
    counts["docs"] = sections_docs(); print(f"docs {counts['docs']} {time.time()-t0:.0f}s", flush=True)
    counts["nodes"] = sections_nodes(); print(f"nodes {counts['nodes']} {time.time()-t0:.0f}s", flush=True)
    head = open(os.path.join(OUT, "head.sha256")).read().split()[0] if os.path.exists(os.path.join(OUT, "head.sha256")) else None
    def filehash(p):
        import hashlib; h = hashlib.sha256()
        with open(p, "rb") as f:
            for b in iter(lambda: f.read(1 << 24), b""): h.update(b)
        return h.hexdigest()
    secs = {n: filehash(os.path.join(L1, n)) for n in sorted(os.listdir(L1)) if n != "manifest.json"}
    json.dump({"schema": "HyperlexiconL1@1", "compiled_from_head": head, "counts": counts, "sections": secs, "seconds": round(time.time() - t0)},
              open(os.path.join(L1, "manifest.json"), "w"), indent=1)
    print(json.dumps(counts), flush=True)
