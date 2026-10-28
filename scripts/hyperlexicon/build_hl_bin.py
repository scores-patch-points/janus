"""Build HyperlexiconBin@2 from the v1 store: a DMD-bounded, flat little-endian, mmap-able projection.
Kept: givers' names (surface NFC-normalized as written -> node, lang, kind, pos, form-of, giver), relations and links (each with its giver),
and per-(document language, type) counters for a type a giver names OR that occurs in >= 2 documents (a standing change).
Dropped: postings, glosses, single-sighting unnamed types (counted, not stored).
@2 changes the stored shape from @1: counters are keyed by (language, type) instead of by type; every names/relations/links row carries
its giver; surfaces and types are NFC-normalized; the case-folded index uses a language-neutral skeleton (see skeleton()).
usage: python -I build_hl_bin.py <v1 dir> <out dir> [diminutive prior json]"""
import sys, os, json, gzip, glob, subprocess, time, unicodedata
import numpy as np

V1, OUT = sys.argv[1], sys.argv[2]
L1 = os.path.join(V1, "l1")
os.makedirs(OUT, exist_ok=True)
t0 = time.time()
def log(*a): print(f"[{time.time()-t0:6.0f}s]", *a, flush=True)
def save(name, arr): np.ascontiguousarray(arr).tofile(os.path.join(OUT, name))
def strtable(prefix, blobs):
    off = np.zeros(len(blobs) + 1, dtype=np.uint64); off[1:] = np.cumsum(np.fromiter((len(b) for b in blobs), dtype=np.uint64, count=len(blobs)))
    with open(os.path.join(OUT, prefix + ".bin"), "wb") as f:
        for i in range(0, len(blobs), 1 << 18): f.write(b"".join(blobs[i:i + (1 << 18)]))
    save(prefix + ".off", off)
nfc = lambda s: unicodedata.normalize("NFC", s)
def skeleton(s):
    """The key of the case-folded index: NFC, lower-cased, with Turkish dotted/dotless i and German sharp s folded together
    (U+0307 dropped, dotless i -> i, sharp s -> ss). A per-language adapter at query time (bin.mjs FOLDS) decides which candidates of a
    skeleton really fold together in the asked language; the skeleton only has to put them all in one run."""
    return nfc(s).lower().replace("̇", "").replace("ı", "i").replace("ß", "ss")

# ---- document languages (the ground claim of each document) ------------------------------------------------------------
doc_lang = []
with open(f"{L1}/docs.jsonl", encoding="utf8") as f:
    for line in f: doc_lang.append(json.loads(line).get("lang") or "")
clangs = sorted(set(doc_lang)); cl_ix = {l: i for i, l in enumerate(clangs)}
doc_lang_ix = np.array([cl_ix[l] for l in doc_lang], dtype=np.int64)
log(f"documents {len(doc_lang):,}  counter languages {len(clangs)}")

# ---- types: per-(language, type) counters for named-or-corroborated types -----------------------------------------------
voff = np.fromfile(f"{L1}/vocab.off", dtype="<u8"); V = len(voff) - 1
vbin = np.memmap(f"{L1}/vocab.bin", dtype="u1", mode="r")
coff = np.fromfile(f"{L1}/cands.off", dtype="<u8")
t2off = np.fromfile(f"{L1}/t2d.off", dtype="<u8")
t2doc = np.fromfile(f"{L1}/t2d.doc", dtype="<u4")
t2cnt = np.fromfile(f"{L1}/t2d.cnt", dtype="<u4")
df = np.diff(t2off).astype(np.int64)
named = np.diff(coff) > 0
keep = named | (df >= 2)
ids = np.nonzero(keep)[0]
log(f"types {V:,}  named {int(named.sum()):,}  df>=2 {int((df>=2).sum()):,}  kept {len(ids):,}  dropped-singletons {int((~keep).sum()):,}")
raw = [bytes(vbin[voff[i]:voff[i + 1]]) for i in ids]
norm = [nfc(b.decode("utf8", "replace")).encode("utf8") for b in raw]
uniq = sorted(set(norm))                                         # UTF-8 byte order: binary search at read time
pos_of = {s: i for i, s in enumerate(uniq)}
log(f"types after NFC {len(uniq):,} ({len(ids) - len(uniq):,} collapsed)")
newpos = np.full(V, -1, dtype=np.int64); newpos[ids] = np.fromiter((pos_of[s] for s in norm), dtype=np.int64, count=len(ids))
named_new = np.zeros(len(uniq), dtype=np.uint8); named_new[newpos[ids]] |= named[ids].astype(np.uint8)
strtable("types", uniq); save("types.named", named_new)
# entries of the kept types, as (new type position, document language) groups; documents ascending within a group
tid = np.repeat(np.arange(V, dtype=np.int64), df)
sel = newpos[tid] >= 0
key = newpos[tid[sel]] * 65536 + doc_lang_ix[t2doc[sel]]; doc = t2doc[sel].astype(np.int64); cnt = t2cnt[sel].astype(np.uint64)
del tid, sel, t2doc, t2cnt
o = np.lexsort((doc, key)); key, doc, cnt = key[o], doc[o], cnt[o]; del o
starts = np.concatenate([[0], np.nonzero(np.diff(key))[0] + 1]); ends = np.append(starts[1:], len(key))
gkey = key[starts]; gtype = (gkey // 65536).astype(np.int64); glang = (gkey % 65536).astype("<u2")
NONE = np.uint32(0xFFFFFFFF)
guses = np.add.reduceat(cnt, starts).astype("<u4"); gdocs = (ends - starts).astype("<u4")
gbirth = doc[starts].astype("<u4"); gcorrob = np.where(gdocs >= 2, doc[np.minimum(starts + 1, len(doc) - 1)], NONE).astype("<u4")
toff = np.zeros(len(uniq) + 1, dtype="<u8"); np.add.at(toff, gtype + 1, 1); toff = np.cumsum(toff).astype("<u8")
save("tc.off", toff); save("tc.lang", glang); save("tc.uses", guses); save("tc.docs", gdocs); save("tc.birth", gbirth); save("tc.corrob", gcorrob)
log(f"counters written: {len(gkey):,} (language, type) groups")
del key, doc, cnt, starts, ends

# ---- node table + names -------------------------------------------------------------------------------------------------
def hexid(s): return int(s[2:], 16)
langs, kinds, rels, givers = {}, {}, {}, {}
pos_ix = {}
def events(kind):
    p = subprocess.Popen(f"for f in {V1}/events/dict-*.jsonl.gz; do gunzip -c \"$f\" | grep '\"k\":\"{kind}\"'; done", shell=True, stdout=subprocess.PIPE)
    for line in p.stdout: yield json.loads(line)
    p.wait()
rows = []                                    # (surface bytes, node u64, lang idx, kind idx, pos idx, of string or "", giver idx)
for e in events("name"):
    rows.append((nfc(e["surface"]).encode("utf8"), hexid(e["node"]), langs.setdefault(e["lang"], len(langs)), kinds.setdefault(e["kind"], len(kinds)),
                 pos_ix.setdefault(e.get("pos") or "", len(pos_ix)), nfc(e.get("of") or ""), givers.setdefault(e.get("giver") or "", len(givers))))
log(f"name rows {len(rows):,}")
rows = sorted(set(rows))                     # sorted by surface bytes, deduped
node_ids = {r[1] for r in rows}

R, LK = [], []
for e in events("rel"):
    R.append((hexid(e["from"]), hexid(e["to"]), rels.setdefault(e["rel"], len(rels)), givers.setdefault(e.get("giver") or "", len(givers)))); node_ids.update(R[-1][:2])
log(f"relations {len(R):,}")
for e in events("link"):
    LK.append((hexid(e["from"]), hexid(e["to"]), kinds.setdefault("link:" + e["kind"], len(kinds)), langs.setdefault(e.get("to_lang") or "", len(langs)), givers.setdefault(e.get("giver") or "", len(givers)))); node_ids.update(LK[-1][:2])
log(f"links {len(LK):,}")
# optional 3rd argument: a DiminutivePrior@1 (scripts/hyperlexicon/feed-diminutives.mjs): its rows become relations (a new rel type, each with its
# giver) and its quoted witnesses go in a sidecar, rel.witness.json, keyed "<from node>|<to node>|<rel>": too large for the relation columns
if len(sys.argv) > 3:
    dim = json.load(open(sys.argv[3])); wit = {}
    for r in dim["rows"]:
        a, b = hexid(r["from"]["node"]), hexid(r["to"]["node"])
        R.append((a, b, rels.setdefault(r["relation"], len(rels)), givers.setdefault(r["giver"], len(givers)))); node_ids.update((a, b))
        wit.setdefault(f'{r["from"]["node"]}|{r["to"]["node"]}|{r["relation"]}', []).append(r["witness"])
    json.dump(wit, open(os.path.join(OUT, "rel.witness.json"), "w"), ensure_ascii=False)
    log(f"extra relations from {os.path.basename(sys.argv[3])}: {len(dim['rows']):,} rows, {len(dim['gaps'])} typed gaps kept in the prior")
nodes = np.array(sorted(node_ids), dtype="<u8"); save("nodes.id", nodes)
# per node: the parts of speech its senses carry, IN THE GIVER'S SENSE ORDER (first appearance), u8 codes,
# sixteen u8 slots per node (code = pos index + 1, 0 = none) — the giver's claim about the node, not a gloss; a consumer that takes the first pos gets the giver's first
nplist = [[] for _ in range(len(nodes))]
for e in events("def"):
    p = e.get("pos")
    if p is None: continue
    nid = hexid(e["node"]); ix = int(np.searchsorted(nodes, np.uint64(nid)))
    if ix < len(nodes) and int(nodes[ix]) == nid:
        c = pos_ix.setdefault(p, len(pos_ix)) + 1
        if c not in nplist[ix]: nplist[ix].append(c)
assert len(pos_ix) < 63, len(pos_ix)
mx = max((len(l) for l in nplist), default=0); assert mx <= 16, mx
nmask = np.zeros((len(nodes), 16), dtype="u1")
for ix, l in enumerate(nplist):
    for k, c in enumerate(l): nmask[ix, k] = c
del nplist
save("nodes.pos", nmask); log(f"node pos lists, {len(pos_ix)} parts of speech, at most {mx} per node")

nidx = lambda a: np.searchsorted(nodes, np.array(a, dtype="<u8")).astype("<u4")

surf = [r[0] for r in rows]
newgrp = np.fromiter((i == 0 or surf[i] != surf[i - 1] for i in range(len(surf))), dtype=bool, count=len(surf))
starts = np.nonzero(newgrp)[0]
strtable("names.surface", [surf[i] for i in starts])        # distinct surfaces, byte order
save("names.grp", np.append(starts, len(surf)).astype("<u4"))  # surface i owns rows grp[i]..grp[i+1]
save("names.node", nidx([r[1] for r in rows])); save("names.lang", np.array([r[2] for r in rows], dtype="<u2")); save("names.kind", np.array([r[3] for r in rows], dtype="u1")); save("names.pos", np.array([r[4] for r in rows], dtype="u1"))
save("names.giver", np.array([r[6] for r in rows], dtype="u1"))
ofs = sorted({r[5] for r in rows if r[5]}, key=lambda x: x.encode("utf8")); ofd = {x: i for i, x in enumerate(ofs)}
strtable("names.of", [x.encode("utf8") for x in ofs]); save("names.of", np.array([ofd.get(r[5], 0xFFFFFFFF) for r in rows], dtype="<u4"))
# folded index: distinct-surface indexes ordered by skeleton(surface) (UTF-8 bytes), so a folded query finds every casing and variant
_dist = [surf[i] for i in starts]
_fk = [skeleton(d.decode("utf8", "replace")).encode("utf8") for d in _dist]
save("names.fold", np.array(sorted(range(len(_dist)), key=lambda i: (_fk[i], i)), dtype="<u4")); del _fk, _dist
R.sort(); save("rel.from", nidx([r[0] for r in R])); save("rel.to", nidx([r[1] for r in R])); save("rel.type", np.array([r[2] for r in R], dtype="u1")); save("rel.giver", np.array([r[3] for r in R], dtype="u1"))
LK.sort(); save("link.from", nidx([r[0] for r in LK])); save("link.to", nidx([r[1] for r in LK])); save("link.kind", np.array([r[2] for r in LK], dtype="u1")); save("link.lang", np.array([r[3] for r in LK], dtype="<u2")); save("link.giver", np.array([r[4] for r in LK], dtype="u1"))
json.dump({"schema": "HyperlexiconBin@2", "from_v1_head": open(f"{V1}/head.sha256").read().split()[0],
           "bound": "DMD: types kept iff a giver names them or df>=2; singletons counted not stored; no postings, no glosses",
           "langs": sorted(langs, key=langs.get), "pos": sorted(pos_ix, key=pos_ix.get), "kinds": sorted(kinds, key=kinds.get), "rels": sorted(rels, key=rels.get),
           "givers": sorted(givers, key=givers.get), "counter_langs": clangs,
           "counts": {"types_total": int(V), "types_kept": int(len(uniq)), "types_dropped": int((~keep).sum()), "surfaces": int(len(starts)),
                      "name_rows": len(rows), "nodes": int(len(nodes)), "rels": len(R), "links": len(LK), "counter_groups": int(len(gkey))},
           "normalization": "NFC for names, form-of lemmas and types; queries must be NFC-normalized by the reader",
           "fold": "names.fold is ordered by skeleton(): NFC, lower-case, U+0307 dropped, dotless i -> i, sharp s -> ss; per-language adapters decide the real fold",
           "endianness": "little", "layout": "see build_hl_bin.py; *.off u64 into *.bin; strings sorted by UTF-8 bytes; tc.* is CSR by type: tc.off[type]..tc.off[type+1] groups of (lang, uses, docs, birth, corrob)"},
          open(os.path.join(OUT, "manifest.json"), "w"), indent=1)
tot = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
log(f"DONE {tot/1e6:,.0f} MB")
