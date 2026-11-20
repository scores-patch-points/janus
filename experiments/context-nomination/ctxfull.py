"""ctxfull.py <fg.json> <out.json>   ADDENDUM-1 of PREREG-CLAIM-GRAPH-UNIVERSE: the referent's universe is its connections to ALL other nodes, grown until the connections stop mattering at the asker's tolerance.
Graph (built from fullgraph.mjs output): a NODE is an anchor class (every token of its link-mention spans), or a common/proper noun keyed by its reader lemma (second declared string handle), or any other token instance;
an EDGE is every dependency relation of the reader (any label, undirected), plus Janus's binding candidates (anaphor token <-> candidate class, none chosen) in FGB. The universe of a class at hop h = the sentences of every node within graph distance h.
Every arm is a NOMINATOR returning ten class indices; the arms never see the link targets (strip). Same embedder, stopping rule (TAU 0.8, swept 0.6/1.0), bootstrap and strata as ctxalias.py."""
import sys, os, json, random, collections, time
import numpy as np
os.environ["HF_HUB_OFFLINE"] = "1"; os.environ["TOKENIZERS_PARALLELISM"] = "false"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ctxalias as A
from ctxalias import strip, gold, order, toks, STOP
from ctxnom import check_registry, REF, SEED, K10, TAU
HMAXF = 8      # a safety cap only (the stopping rule decides); declared in ADDENDUM-1, larger than ctxalias's 6 because the full graph crosses sentences only after several token hops
ARM_SPECS = {
 "A0":    dict(role="baseline", referent="none: the bare anchor string", evidence="the embedder's prior (a given from its training, a nominator)", twin=None, cut="none"),
 "FG":    dict(role="context", referent="the class as its universe: every node connected to it by any dependency relation, widened hop by hop", evidence="the reader's full dependency graph; sentences kept as units", twin="T_FG", cut=STOP),
 "FGB":   dict(role="context", referent="FG plus Janus binding candidates as edges", evidence="dependency graph and binding candidates (all listed, none chosen)", twin="T_FG", cut=STOP),
 "FG_NOLEM": dict(role="context", referent="FG without the lemma handle: only anchor classes merge", evidence="the reader's dependency graph; sentences kept as units", twin="T_FG", cut=STOP),
 "ADJF":  dict(role="context", referent="the class's sentences widened hop by hop through document adjacency", evidence="sentences kept as units", twin="T_FG", cut=STOP),
 "FLATF": dict(role="context", referent="FG with every sentence's head pointers permuted (structure removed, strings and lemma merges kept)", evidence="sentences kept as units", twin="T_FG", cut=STOP),
 "T_FG":  dict(role="twin", referent="the same hop-0 sentences plus random sentences to the size FG reached", evidence="strings only", twin=None, cut="size copied from FG"),
 "PROX":  dict(role="control", referent="locality alone: document distance to the nearest hop-0 sentence", evidence="document order", twin=None, cut="none"),
}
def node_of(t, i, lemma_handle=True):
    if t["cls"] >= 0: return ("C", t["cls"])
    if lemma_handle and t["upos"] in ("NOUN", "PROPN") and t["lemma"]: return ("L", t["lemma"])
    return ("T", i)
def build(rec, lemma_handle=True, bind=False, rewire=None):
    T = rec["tokens"]; nodes = [node_of(t, i, lemma_handle) for i, t in enumerate(T)]; adj = collections.defaultdict(set); sents = collections.defaultdict(set)
    for i, t in enumerate(T): sents[nodes[i]].add(t["sent"])
    heads = [t["head"] for t in T]
    if rewire is not None:    # permute the head pointers among the dependents of each sentence
        by = collections.defaultdict(list)
        for i, h in enumerate(heads):
            if h >= 0: by[T[i]["sent"]].append(i)
        for s, ids in by.items():
            hs = [heads[i] for i in ids]; rewire.shuffle(hs)
            for i, h in zip(ids, hs): heads[i] = h
    for i, h in enumerate(heads):
        if h >= 0 and nodes[h] != nodes[i]: adj[nodes[i]].add(nodes[h]); adj[nodes[h]].add(nodes[i])
    if bind:
        for a in rec["anaphors"]:
            for c in a["classes"]:
                x, y = nodes[a["tok"]], ("C", c)
                if x != y: adj[x].add(y); adj[y].add(x)
    return adj, sents
def hops_of(rec, adj, sents, q):
    """P_h: the class's own sentences plus the sentences of every node within graph distance h (h = 0 is the class node)"""
    S0 = set(rec["classes"][q]["sents"]); seen = {("C", q)}; front = [("C", q)]; out = []
    for h in range(HMAXF + 1):
        P = set(S0); 
        for nd in seen: P |= sents.get(nd, set())
        out.append(sorted(P)); nxt = []
        for nd in front:
            for nb in adj.get(nd, ()):
                if nb not in seen: seen.add(nb); nxt.append(nb)
        front = nxt
    return out
def stop(tops, tau):
    """A.stop with this experiment's HMAXF cap: a hop adding no sentence is skipped; growth still going at the cap is unstable"""
    prev = 0
    for h in range(1, HMAXF + 1):
        if tops[h][1] == tops[prev][1]: continue
        if len(set(tops[h][0]) & set(tops[prev][0])) / K10 >= tau: return tops[h][0], h, tops[h][1], False
        prev = h
    return tops[prev][0], prev, tops[prev][1], prev == HMAXF

def main():
    fgf, outf = sys.argv[1], sys.argv[2]
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(os.path.join(REF, "models", "all-MiniLM-L6-v2"), device="cpu")
    enc = lambda xs: model.encode(list(xs), normalize_embeddings=True, batch_size=64, show_progress_bar=False)
    arb = check_registry(ARM_SPECS); print("REFERENT-FIRST: arms resting on an ARBITRARY CONSTANT:", ", ".join(arb) or "none (every context arm cuts by the stopping rule)"); print("twins: " + ", ".join(f"{a}<->{sp['twin']}" for a, sp in ARM_SPECS.items() if sp["role"] == "context"))
    R = json.load(open(fgf)); per = []; hops = collections.Counter(); unstable = collections.Counter(); sizes = collections.defaultdict(list); t0 = time.time()
    for di, full in enumerate(R):
        d = json.load(open(full["file"])); t = d["text"]; sents = [t[s["c0"]:s["c1"]] for s in d["sentences"]]; G = gold(full); rec0 = strip(full); C = rec0["classes"]
        if not G: per.append(None); continue
        E = enc(sents); S11 = E @ E.T; EA = enc([c["anchor"] for c in C]); rng = random.Random(SEED + di)
        shell = {"classes": C, "anaphors": [], "clauses": []}; U = A.Universe(shell, S11, [])
        gA, sA = build(rec0); gB, sB = build(rec0, bind=True); gN, sN = build(rec0, lemma_handle=False); gF, sF = build(rec0, rewire=random.Random(SEED + 7 * di))
        qs = sorted(G); rec = {}; prec = {}
        def tally(arm, q, top, grown):
            for gj in G[q]:
                dj = not (toks(C[q]["anchor"]) & toks(C[gj]["anchor"])); st = ["ALIAS", "DISJOINT" if dj else "SHARED"] + (["GROWN"] + (["GROWN_DISJOINT"] if dj else []) if grown else [])
                for s in st: rec.setdefault(arm, {}).setdefault(s, [0, 0]); rec[arm][s][1] += 1; rec[arm][s][0] += 1 if gj in top else 0
            p = prec.setdefault(arm, [0, 0]); p[0] += len(set(top) & set(G[q])); p[1] += len(top)
        def run(adj, sn, q):
            tops = [(U.rank(P, q), len(P)) for P in hops_of(rec0, adj, sn, q)]; return tops
        for qi, q in enumerate(qs):
            nxt = qs[(qi + 1) % len(qs)]; tops = run(gA, sA, q); sel, h, size, uns = stop(tops, TAU); hops[h] += 1; unstable[uns] += 1; sizes["FG"].append(size)
            top = {"A0": order(EA @ EA[q], {q}), "FG": sel, "FG_t06": stop(tops, 0.6)[0], "FG_t10": stop(tops, 1.0)[0]}
            top["FGB"] = stop(run(gB, sB, q), TAU)[0]; top["FG_NOLEM"] = stop(run(gN, sN, q), TAU)[0]; top["FLATF"] = stop(run(gF, sF, q), TAU)[0]
            seeds = sorted(set(C[q]["sents"])); dist = np.min(np.abs(np.arange(len(sents))[:, None] - np.array(seeds)[None, :]), axis=1)
            Ps = [[i for i in range(len(sents)) if dist[i] <= hh] for hh in range(HMAXF + 1)]; ta = [(U.rank(P, q), len(P)) for P in Ps]; top["ADJF"] = stop(ta, TAU)[0]; sizes["ADJF"].append(stop(ta, TAU)[2])
            pool = [i for i in range(len(sents)) if i not in set(seeds)]; P = seeds + rng.sample(pool, min(len(pool), max(0, size - len(seeds)))); top["T_FG"] = U.rank(P, q)
            top["PROX"] = order(np.array([-min(dist[x] for x in c["sents"]) for c in C]), {q})
            top["FG_swap"] = stop(run(gA, sA, nxt), TAU)[0] if nxt != q else []; top["A0_swap"] = order(EA @ EA[nxt], {q}) if nxt != q else []
            grown = size > len(set(C[q]["sents"])); sizes["grown"].append(1 if grown else 0)
            for a, tp in top.items(): tally(a, q, tp, grown)
            npool = len(C) - 1
            for gj in G[q]:
                dj = not (toks(C[q]["anchor"]) & toks(C[gj]["anchor"]))
                for s in ["ALIAS", "DISJOINT" if dj else "SHARED"] + (["GROWN"] + (["GROWN_DISJOINT"] if dj else []) if grown else []):
                    rec.setdefault("null", {}).setdefault(s, [0, 0]); rec["null"][s][1] += 1; rec["null"][s][0] += min(K10, npool) / max(1, npool)
        per.append({"title": d["title"], "rec": rec, "prec": prec})
        if (di + 1) % 5 == 0: print(f"  ... {di + 1}/{len(R)} documents ({time.time() - t0:.0f}s)", flush=True)
    json.dump({"graph": fgf, "per": per, "hops": dict(hops), "unstable": dict(unstable)}, open(outf, "w")); report(per, hops, unstable, sizes)

def report(per, hops, unstable, sizes):
    per = [p for p in per if p]; rng = np.random.default_rng(SEED); STR = ["ALIAS", "DISJOINT", "SHARED", "GROWN", "GROWN_DISJOINT"]
    def pooled(arm, st, idx=None):
        h = g = 0.0
        for i in (range(len(per)) if idx is None else idx):
            v = per[i]["rec"].get(arm, {}).get(st)
            if v: h += v[0]; g += v[1]
        return (h / g if g else float("nan")), g
    def boot(fn, B=2000):
        out = [fn(rng.integers(0, len(per), len(per))) for _ in range(B)]; return float(np.nanpercentile(out, 2.5)), float(np.nanpercentile(out, 97.5))
    ARMS = ["A0", "FG", "FG_t06", "FG_t10", "FGB", "FG_NOLEM", "ADJF", "FLATF", "T_FG", "PROX", "null"]
    print(f"\n=== DOC-ALIAS (full graph) recall@10 pooled over {len(per)} documents (gold: " + ", ".join(f"{s} {int(pooled('A0', s)[1])}" for s in STR) + ")")
    print("arm".ljust(10) + "".join(s.rjust(15) for s in STR) + "   prec@10")
    pr = lambda a: sum(p["prec"].get(a, [0, 0])[0] for p in per) / max(1, sum(p["prec"].get(a, [0, 0])[1] for p in per))
    for a in ARMS: print(a.ljust(10) + "".join(f"{pooled(a, s)[0]:15.3f}" for s in STR) + (f"   {pr(a):.3f}" if a != "null" else ""))
    print("hop reached (stopping rule, tau=%.1f, cap %d):" % (TAU, HMAXF), dict(sorted(hops.items())), "| not stable by the cap:", dict(unstable), "| universe size at the stop (median, mean):", {k: [int(np.median(v)), int(np.mean(v))] for k, v in sizes.items() if k != "grown"}, "| grown beyond own sentences: %d of %d" % (sum(sizes["grown"]), len(sizes["grown"])))
    for S in ("DISJOINT", "GROWN_DISJOINT"):
        zc = lambda a, idx=None, S=S: pooled(a, S, idx)[0]; n = int(pooled("A0", S)[1]); print(f"\n--- falsifiers on {S} ({n} gold{'; UNJUDGEABLE, under 30' if n < 30 else ''}) ---")
        for tag, X, Y, why in (("G1", "FG", "A0", "claims add nothing over the label"), ("G2", "FG", "T_FG", "structure adds nothing over the same strings"), ("G3", "FG", "ADJF", "the graph is no better than adjacency"), ("G4", "FG", "PROX", "it is locality"), ("G5", "FG", "FLATF", "the dependency structure adds nothing: it was strings"), ("G7", "FGB", "FG", "bindings add no reach"), ("G9", "FG", "FG_NOLEM", "the lemma handle adds nothing")):
            dd = zc(X) - zc(Y); lo, hi = boot(lambda ix: zc(X, ix) - zc(Y, ix)); print(f"{tag} {X} {zc(X):.3f} vs {Y} {zc(Y):.3f}, diff {dd:+.3f} [{lo:+.3f}, {hi:+.3f}] -> {'HIT (' + why + ')' if (dd < 0.05 or lo <= 0) else 'not hit'}")
        t, s_ = zc("FG"), zc("FG_swap"); print(f"G6 FG: true {t:.3f}, target-swap {s_:.3f}, ratio {s_ / t if t else float('nan'):.2f} -> {'HIT (topical, not referent-tied)' if t and s_ >= 0.5 * t else 'not hit'}")
    print(f"G8 precision@10 FG {pr('FG'):.3f} vs A0 {pr('A0'):.3f} -> {'HIT (gain bought with junk)' if pr('FG') < 0.5 * pr('A0') else 'not hit'}")
    print("UNJUDGEABLE strata (< 30 gold):", [s for s in STR if pooled("A0", s)[1] < 30] or "none")
if __name__ == "__main__": main()
