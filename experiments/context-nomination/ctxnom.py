"""ctxnom.py <set> <dir> [--u1 ARM] [--out FILE]  PREREG-CONTEXT-NOMINATION (60432a15020910ad) + ADDENDUM-1 (bb100ba8bdd8d76d).
Question: does an embedder given a meaningful spread of context (the referent's paraphrase as the query, candidates with their neighbours) and the model-free mechanical paraphrase fold nominate better than the bare-name embedder?
Every arm is a NOMINATOR: it returns ten sentence indices and nothing else. The paraphrase builder, the tokenizer and the fold use no regex and no model and no word list. The strata, queries and gold are the Penelope session's
(lib.py, score.py, zero_clean.py), READ ONLY; the five functions of zero_clean.py are copied byte for byte below."""
import sys, os, json, glob, math, random, unicodedata, collections, time, hashlib
import numpy as np
from scipy import sparse
os.environ["HF_HUB_OFFLINE"] = "1"; os.environ["TOKENIZERS_PARALLELISM"] = "false"
REF = "/Users/mlacy/Documents/khora-cast/penelope/experiments/zero-overlap/referent"; sys.path.insert(0, REF)
from lib import toks, prefix5, zero_overlap
from score import queries
SEED, K10, KQ, WIN = 20261119, 10, 5, 3
HMAX, TAU = 6, 0.8      # ADDENDUM-3: HMAX is a safety cap only; the STOPPING RULE (top-10 overlap >= TAU between successive hops) decides the reach. TAU is the declared tolerance and is swept (0.6, 0.8, 1.0).
ARBITRARY = "ARBITRARY CONSTANT"
# REFERENT-FIRST (janus/REFERENT-FIRST.md): every arm names the referent object it builds, its evidence, its strings-only twin and how its reach is cut. A "context" arm without them is not reported.
ARM_SPECS = {
 "N0":  dict(role="baseline", referent="none: the bare name", evidence="the embedder's prior (a given from its training, a nominator)", twin=None, cut="none"),
 "N1":  dict(role="context", referent="the being as its first K name-bearing sentences", evidence="sentences", twin="SHUF", cut=ARBITRARY + " K=5"),
 "N2":  dict(role="context", referent="none: bare name vs candidates WITH neighbours", evidence="neighbouring sentences", twin="N0", cut=ARBITRARY + " w=3"),
 "N3":  dict(role="context", referent="the being as its first K name-bearing sentences, candidates with neighbours", evidence="sentences", twin="SHUF", cut=ARBITRARY + " K=5, w=3"),
 "N5":  dict(role="context", referent="N3 where a universe exists, else the bare name", evidence="sentences", twin="N0", cut=ARBITRARY + " K=5, w=3"),
 "N6":  dict(role="context", referent="the being as its universe: name-bearing sentences widened hop by hop through the document", evidence="sentences kept as units, scored by best match", twin="T6", cut="stopping-rule: top-10 overlap >= TAU between successive hops"),
 "N6F": dict(role="context", referent="N6 where a universe exists, else the bare name", evidence="sentences kept as units", twin="T6F", cut="stopping-rule: top-10 overlap >= TAU between successive hops"),
 "T6":  dict(role="twin", referent="same seeds plus random sentences to the size N6 reached", evidence="strings only", twin=None, cut="size copied from N6"),
 "SHUF":dict(role="twin", referent="none: a same-length query of the document's most frequent tokens, shuffled", evidence="strings only", twin=None, cut="length copied from N1"),
 "T6F": dict(role="twin", referent="T6 where seeds exist, else the bare name", evidence="strings only", twin=None, cut="size copied from N6"),
 "PROXF":dict(role="control", referent="PROX where seeds exist, else the bare name", evidence="document order", twin=None, cut="none"),
 "PROX":dict(role="control", referent="locality alone: distance to the nearest name-bearing sentence", evidence="document order", twin=None, cut="none"),
 "M1":  dict(role="nominator", referent="word-fold classes of the name tokens (no being)", evidence="company statistics", twin=None, cut="constant window +-4 (the khora fold's own), threshold derived from V"),
}
def check_registry(specs):
    """a context arm with no referent, evidence, twin or declared cut is REFUSED; an arbitrary cut is printed beside its result"""
    for a, sp in specs.items():
        if sp["role"] == "context":
            for k in ("referent", "evidence", "twin", "cut"):
                if not sp.get(k): raise ValueError(f"REFERENT-FIRST: context arm {a} declares no {k}; it cannot be reported")
            if sp["twin"] not in specs: raise ValueError(f"REFERENT-FIRST: context arm {a} names a strings-only twin {sp['twin']} that is not an arm")
    return [a for a, sp in specs.items() if str(sp.get("cut", "")).startswith(ARBITRARY)]

# ---- copied BYTE FOR BYTE from referent/zero_clean.py (the declared normaliser) ----
def fold(t): return "".join(c for c in unicodedata.normalize("NFKD", t) if not unicodedata.combining(c))
def stem(t):
    if len(t) >= 5 and t.endswith("es"): return t[:-2]
    if len(t) >= 4 and t.endswith("s"): return t[:-1]
    return t
def ntoks(s): return [stem(fold(t)) for t in toks(s)]
def ed1(a, b):
    if abs(len(a) - len(b)) > 1 or min(len(a), len(b)) < 4: return False
    if a == b: return True
    i = 0
    while i < min(len(a), len(b)) and a[i] == b[i]: i += 1
    return a[i + 1:] == b[i + 1:] or a[i + 1:] == b[i:] or a[i:] == b[i + 1:]
def related(name, sent):
    nt, st = ntoks(name), ntoks(sent)
    pre = {prefix5(t) for t in st}
    return any(t in st or prefix5(t) in pre or any(ed1(t, u) for u in st) for t in nt)
# ---- end of the copied block ----

def tok(s):
    """tokens without a regex: NFKD, marks dropped, lower case, maximal runs of alphanumeric characters"""
    out, cur = [], []
    for c in unicodedata.normalize("NFKD", s.lower()):
        if unicodedata.combining(c): continue
        if c.isalnum(): cur.append(c)
        elif cur: out.append("".join(cur)); cur = []
    if cur: out.append("".join(cur))
    return out

class Doc:
    def __init__(self, d):
        self.d = d; t = d["text"]; self.sents = [t[s["c0"]:s["c1"]] for s in d["sentences"]]; self.n = len(self.sents)
        self.tk = [tok(s) for s in self.sents]; self.tset = [set(x) for x in self.tk]; self.sset = [{stem(w) for w in x} for x in self.tk]
        self.title = d["title"]; self.qs = queries(d)
    def win(self, i, w):
        h = w // 2; return " ".join(self.sents[max(0, i - h):min(self.n, i + h + 1)])
    def bearing(self, name):
        nt = {stem(t) for t in tok(name)}
        return [] if not nt else [i for i in range(self.n) if nt <= self.sset[i]]

def build_fold(docs):
    """the khora round-2 word fold: positive-PMI company over +-4 tokens (per document stream), types with >= 5 occurrences; fold class by robust z >= sqrt(2 ln V)"""
    streams = [[t for x in D.tk for t in x] for D in docs]; cnt = collections.Counter(t for s in streams for t in s)
    vocab = sorted(w for w, c in cnt.items() if c >= 5); ix = {w: i for i, w in enumerate(vocab)}; V = len(vocab)
    pairs = collections.Counter()
    for s in streams:
        ids = [ix.get(t, -1) for t in s]
        for p, a in enumerate(ids):
            if a < 0: continue
            for q in range(max(0, p - 4), min(len(ids), p + 5)):
                b = ids[q]
                if q != p and b >= 0: pairs[(a, b)] += 1
    N = sum(pairs.values()); r = np.zeros(V)
    for (a, b), c in pairs.items(): r[a] += c
    rows = np.fromiter((a for a, b in pairs), dtype=np.int64, count=len(pairs)); cols = np.fromiter((b for a, b in pairs), dtype=np.int64, count=len(pairs))
    vals = np.array([max(0.0, math.log(c * N / (r[a] * r[b]))) if r[a] and r[b] else 0.0 for (a, b), c in pairs.items()])
    M = sparse.csr_matrix((vals, (rows, cols)), shape=(V, V)); nrm = np.sqrt(np.asarray(M.multiply(M).sum(axis=1)).ravel()) + 1e-12
    bystem = collections.defaultdict(set)
    for w in vocab: bystem[stem(w)].add(w)
    return {"vocab": vocab, "ix": ix, "M": M, "nrm": nrm, "V": V, "bystem": bystem, "cache": {}}

def fold_class(F, w):
    if w in F["cache"]: return F["cache"][w]
    members = {w} | F["bystem"].get(stem(w), set())
    if w in F["ix"]:
        i = F["ix"][w]; sims = np.asarray(F["M"].dot(F["M"][i].T).todense()).ravel() / (F["nrm"] * F["nrm"][i]); med = float(np.median(sims)); sig = 1.4826 * float(np.median(np.abs(sims - med)))
        if sig > 0:
            thr = math.sqrt(2 * math.log(F["V"])); members |= {F["vocab"][j] for j in np.nonzero((sims - med) / sig >= thr)[0] if j != i}
    F["cache"][w] = members; return members

def fold_scores(D, F, name, w=WIN):
    """score of each sentence: the sum of the surprisals of the distinct fold-class anchors it (and its window) carries"""
    anchors, seen = [], set()
    for t in tok(name):
        if len(t) < 3 or stem(t) in seen: continue
        seen.add(stem(t)); anchors.append((stem(t), fold_class(F, t)))
    carry = []
    for st, mem in anchors: carry.append(np.array([bool(D.tset[i] & mem) or st in D.sset[i] for i in range(D.n)]))
    sc = np.zeros(D.n)
    if not carry: return sc
    sur = [(-math.log(c.sum() / D.n) if c.sum() else 0.0) for c in carry]; h = w // 2
    for i in range(D.n):
        lo, hi = max(0, i - h), min(D.n, i + h + 1); sc[i] = sum(s for c, s in zip(carry, sur) if c[lo:hi].any())
    return sc

def order(scores, exclude, k=K10):
    out = []
    for i in sorted(range(len(scores)), key=lambda j: (-scores[j], j)):
        if i not in exclude: out.append(int(i))
        if len(out) == k: break
    return out

def interleave(lists, k=K10):
    seen, o = set(), []
    for r in range(k):
        for L in lists:
            if r < len(L) and L[r] not in seen and len(o) < k: seen.add(L[r]); o.append(L[r])
    return o

def main():
    which, d = sys.argv[1], sys.argv[2]; u1 = sys.argv[sys.argv.index("--u1") + 1] if "--u1" in sys.argv else None
    outf = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else f"results-{which}.json"
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(os.path.join(REF, "models", "all-MiniLM-L6-v2"), device="cpu")
    enc = lambda xs: model.encode(list(xs), normalize_embeddings=True, batch_size=64, show_progress_bar=False)
    docs = [Doc(json.load(open(f))) for f in sorted(glob.glob(os.path.join(d, "*.json")))]; t0 = time.time()
    F = build_fold(docs); print(f"[{which}] {len(docs)} documents, fold background: {F['V']} types ({time.time() - t0:.0f}s)", flush=True)
    ARMS = ["N0", "N0_raw", "N1", "N2", "N2w5", "N3", "N3w5", "N5", "M1", "SHUF", "N6", "N6F", "N6_t06", "N6_t10", "T6", "T6F", "PROX", "PROXF"]; CTRL = ["N0", "N1", "N2", "N3", "N5", "M1", "N6", "N6F"]; hops = collections.Counter(); unstable = collections.Counter()
    A = {a: [] for a in ARMS + ["U1"] + [c + "_swap" for c in CTRL]}; per = []   # per doc: arm -> stratum -> [hits, gold]; plus precision [hits_in_top, returned]
    noq = collections.Counter(); null = []
    for di, D in enumerate(docs):
        if not D.qs: per.append(None); continue
        E1, E3, E5 = enc(D.sents), enc([D.win(i, 3) for i in range(D.n)]), enc([D.win(i, 5) for i in range(D.n)])
        S11 = E1 @ E1.T
        def grow(seeds, ex):
            """the universe, hop by hop: hop h = every sentence within document distance h of a seed; each profile sentence is a UNIT and a candidate scores by its best match to any of them (a sentence never matches itself)"""
            dist = np.min(np.abs(np.arange(D.n)[:, None] - np.array(seeds)[None, :]), axis=1); tops = []
            for h in range(HMAX + 1):
                P = [i for i in range(D.n) if dist[i] <= h]; M = S11[:, P].copy()
                for c, pi in enumerate(P): M[pi, c] = -9.0
                tops.append((order(M.max(axis=1), ex), len(P)))
            return tops, dist
        def stop(tops, tau):
            for h in range(1, HMAX + 1):
                if len(set(tops[h][0]) & set(tops[h - 1][0])) / K10 >= tau: return tops[h][0], h, tops[h][1], False
            return tops[HMAX][0], HMAX, tops[HMAX][1], True
        def twin(seeds, size, ex, key):
            r = random.Random(key); pool = [i for i in range(D.n) if i not in set(seeds)]; P = list(seeds) + r.sample(pool, min(len(pool), max(0, size - len(seeds))))
            M = S11[:, P].copy()
            for c, pi in enumerate(P): M[pi, c] = -9.0
            return order(M.max(axis=1), ex)
        names = [q["name"] for q in D.qs]; bear = [D.bearing(nm) for nm in names]
        paras = [" ".join(D.sents[i] for i in b[:KQ]) if b else "" for b in bear]
        freq = [w for w, c in sorted(collections.Counter(t for x in D.tk for t in x if len(t) >= 4).items(), key=lambda kv: (-kv[1], kv[0]))]
        rng = random.Random(SEED + di); shuf = []
        for p in paras:
            m = len(tok(p)); L = (freq * (m // max(1, len(freq)) + 1))[:m] if freq else []; rng.shuffle(L); shuf.append(" ".join(L))
        QN, QP, QS = enc(names), enc([p if p else "." for p in paras]), enc([s if s else "." for s in shuf])
        rec = {a: collections.defaultdict(lambda: [0.0, 0]) for a in A}; prec = {a: [0, 0] for a in A}
        for qi, q in enumerate(D.qs):
            ex = set(bear[qi]); hasq = bool(paras[qi]); nxt = (qi + 1) % len(D.qs)
            sc = {"N0": E1 @ QN[qi], "N2": E3 @ QN[qi], "N2w5": E5 @ QN[qi], "N1": E1 @ QP[qi], "N3": E3 @ QP[qi], "N3w5": E5 @ QP[qi], "M1": fold_scores(D, F, names[qi]), "SHUF": E1 @ QS[qi]}
            top = {"N0": order(sc["N0"], ex), "N0_raw": order(sc["N0"], set()), "N2": order(sc["N2"], ex), "N2w5": order(sc["N2w5"], ex), "M1": order(sc["M1"], ex)}
            for a in ("N1", "N3", "N3w5", "SHUF"): top[a] = order(sc[a], ex) if hasq else []
            if not hasq: noq["N1/N3"] += 1
            # target-swap controls: the arm built from the NEXT query's name/paraphrase, scored against THIS query's gold and pool
            if len(D.qs) > 1:
                top["N0_swap"] = order(E1 @ QN[nxt], ex); top["N2_swap"] = order(E3 @ QN[nxt], ex); top["M1_swap"] = order(fold_scores(D, F, names[nxt]), ex)
                top["N1_swap"] = order(E1 @ QP[nxt], ex) if paras[nxt] else []; top["N3_swap"] = order(E3 @ QP[nxt], ex) if paras[nxt] else []
            else:
                for c in CTRL: top[c + "_swap"] = []
            top["N5_swap"] = top.get("N3_swap", []) if hasq else top.get("N0_swap", [])
            if bear[qi]:
                tops, dist = grow(bear[qi], ex); sel, h, size, uns = stop(tops, TAU); hops[h] += 1; unstable[uns] += 1
                top["N6"] = sel; top["N6_t06"] = stop(tops, 0.6)[0]; top["N6_t10"] = stop(tops, 1.0)[0]; top["T6"] = twin(bear[qi], size, ex, SEED + 1000 * di + qi); top["PROX"] = order(-dist.astype(float), ex)
            else:
                for a_ in ("N6", "N6_t06", "N6_t10", "T6", "PROX"): top[a_] = []
            top["N6F"] = top["N6"] if bear[qi] else top["N0"]; top["T6F"] = top["T6"] if bear[qi] else top["N0"]; top["PROXF"] = top["PROX"] if bear[qi] else top["N0"]
            if len(D.qs) > 1 and bear[nxt]: top["N6_swap"] = stop(grow(bear[nxt], ex)[0], TAU)[0]
            else: top["N6_swap"] = []
            top["N6F_swap"] = top["N6_swap"] if bear[qi] else top["N0_swap"] if "N0_swap" in top else []
            top["N5"] = top["N3"] if hasq else top["N0"]   # ADDENDUM-2: the context query where one can be built, the bare name where it cannot
            best = u1 or "N5"; top["U1"] = interleave([top.get(best, []), top["M1"]])
            pool = D.n - len(ex)
            for si, ty in q["gold"].items():
                s = D.sents[si]; z = zero_overlap(names[qi], s); zc = z and not related(names[qi], s); nf = si not in set(bear[qi])
                strata = ["ALL", ty] + (["ZERO"] if z else []) + (["ZERO_CLEAN"] if zc else []) + (["ZC_QUERY" if hasq else "ZC_NOQUERY"] if zc else []) + (["NAMEFREE"] if nf else [])
                for a in top:
                    for st in strata:
                        rec[a][st][1] += 1; rec[a][st][0] += 1 if si in top[a] else 0
                for st in strata: rec["null"] = rec.get("null", collections.defaultdict(lambda: [0.0, 0])); rec["null"][st][1] += 1; rec["null"][st][0] += min(K10, pool) / max(1, pool)
            for a in top: prec[a][0] += len(set(top[a]) & set(q["gold"])); prec[a][1] += len(top[a])
        per.append({"title": D.title, "rec": {a: {st: v for st, v in r.items()} for a, r in rec.items() if a in rec}, "prec": prec})
        if (di + 1) % 10 == 0: print(f"  ... {di + 1}/{len(docs)} documents ({time.time() - t0:.0f}s)", flush=True)
    json.dump({"set": which, "u1_arm": u1 or "N5", "no_query": dict(noq), "hops": dict(hops), "unstable": dict(unstable), "per": per}, open(outf, "w"), default=lambda o: dict(o))
    print("hop reached (stopping rule, tau=%.1f):" % TAU, dict(sorted(hops.items())), "| not stable by HMAX:", dict(unstable))
    report(per, which, u1 or "N5", noq)

def report(per, which, u1arm, noq):
    per = [p for p in per if p]; rng = np.random.default_rng(SEED)
    def pooled(arm, st, idx=None):
        h = g = 0.0
        for i in (range(len(per)) if idx is None else idx):
            v = per[i]["rec"].get(arm, {}).get(st)
            if v: h += v[0]; g += v[1]
        return (h / g if g else float("nan")), g
    def boot(fn, B=2000):
        out = [fn(rng.integers(0, len(per), len(per))) for _ in range(B)]; return float(np.nanpercentile(out, 2.5)), float(np.nanpercentile(out, 97.5))
    arb = check_registry(ARM_SPECS); print("REFERENT-FIRST: arms whose reach is an ARBITRARY CONSTANT (their results do not speak for the full universe):", ", ".join(arb)); print("                twins: " + ", ".join(f"{a}<->{sp['twin']}" for a, sp in ARM_SPECS.items() if sp["role"] == "context"))
    ST = ["ZERO_CLEAN", "ZC_QUERY", "ZC_NOQUERY", "ZERO", "DIFFERENT", "NAMEFREE", "ALL"]; ARMS = ["N0_raw", "N0", "N1", "N2", "N2w5", "N3", "N3w5", "N5", "M1", "SHUF", "N6", "N6_t06", "N6_t10", "T6", "PROX", "N6F", "T6F", "PROXF", "U1", "null"]
    print(f"\n=== {which.upper()}: recall@10 pooled (gold counts: " + ", ".join(f"{s} {int(pooled('N0', s)[1])}" for s in ST) + ")")
    print("arm".ljust(8) + "".join(s.rjust(13) for s in ST) + "   prec@10")
    for a in ARMS:
        pr = sum(p["prec"].get(a, [0, 0])[0] for p in per) / max(1, sum(p["prec"].get(a, [0, 0])[1] for p in per))
        print(a.ljust(8) + "".join(f"{pooled(a, s)[0]:13.3f}" for s in ST) + (f"   {pr:.3f}" if a != "null" else ""))
    print("controls (target-swap) on ZERO_CLEAN, true vs swapped:", "  ".join(f"{c}: {pooled(c, 'ZERO_CLEAN')[0]:.3f} -> {pooled(c + '_swap', 'ZERO_CLEAN')[0]:.3f}" for c in ["N0", "N1", "N2", "N3", "N5", "N6", "N6F", "M1"]), "| no-query (N1/N3):", dict(noq))
    # ---- falsifiers, evaluated from the numbers with the thresholds written in PREREG-CONTEXT-NOMINATION section 4
    zc = lambda a, idx=None: pooled(a, "ZERO_CLEAN", idx)[0]
    best = max(["N1", "N2", "N3"], key=lambda a: zc(a)); d = zc(best) - zc("N0"); lo, hi = boot(lambda ix: zc(best, ix) - zc("N0", ix))
    print(f"\nF1 best of N1/N2/N3 = {best}: ZERO_CLEAN {zc(best):.3f} vs N0 {zc('N0'):.3f}, diff {d:+.3f} [{lo:+.3f}, {hi:+.3f}] -> {'HIT (context buys nothing)' if (d < 0.05 or lo <= 0) else 'not hit'}")
    d5 = zc("N5") - zc("N0"); lo5, hi5 = boot(lambda ix: zc("N5", ix) - zc("N0", ix)); print(f"F1b (ADDENDUM-2) N5 (context where it exists, else bare name) ZERO_CLEAN {zc('N5'):.3f} vs N0 {zc('N0'):.3f}, diff {d5:+.3f} [{lo5:+.3f}, {hi5:+.3f}] -> {'HIT' if (d5 < 0.05 or lo5 <= 0) else 'not hit'}")
    for tag, X, Y, why in (("F1c", "N6F", "N0", "the DMD-bounded universe vs the bare name"), ("F7", "N6F", "T6F", "structure adds nothing over the same strings (seeds plus random sentences to the same size)"), ("F8", "N6F", "PROXF", "it is locality, not the referent's universe")):
        dd = zc(X) - zc(Y); l_, h_ = boot(lambda ix: zc(X, ix) - zc(Y, ix)); print(f"{tag} {X} {zc(X):.3f} vs {Y} {zc(Y):.3f}, diff {dd:+.3f} [{l_:+.3f}, {h_:+.3f}] -> {'HIT (' + why + ')' if (dd < 0.05 or l_ <= 0) else 'not hit'}")
    qz = lambda a: pooled(a, "ZC_QUERY")[0]; print(f"   within ZC_QUERY ({int(pooled('N0', 'ZC_QUERY')[1])} gold, diagnostic): N6 {qz('N6'):.3f}  twin T6 {qz('T6'):.3f}  locality PROX {qz('PROX'):.3f}  N3 {qz('N3'):.3f}  N0 {qz('N0'):.3f}; tau sweep N6: 0.6 {qz('N6_t06'):.3f}, 0.8 {qz('N6'):.3f}, 1.0 {qz('N6_t10'):.3f}")
    for a in ["N1", "N2", "N3", "N5", "N6", "N6F", "M1"]:
        t, s = zc(a), zc(a + "_swap"); print(f"F2 {a}: true {t:.3f}, target-swap {s:.3f}, ratio {s / t if t else float('nan'):.2f} -> {'HIT (topical, not referent-tied)' if t and s >= 0.5 * t else 'not hit'}")
    n = zc("null"); print(f"F3 M1 {zc('M1'):.3f} vs random-10 null {n:.3f}, diff {zc('M1') - n:+.3f} -> {'HIT (the mechanical paraphrase finds nothing beyond chance)' if zc('M1') - n < 0.05 else 'not hit'}")
    mem = max(zc(u1arm), zc("M1")); print(f"F4 U1 ({u1arm} + M1) {zc('U1'):.3f} vs its best member {mem:.3f}, diff {zc('U1') - mem:+.3f} -> {'HIT (not more than the parts)' if zc('U1') - mem < 0.05 else 'not hit'}")
    t, s = zc("N1"), zc("SHUF"); print(f"F5 N1 {t:.3f} vs same-length shuffled-frequent query {s:.3f}, ratio {s / t if t else float('nan'):.2f} -> {'HIT (length, not meaning)' if t and s >= 0.5 * t else 'not hit'}")
    best = max(["N1", "N2", "N3", "N5"], key=lambda a: zc(a))   # F6 is evaluated for the best of the context arms (ADDENDUM-2)
    pr = lambda a: sum(p["prec"].get(a, [0, 0])[0] for p in per) / max(1, sum(p["prec"].get(a, [0, 0])[1] for p in per))
    print(f"F6 precision@10: best {best} {pr(best):.3f} vs N0 {pr('N0'):.3f} -> {'HIT (gain bought with junk)' if pr(best) < 0.5 * pr('N0') else 'not hit'}")
    print("NOTE: with the name-bearing sentences excluded, ALL counts the SAME gold as unreachable and its recall and the precision column are meaningful only to compare the excluded arms with each other; the name-free strata are the primary ones.")
    print("UNJUDGEABLE strata (< 30 gold):", [s for s in ST if pooled("N0", s)[1] < 30] or "none")

if __name__ == "__main__": main()
