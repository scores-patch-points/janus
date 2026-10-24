"""S0 (NUL): the ground. Inventory every Zenodotus collection; one `doc` event per file (path, sha256, bytes, UTF-8 cleanliness);
every claim a document carries becomes a `claim` event with its basis, never a guess: frontmatter fields (with their `<field>_basis`
when the fetcher wrote one), a UDHR-style `Language: Name (code)` header line, the curator's folder placement, and the date claims of
the zen-index and the date ants; then the P1 date resolution as one `resolution` event per dated document. Writes docs.json for S1."""
import os, sys, json, re, collections, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # run with python3 -I: the script's own folder only
from common import *

CODE = re.compile(r"^[a-z]{2,3}(-[a-z0-9]{2,8})?$")
ORIGINALS = {"arabic-originals": "ar", "chinese-originals": "zh", "french-originals": "fr", "german-originals": "de", "greek-originals": "grc",
             "italian-originals": "it", "japanese-originals": "ja", "latin-originals": "la", "old-norse-originals": "non", "persian-originals": "fa",
             "sanskrit-originals": "sa", "tamil-originals": "ta", "avestan": "ae", "egyptian": "egy", "mesopotamian": "akk"}
NAME2CODE = {"english": "en", "spanish": "es", "french": "fr", "german": "de", "chinese": "zh", "latin": "la", "greek": "grc", "arabic": "ar",
             "sanskrit": "sa", "portuguese": "pt", "italian": "it", "japanese": "ja", "tamil": "ta"}
UDHR = re.compile(r"^Language:\s*(.+?)\s*\(([^)]+)\)\s*$", re.M)
P1 = {"zen_kinds": ["frontmatter(publication)", "frontmatter(enacted)"],
      "ant_kinds": ["copyright", "imprint", "first-published", "original-publication", "preface-signoff", "roman-numeral-year"],
      "ant_min_confidence": 0.8, "conflict_years": 5}

def inventory():
    files, skipped = [], collections.Counter()
    for top in corpus_dirs():
        for root, ds, fs in os.walk(os.path.join(ZEN, top)):
            ds[:] = sorted(d for d in ds if not d.startswith("."))
            for f in sorted(fs):
                rel = os.path.relpath(os.path.join(root, f), ZEN)
                if f.lower().endswith((".txt", ".md")) and not f.startswith("."): files.append(rel)
                else: skipped[f"{top}|{os.path.splitext(f)[1].lower() or '(none)'}"] += 1
    if SMOKE: files = sorted(sorted(files, key=lambda r: sha256_hex(r.encode()))[:SMOKE])
    return files, skipped

def norm_lang(v):
    v = str(v).strip().strip("\"'").lower(); first = re.split(r"[\s(/,+;]", v, 1)[0]
    return NAME2CODE.get(first, first)

def ground(rel):
    b = open(os.path.join(ZEN, rel), "rb").read()
    try: text = b.decode("utf8"); clean = True
    except UnicodeDecodeError: text = b.decode("utf8", "replace"); clean = False
    parts = rel.split("/"); fm, _ = front(text)
    d = {"path": rel, "sha256": sha256_hex(b), "bytes": len(b), "utf8_clean": clean, "atmosphere": re.sub(r"^\d+-", "", parts[0]),
         "collection": "/".join(parts[:2]) if len(parts) > 2 else parts[0]}
    d["id"] = "d_" + sha256_hex((rel + "\0" + d["sha256"]).encode())[:16]
    claims = []
    for k, v in fm.items():
        if k.endswith("_basis"): continue
        claims.append({"about": k, "value": v, "basis": fm.get(k + "_basis") or "frontmatter (no basis field)", "method": "frontmatter"})
    m = UDHR.search(text[:600])
    if m: claims.append({"about": "language", "value": m.group(2), "basis": f"document header line: Language: {m.group(1)} ({m.group(2)})", "method": "header-line"})
    claims.append({"about": "atmosphere", "value": d["atmosphere"], "basis": "folder (curator placement)", "method": "folder"})
    folder_lang = None
    for p in parts[1:-1]:
        if p in ORIGINALS: folder_lang = ORIGINALS[p]
        elif CODE.match(p): folder_lang = p
    stem = os.path.splitext(parts[-1])[0]
    if folder_lang is None and CODE.match(stem) and len(parts) > 2: folder_lang = stem
    if folder_lang: claims.append({"about": "language", "value": folder_lang, "basis": "folder or file name (curator placement)", "method": "folder"})
    # the document's working language: frontmatter, then a header line, then the folder; else und (S3 may append a coverage claim)
    lang = None
    for meth in ("frontmatter", "header-line", "folder"):
        for c in claims:
            if c["about"] == "language" and c["method"] == meth and c["value"]: lang = (norm_lang(c["value"]), meth); break
        if lang: break
    d["lang"], d["lang_method"] = lang if lang else ("und", "none")
    return d, claims

if __name__ == "__main__":
    import multiprocessing as mp
    mp.set_start_method("fork"); t0 = time.time(); os.makedirs(OUT, exist_ok=True)
    files, skipped = inventory(); print(f"inventory: {len(files)} files, skipped {sum(skipped.values())}", flush=True)
    json.dump(dict(skipped), open(os.path.join(OUT, "skipped.json"), "w"), indent=1, sort_keys=True)
    docs, sh, nclaims = [], Shards(os.path.join(OUT, "events"), "ground"), 0
    with mp.Pool(WORKERS) as pool:
        for k, (d, claims) in enumerate(pool.imap(ground, files, chunksize=8)):
            docs.append(d)
            sh.write(event({"k": "doc", "doc": d["id"], **{x: d[x] for x in ("path", "sha256", "bytes", "utf8_clean", "atmosphere", "collection")}}))
            for c in claims: sh.write(event({"k": "claim", "doc": d["id"], **c})); nclaims += 1
            if k % 1000 == 0: print(f"ground {k}/{len(files)} {time.time()-t0:.0f}s", flush=True)
    byp = {d["path"]: d for d in docs}
    # date claims from the zen-index (front matter) and the date ants, then P1 (hl/dates.py, p1-resolve.mjs), as claims and resolutions
    per = collections.defaultdict(list)
    if os.path.exists(ZIDX):
        for r in json.load(open(ZIDX, encoding="utf8")):
            d = byp.get(r["path"])
            if not d or r.get("dateKind") in (None, "none"): continue
            c = {"about": "date", "value": r.get("year"), "lo": r.get("yearLo"), "hi": r.get("yearHi"), "kind": r["dateKind"], "method": "zen-index", "basis": "exp-out/zen-index.json"}
            sh.write(event({"k": "claim", "doc": d["id"], **c})); nclaims += 1
            if r["dateKind"] in P1["zen_kinds"] and r.get("year"): per[d["id"]].append(r["year"])
    if os.path.exists(DATES):
        for a in json.load(open(DATES, encoding="utf8")):
            if not a.get("best") or not str(a.get("path", "")).startswith("Zenodotus/"): continue
            d = byp.get(a["path"].split("/", 1)[1])
            if not d: continue
            c = {"about": "date", "value": a["best"], "lo": a.get("windowLo"), "hi": a.get("windowHi"), "kind": a.get("kind"), "confidence": a.get("confidence"),
                 "disputed": bool(a.get("disputed")), "method": "date-ants", "basis": "dates-out/dates.json"}
            sh.write(event({"k": "claim", "doc": d["id"], **c})); nclaims += 1
            if a.get("kind") in P1["ant_kinds"] and (a.get("confidence") or 0) >= P1["ant_min_confidence"] and not a.get("disputed"): per[d["id"]].append(a["best"])
    nres = 0
    for did in sorted(per):
        ys = per[did]
        if max(ys) - min(ys) > P1["conflict_years"]: sh.write(event({"k": "resolution", "doc": did, "policy": "P1", "about": "date", "value": None, "gap": "conflict", "years": sorted(set(ys))}))
        else: sh.write(event({"k": "resolution", "doc": did, "policy": "P1", "about": "date", "lo": min(ys), "hi": max(ys)}))
        nres += 1
    sh.close(); docs.sort(key=lambda d: d["path"]); json.dump(docs, open(os.path.join(OUT, "docs.json"), "w", encoding="utf8"))
    summ = {"docs": len(docs), "claims": nclaims, "p1_resolutions": nres, "lang_method": collections.Counter(d["lang_method"] for d in docs),
            "utf8_unclean": sum(1 for d in docs if not d["utf8_clean"]), "seconds": round(time.time() - t0)}
    json.dump(summ, open(os.path.join(OUT, "s0.summary.json"), "w"), indent=1); print(json.dumps(summ), flush=True)
