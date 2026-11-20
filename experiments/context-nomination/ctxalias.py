"""ctxalias.py <cg.json> <out.json>   PREREG-CLAIM-GRAPH-UNIVERSE: does a referent's universe grown through the CLAIM GRAPH nominate its aliases better than the same strings, adjacency and locality?
Task DOC-ALIAS: for each anchor class q (a distinct link-anchor string of the document), rank the other anchor classes; GOLD = classes sharing a link TARGET with q (read from the page bytes). Every arm is a NOMINATOR that returns ten class indices.
The arms receive the graph with the link targets REMOVED (strip()); only gold() sees them. No regex, no word list, no model judging; the embedder (all-MiniLM-L6-v2, a given from its training) only orders attention."""
import sys, os, json, math, random, unicodedata, collections, time
import numpy as np
os.environ["HF_HUB_OFFLINE"] = "1"; os.environ["TOKENIZERS_PARALLELISM"] = "false"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ctxnom import check_registry, ARBITRARY, REF, SEED, K10, HMAX, TAU
STOP = "stopping-rule: top-10 overlap >= TAU between successive hops"
ARM_SPECS = {
 "A0":    dict(role="baseline", referent="none: the bare anchor string", evidence="the embedder's prior (a given from its training, a nominator)", twin=None, cut="none"),
 "CG":    dict(role="context", referent="the class as its universe: its sentences and the clauses it is an argument of, widened through co-participants (classes and lemma nodes)", evidence="clauses from the reader's UD core-argument relations; sentences kept as units", twin="T_CG", cut=STOP),
 "CGB":   dict(role="context", referent="CG plus the sentences of anaphors whose binding candidates include a universe class", evidence="clauses and Janus binding candidates (all listed, none chosen)", twin="T_CG", cut=STOP),
 "ADJ":   dict(role="context", referent="the class's sentences widened hop by hop through document adjacency", evidence="sentences kept as units", twin="T_CG", cut=STOP),
 "FLAT":  dict(role="context", referent="CG on a clause graph whose participants are shuffled within the document (structure removed, strings kept)", evidence="sentences kept as units", twin="T_CG", cut=STOP),
 "T_CG":  dict(role="twin", referent="the same hop-0 sentences plus random sentences to the size CG reached", evidence="strings only", twin=None, cut="size copied from CG"),
 "PROX":  dict(role="control", referent="locality alone: document distance to the nearest hop-0 sentence", evidence="document order", twin=None, cut="none"),
}
def fold(t): return "".join(c for c in unicodedata.normalize("NFKD", t) if not unicodedata.combining(c))
def stem(t):
    if len(t) >= 5 and t.endswith("es"): return t[:-2]
    if len(t) >= 4 and t.endswith("s"): return t[:-1]
    return t
def toks(s):
    out, cur = [], []
    for c in fold(s).lower():
        if c.isalnum(): cur.append(c)
        elif cur: out.append("".join(cur)); cur = []
    if cur: out.append("".join(cur))
    return {stem(t) for t in out}
def strip(cg):
    """what an arm may see: the graph WITHOUT the link targets (the gold label)"""
    return {**cg, "classes": [{k: v for k, v in c.items() if k != "targets"} for c in cg["classes"]]}
def gold(cg):
    C = cg["classes"]; G = {}
    for i, a in enumerate(C):
        g = [j for j, b in enumerate(C) if j != i and set(a["targets"]) & set(b["targets"])]
        if g: G[i] = g
    return G
def order(scores, exclude, k=K10):
    out = []
    for i in sorted(range(len(scores)), key=lambda j: (-scores[j], j)):
        if i not in exclude: out.append(int(i))
        if len(out) == k: break
    return out
def flatten(cg, rng):
    """the FLAT control: permute the participant slots across the document's clauses (clause sizes kept)"""
    slots = [m for c in cg["clauses"] for m in c["members"]]; rng.shuffle(slots); it = iter(slots); out = []
    for c in cg["clauses"]: out.append({"sent": c["sent"], "members": sorted({next(it) for _ in c["members"]})})
    return out

class Universe:
    def __init__(self, cg, S11, clauses):
        self.cg, self.S, self.n = cg, S11, S11.shape[0]; self.cl = clauses; self.touch = collections.defaultdict(list)
        for ci, c in enumerate(clauses):
            for m in c["members"]: self.touch[m].append(ci)
    def hops(self, q, bind=False):
        """P_h for h = 0..HMAX: the class's own sentences plus the sentences of the clauses touching the universe; the universe adds the co-participants"""
        U = {q}; S0 = set(self.cg["classes"][q]["sents"]); out = []; extra = []
        for h in range(HMAX + 1):
            C = {ci for u in U for ci in self.touch.get(u, [])}; P = set(S0) | {self.cl[ci]["sent"] for ci in C}
            if bind: P |= {a["sent"] for a in self.cg["anaphors"] if set(a["classes"]) & U}
            out.append(sorted(P)); U = U | {m for ci in C for m in self.cl[ci]["members"]}
        return out
    def rank(self, P, q):
        """a class scores by the best cosine between any of its sentences and any universe sentence (a sentence never matches itself)"""
        M = self.S[:, P].copy()
        for c, pi in enumerate(P): M[pi, c] = -9.0
        best = M.max(axis=1); nc = len(self.cg["classes"]); sc = np.full(nc, -9.0)
        for j in range(nc): sc[j] = max(best[x] for x in self.cg["classes"][j]["sents"])
        return order(sc, {q})
def stop(tops, tau):
    """the stopping rule over DISTINCT universes: a hop that adds no sentence changes nothing by construction, so it is skipped and never counts as stability (a hop that adds nothing is not evidence of stability). Stable = the top-10 of this universe shares >= tau with the previous distinct one; a universe that stops growing is exhausted (stable); growth still going at HMAX is unstable."""
    prev = 0
    for h in range(1, HMAX + 1):
        if tops[h][1] == tops[prev][1]: continue
        if len(set(tops[h][0]) & set(tops[prev][0])) / K10 >= tau: return tops[h][0], h, tops[h][1], False
        prev = h
    return tops[prev][0], prev, tops[prev][1], prev == HMAX

def main():
    cgf, outf = sys.argv[1], sys.argv[2]
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(os.path.join(REF, "models", "all-MiniLM-L6-v2"), device="cpu")
    enc = lambda xs: model.encode(list(xs), normalize_embeddings=True, batch_size=64, show_progress_bar=False)
    arb = check_registry(ARM_SPECS); print("REFERENT-FIRST: arms resting on an ARBITRARY CONSTANT:", ", ".join(arb) or "none (every context arm declares a stopping-rule cut)"); print("twins: " + ", ".join(f"{a}<->{sp['twin']}" for a, sp in ARM_SPECS.items() if sp["role"] == "context"))
    R = json.load(open(cgf)); per = []; hops = collections.Counter(); unstable = collections.Counter(); sizes = collections.defaultdict(list); t0 = time.time()
    for di, full in enumerate(R):
        d = json.load(open(full["file"])); t = d["text"]; sents = [t[s["c0"]:s["c1"]] for s in d["sentences"]]; G = gold(full); cg = strip(full); C = cg["classes"]
        if not G: per.append(None); continue
        E = enc(sents); S11 = E @ E.T; EA = enc([c["anchor"] for c in C]); rng = random.Random(SEED + di)
        U = Universe(cg, S11, cg["clauses"]); UF = Universe(cg, S11, flatten(cg, random.Random(SEED + 7 * di)))
        qs = sorted(G); rec = {}; prec = {}
        def tally(arm, q, top, grown):
            for gj in G[q]:
                dj = not (toks(C[q]["anchor"]) & toks(C[gj]["anchor"])); st = ["ALIAS", "DISJOINT" if dj else "SHARED"] + (["GROWN"] + (["GROWN_DISJOINT"] if dj else []) if grown else [])
                for s in st:
                    rec.setdefault(arm, {}).setdefault(s, [0, 0]); rec[arm][s][1] += 1; rec[arm][s][0] += 1 if gj in top else 0
            p = prec.setdefault(arm, [0, 0]); p[0] += len(set(top) & set(G[q])); p[1] += len(top)
        def grow_adj(seeds):
            dist = np.min(np.abs(np.arange(len(sents))[:, None] - np.array(seeds)[None, :]), axis=1); return [([i for i in range(len(sents)) if dist[i] <= h]) for h in range(HMAX + 1)], dist
        for qi, q in enumerate(qs):
            nxt = qs[(qi + 1) % len(qs)]; tops = [(U.rank(P, q), len(P)) for P in U.hops(q)]; sel, h, size, uns = stop(tops, TAU); hops[h] += 1; unstable[uns] += 1; sizes["CG"].append(size); sizes["twin_degenerate"].append(1 if size <= len(set(C[q]["sents"])) else 0)
            top = {"A0": order(EA @ EA[q], {q}), "CG": sel, "CG_t06": stop(tops, 0.6)[0], "CG_t10": stop(tops, 1.0)[0]}
            tb = [(U.rank(P, q), len(P)) for P in U.hops(q, bind=True)]; top["CGB"] = stop(tb, TAU)[0]; sizes["CGB"].append(stop(tb, TAU)[2])
            tf = [(UF.rank(P, q), len(P)) for P in UF.hops(q)]; top["FLAT"] = stop(tf, TAU)[0]
            seeds = sorted(set(C[q]["sents"])); Ps, dist = grow_adj(seeds); ta = [(U.rank(P, q), len(P)) for P in Ps]; top["ADJ"] = stop(ta, TAU)[0]; sizes["ADJ"].append(stop(ta, TAU)[2])
            pool = [i for i in range(len(sents)) if i not in set(seeds)]; P = seeds + rng.sample(pool, min(len(pool), max(0, size - len(seeds)))); top["T_CG"] = U.rank(P, q)
            cs = np.array([-min(dist[x] for x in c["sents"]) for c in C]); top["PROX"] = order(cs, {q})
            tn = [(U.rank(P_, nxt), len(P_)) for P_ in U.hops(nxt)]; top["CG_swap"] = stop(tn, TAU)[0] if nxt != q else []
            top["A0_swap"] = order(EA @ EA[nxt], {q}) if nxt != q else []
            grown = size > len(set(C[q]["sents"])); sizes["grown"].append(1 if grown else 0)
            for a, tp in top.items(): tally(a, q, tp, grown)
            npool = len(C) - 1
            for gj in G[q]:
                dj = not (toks(C[q]["anchor"]) & toks(C[gj]["anchor"]))
                for s in ["ALIAS", "DISJOINT" if dj else "SHARED"] + (["GROWN"] + (["GROWN_DISJOINT"] if dj else []) if grown else []):
                    rec.setdefault("null", {}).setdefault(s, [0, 0]); rec["null"][s][1] += 1; rec["null"][s][0] += min(K10, npool) / max(1, npool)
        per.append({"title": d["title"], "rec": rec, "prec": prec})
        if (di + 1) % 5 == 0: print(f"  ... {di + 1}/{len(R)} documents ({time.time() - t0:.0f}s)", flush=True)
    json.dump({"graph": cgf, "per": per, "hops": dict(hops), "unstable": dict(unstable), "sizes": {k: [int(np.median(v)), int(np.mean(v))] for k, v in sizes.items() if v}}, open(outf, "w"))
    report(per, hops, unstable, sizes)

def report(per, hops, unstable, sizes):
    per = [p for p in per if p]; rng = np.random.default_rng(SEED)
    def pooled(arm, st, idx=None):
        h = g = 0.0
        for i in (range(len(per)) if idx is None else idx):
            v = per[i]["rec"].get(arm, {}).get(st)
            if v: h += v[0]; g += v[1]
        return (h / g if g else float("nan")), g
    def boot(fn, B=2000):
        out = [fn(rng.integers(0, len(per), len(per))) for _ in range(B)]; return float(np.nanpercentile(out, 2.5)), float(np.nanpercentile(out, 97.5))
    ARMS = ["A0", "CG", "CG_t06", "CG_t10", "CGB", "ADJ", "FLAT", "T_CG", "PROX", "null"]
    print(f"\n=== DOC-ALIAS recall@10 pooled over {len(per)} documents (gold: ALIAS {int(pooled('A0', 'ALIAS')[1])}, DISJOINT {int(pooled('A0', 'DISJOINT')[1])}, SHARED {int(pooled('A0', 'SHARED')[1])}, GROWN {int(pooled('A0', 'GROWN')[1])}, GROWN_DISJOINT {int(pooled('A0', 'GROWN_DISJOINT')[1])})")
    print("arm".ljust(8) + "".join(s.rjust(11) for s in ["ALIAS", "DISJOINT", "SHARED", "GROWN", "GROWN_DISJOINT"]) + "   prec@10")
    pr = lambda a: sum(p["prec"].get(a, [0, 0])[0] for p in per) / max(1, sum(p["prec"].get(a, [0, 0])[1] for p in per))
    for a in ARMS: print(a.ljust(8) + "".join(f"{pooled(a, s)[0]:11.3f}" for s in ["ALIAS", "DISJOINT", "SHARED", "GROWN", "GROWN_DISJOINT"]) + (f"   {pr(a):.3f}" if a != "null" else ""))
    print("hop reached (stopping rule, tau=%.1f):" % TAU, dict(sorted(hops.items())), "| not stable by HMAX:", dict(unstable), "| universe size at the stop (median, mean):", {k: [int(np.median(v)), int(np.mean(v))] for k, v in sizes.items() if k not in ("twin_degenerate", "grown")}); print("T_CG is DEGENERATE (the universe never grew past its own sentences, so the twin equals the arm) on %d of %d queries" % (sum(sizes["twin_degenerate"]), len(sizes["twin_degenerate"])))
    pr2 = lambda a: pr(a)
    for STR in ("DISJOINT", "GROWN_DISJOINT"):
        zc = lambda a, idx=None, STR=STR: pooled(a, STR, idx)[0]; n = int(pooled("A0", STR)[1])
        print(f"\n--- falsifiers on {STR} ({n} gold{'; UNJUDGEABLE, under 30' if n < 30 else ''}) ---")
        for tag, X, Y, why in (("G1", "CG", "A0", "claims add nothing over the label"), ("G2", "CG", "T_CG", "structure adds nothing over the same strings"), ("G3", "CG", "ADJ", "the claim graph is no better than adjacency"), ("G4", "CG", "PROX", "it is locality"), ("G5", "CG", "FLAT", "the dependency structure adds nothing: it was strings"), ("G7", "CGB", "CG", "bindings add no reach")):
            dd = zc(X) - zc(Y); lo, hi = boot(lambda ix: zc(X, ix) - zc(Y, ix)); print(f"{tag} {X} {zc(X):.3f} vs {Y} {zc(Y):.3f}, diff {dd:+.3f} [{lo:+.3f}, {hi:+.3f}] -> {'HIT (' + why + ')' if (dd < 0.05 or lo <= 0) else 'not hit'}")
        t, s_ = zc("CG"), zc("CG_swap"); print(f"G6 CG: true {t:.3f}, target-swap {s_:.3f}, ratio {s_ / t if t else float('nan'):.2f} -> {'HIT (topical, not referent-tied)' if t and s_ >= 0.5 * t else 'not hit'}")
    print(f"G8 precision@10 CG {pr('CG'):.3f} vs A0 {pr('A0'):.3f} -> {'HIT (gain bought with junk)' if pr('CG') < 0.5 * pr('A0') else 'not hit'}")
    print("UNJUDGEABLE strata (< 30 gold):", [s for s in ["ALIAS", "DISJOINT", "SHARED", "GROWN", "GROWN_DISJOINT"] if pooled("A0", s)[1] < 30] or "none")
if __name__ == "__main__": main()
