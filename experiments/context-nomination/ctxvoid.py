"""ctxvoid.py <fg.json> <out.json>   ADDENDUM-2 of PREREG-CLAIM-GRAPH-UNIVERSE: the relevance gate is the DEF of the VOID.
The void (fields named after khora's EOVoidDeclaration@1: slot, anchor, relation, admits, cardinality, extent, plus the giver) is declared for the asker's task; a connection is traversed only if it bears on the void's relation, and the reach ends when no further connection does.
The gate reads dependency edges ONLY through VOID["relation"] (data); there is no other list. Every arm is a NOMINATOR returning ten class indices; the arms never see the link targets."""
import sys, os, json, random, collections, time
import numpy as np
os.environ["HF_HUB_OFFLINE"] = "1"; os.environ["TOKENIZERS_PARALLELISM"] = "false"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ctxalias as A, ctxfull as F
from ctxalias import strip, gold, order, toks, STOP
from ctxnom import check_registry, REF, SEED, K10
HMAXF = F.HMAXF
VOID = {   # the asker's declaration for DOC-ALIAS (the owner's task statement, 2026-11-20); a given with a named giver, never derived from a corpus
  "slot": "identity", "admits": None, "admits_gap": "kind_unread", "cardinality": "many", "extent": "document",
  "giver": "the asker of DOC-ALIAS (owner, 2026-11-20)", "prior": "Universal Dependencies guidelines: which configurations state or constrain identity",
  "relation": {"name": "same-being-as", "edges": [{"dep": "appos"}, {"dep": "nsubj", "head_has_child": "cop"}, {"dep": "flat"}], "binding": "admitted only in the B arms"},
}
def void_of(q, C):
    """the void of one query: SIG anchor = the class; every field the asker's statement does not give stays a typed gap"""
    return {**{k: v for k, v in VOID.items() if k != "relation"}, "anchor": C[q]["anchor"], "relation": VOID["relation"]["name"]}
ARM_SPECS = {
 "A0":   dict(role="baseline", referent="none: the bare anchor string", evidence="the embedder's prior (a given from its training, a nominator)", twin=None, cut="none"),
 "VG":   dict(role="context", referent="the class as its universe: only connections that bear on the declared void (same-being-as)", evidence="the reader's dependency edges admitted by the void's relation; sentences kept as units", twin="VG_RAND", cut="relevance exhaustion: no further edge bears on the void (HMAXF cap)"),
 "VGB":  dict(role="context", referent="VG plus Janus binding candidates as connections", evidence="the void's edges and binding candidates (all listed, none chosen)", twin="VGB_RAND", cut="relevance exhaustion: no further edge bears on the void (HMAXF cap)"),
 "VGR":  dict(role="context", referent="the classes the void-gated graph REACHES, listed first, then the VGB ranking", evidence="the void's edges and binding candidates", twin="VGB_RAND", cut="relevance exhaustion: no further edge bears on the void (HMAXF cap)"),
 "NG":   dict(role="context", referent="the ungated graph: every dependency edge, anchor merge only", evidence="the reader's dependency graph; sentences kept as units", twin="T_VG", cut=STOP),
 "ADJF": dict(role="context", referent="the class's sentences widened through document adjacency", evidence="sentences kept as units", twin="T_VG", cut=STOP),
 "VGB_RAND": dict(role="twin", referent="the same number of random dependency edges PLUS the same binding candidates", evidence="strings only (edges without the relation)", twin=None, cut="relevance exhaustion on the random edge set"),
 "VG_RAND": dict(role="twin", referent="the same NUMBER of dependency edges as the void admits in this document, chosen at random", evidence="strings only (edges without the relation)", twin=None, cut="relevance exhaustion on the random edge set"),
 "T_VG": dict(role="twin", referent="the same hop-0 sentences plus random sentences to the size VGB reached", evidence="strings only", twin=None, cut="size copied from VGB"),
 "PROX": dict(role="control", referent="locality alone: document distance to the nearest hop-0 sentence", evidence="document order", twin=None, cut="none"),
}
def base(dep): return dep.split(":")[0]
def bears(T, i, kids):
    """does the edge token i -> its head bear on the void's relation? read ONLY through VOID["relation"]["edges"]"""
    t = T[i]
    if t["head"] < 0: return False
    for rule in VOID["relation"]["edges"]:
        if base(t["dep"]) != rule["dep"]: continue
        if "head_has_child" in rule and rule["head_has_child"] not in kids.get(t["head"], set()): continue
        return True
    return False
def kids_of(T):
    k = collections.defaultdict(set)
    for i, t in enumerate(T):
        if t["head"] >= 0: k[t["head"]].add(base(t["dep"]))
    return k
def build(rec, pick=None, bind=False):
    """pick(i) -> True admits the dependency edge of token i; nodes: anchor classes merge, every other token is its own node (no lemma merge)"""
    T = rec["tokens"]; nodes = [("C", t["cls"]) if t["cls"] >= 0 else ("T", i) for i, t in enumerate(T)]; adj = collections.defaultdict(set); sents = collections.defaultdict(set)
    for i, t in enumerate(T): sents[nodes[i]].add(t["sent"])
    for i, t in enumerate(T):
        h = t["head"]
        if h >= 0 and pick(i) and nodes[h] != nodes[i]: adj[nodes[i]].add(nodes[h]); adj[nodes[h]].add(nodes[i])
    if bind:
        for a in rec["anaphors"]:
            for c in a["classes"]:
                x, y = nodes[a["tok"]], ("C", c)
                if x != y: adj[x].add(y); adj[y].add(x)
    return adj, sents
def reach(rec, adj, sents, q):
    """relevance exhaustion: traverse only the admitted edges until none remains; returns (universe sentences, classes reached in order of hop then index, unstable)"""
    S0 = set(rec["classes"][q]["sents"]); seen = {("C", q)}; front = [("C", q)]; cls = []; P = set(S0) | sents.get(("C", q), set()); grew = False
    for h in range(1, HMAXF + 1):
        nxt = []
        for nd in front:
            for nb in adj.get(nd, ()):
                if nb not in seen: seen.add(nb); nxt.append(nb)
        if not nxt: grew = False; break
        for nd in nxt: P |= sents.get(nd, set())
        cls += sorted(nd[1] for nd in nxt if nd[0] == "C" and nd[1] != q); front = nxt; grew = h == HMAXF
    return sorted(P), cls, grew

def main():
    fgf, outf = sys.argv[1], sys.argv[2]
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(os.path.join(REF, "models", "all-MiniLM-L6-v2"), device="cpu")
    enc = lambda xs: model.encode(list(xs), normalize_embeddings=True, batch_size=64, show_progress_bar=False)
    arb = check_registry(ARM_SPECS); print("REFERENT-FIRST: arms resting on an ARBITRARY CONSTANT:", ", ".join(arb) or "none (every context arm cuts by relevance exhaustion or the stopping rule)"); print("twins: " + ", ".join(f"{a}<->{sp['twin']}" for a, sp in ARM_SPECS.items() if sp["role"] == "context"))
    R = json.load(open(fgf)); per = []; sizes = collections.defaultdict(list); unst = collections.Counter(); t0 = time.time()
    for di, full in enumerate(R):
        d = json.load(open(full["file"])); t = d["text"]; sents = [t[s["c0"]:s["c1"]] for s in d["sentences"]]; G = gold(full); rec0 = strip(full); C = rec0["classes"]
        if not G: per.append(None); continue
        E = enc(sents); S11 = E @ E.T; EA = enc([c["anchor"] for c in C]); rng = random.Random(SEED + di)
        shell = {"classes": C, "anaphors": [], "clauses": []}; U = A.Universe(shell, S11, []); T = rec0["tokens"]; kids = kids_of(T)
        okmask = [bears(T, i, kids) for i in range(len(T))]; allE = [i for i, t_ in enumerate(T) if t_["head"] >= 0]; k = sum(okmask)
        rnd = set(random.Random(SEED + 11 * di).sample(allE, min(k, len(allE)))); sizes["gate_edges_per_doc"].append(k)
        gV, sV = build(rec0, pick=lambda i: okmask[i]); gVB, sVB = build(rec0, pick=lambda i: okmask[i], bind=True); gR, sR = build(rec0, pick=lambda i: i in rnd); gRB, sRB = build(rec0, pick=lambda i: i in rnd, bind=True); gN, sN = build(rec0, pick=lambda i: True)
        qs = sorted(G); rec = {}; prec = {}
        def tally(arm, q, top, grown):
            for gj in G[q]:
                dj = not (toks(C[q]["anchor"]) & toks(C[gj]["anchor"])); st = ["ALIAS", "DISJOINT" if dj else "SHARED"] + (["GROWN"] + (["GROWN_DISJOINT"] if dj else []) if grown else [])
                for s in st: rec.setdefault(arm, {}).setdefault(s, [0, 0]); rec[arm][s][1] += 1; rec[arm][s][0] += 1 if gj in top else 0
            p = prec.setdefault(arm, [0, 0]); p[0] += len(set(top) & set(G[q])); p[1] += len(top)
        for qi, q in enumerate(qs):
            nxt = qs[(qi + 1) % len(qs)]; own = set(C[q]["sents"])
            PV, _, uV = reach(rec0, gV, sV, q); PB, cB, uB = reach(rec0, gVB, sVB, q); PR, _, uR = reach(rec0, gR, sR, q); PRB, _, _ = reach(rec0, gRB, sRB, q); unst[uB] += 1
            vg = U.rank(PV, q); vgb = U.rank(PB, q); reached = [c for c in cB]; vgr = list(dict.fromkeys(reached + vgb))[:K10]
            tn = [(U.rank(P, q), len(P)) for P in F.hops_of(rec0, gN, sN, q)]
            seeds = sorted(own); dist = np.min(np.abs(np.arange(len(sents))[:, None] - np.array(seeds)[None, :]), axis=1)
            ta = [(U.rank([i for i in range(len(sents)) if dist[i] <= hh], q), int((dist <= hh).sum())) for hh in range(HMAXF + 1)]
            pool = [i for i in range(len(sents)) if i not in set(seeds)]; size = len(PB); Pt = seeds + rng.sample(pool, min(len(pool), max(0, size - len(seeds))))
            top = {"A0": order(EA @ EA[q], {q}), "VG": vg, "VGB": vgb, "VGR": vgr, "NG": F.stop(tn, 0.8)[0], "ADJF": F.stop(ta, 0.8)[0], "VG_RAND": U.rank(PR, q), "VGB_RAND": U.rank(PRB, q), "T_VG": U.rank(Pt, q), "PROX": order(np.array([-min(dist[x] for x in c["sents"]) for c in C]), {q})}
            nP, _, _ = reach(rec0, gVB, sVB, nxt) if nxt != q else (None, None, None); top["VGB_swap"] = U.rank(nP, nxt) if nP else []; top["A0_swap"] = order(EA @ EA[nxt], {q}) if nxt != q else []
            grown = len(PB) > len(own); sizes["grown"].append(1 if grown else 0); sizes["grown_VG"].append(1 if len(PV) > len(own) else 0); sizes["grown_VG_RAND"].append(1 if len(PR) > len(own) else 0); sizes["VGB"].append(len(PB)); sizes["reached_classes"].append(len(reached))
            for a, tp in top.items(): tally(a, q, tp, grown)
            npool = len(C) - 1
            for gj in G[q]:
                dj = not (toks(C[q]["anchor"]) & toks(C[gj]["anchor"]))
                for s in ["ALIAS", "DISJOINT" if dj else "SHARED"] + (["GROWN"] + (["GROWN_DISJOINT"] if dj else []) if grown else []):
                    rec.setdefault("null", {}).setdefault(s, [0, 0]); rec["null"][s][1] += 1; rec["null"][s][0] += min(K10, npool) / max(1, npool)
        per.append({"title": d["title"], "rec": rec, "prec": prec})
        if (di + 1) % 5 == 0: print(f"  ... {di + 1}/{len(R)} documents ({time.time() - t0:.0f}s)", flush=True)
    json.dump({"graph": fgf, "per": per, "unstable": dict(unst)}, open(outf, "w")); report(per, sizes, unst)

def report(per, sizes, unst):
    per = [p for p in per if p]; rng = np.random.default_rng(SEED); STR = ["ALIAS", "DISJOINT", "SHARED", "GROWN", "GROWN_DISJOINT"]
    def pooled(arm, st, idx=None):
        h = g = 0.0
        for i in (range(len(per)) if idx is None else idx):
            v = per[i]["rec"].get(arm, {}).get(st)
            if v: h += v[0]; g += v[1]
        return (h / g if g else float("nan")), g
    def boot(fn, B=2000):
        out = [fn(rng.integers(0, len(per), len(per))) for _ in range(B)]; return float(np.nanpercentile(out, 2.5)), float(np.nanpercentile(out, 97.5))
    ARMS = ["A0", "VG", "VGB", "VGR", "NG", "ADJF", "VG_RAND", "VGB_RAND", "T_VG", "PROX", "null"]
    print(f"\n=== DOC-ALIAS (void-gated) recall@10 pooled over {len(per)} documents (gold: " + ", ".join(f"{s} {int(pooled('A0', s)[1])}" for s in STR) + ")")
    print("arm".ljust(10) + "".join(s.rjust(15) for s in STR) + "   prec@10")
    pr = lambda a: sum(p["prec"].get(a, [0, 0])[0] for p in per) / max(1, sum(p["prec"].get(a, [0, 0])[1] for p in per))
    for a in ARMS: print(a.ljust(10) + "".join(f"{pooled(a, s)[0]:15.3f}" for s in STR) + (f"   {pr(a):.3f}" if a != "null" else ""))
    print("gate admits per document (median, mean edges):", int(np.median(sizes["gate_edges_per_doc"])), int(np.mean(sizes["gate_edges_per_doc"])), "| VGB universe size (median, mean sentences):", int(np.median(sizes["VGB"])), int(np.mean(sizes["VGB"])), "| classes reached per query (mean): %.2f" % np.mean(sizes["reached_classes"]), "| grown beyond own sentences (of %d queries): VGB %d, VG %d, VG_RAND %d" % (len(sizes["grown"]), sum(sizes["grown"]), sum(sizes["grown_VG"]), sum(sizes["grown_VG_RAND"])), "| still growing at the cap:", dict(unst))
    for S in ("DISJOINT", "GROWN_DISJOINT"):
        zc = lambda a, idx=None, S=S: pooled(a, S, idx)[0]; n = int(pooled("A0", S)[1]); print(f"\n--- falsifiers on {S} ({n} gold{'; UNJUDGEABLE, under 30' if n < 30 else ''}) ---")
        for tag, X, Y, why in (("H1", "VGB", "A0", "claims add nothing over the label"), ("H2", "VGB", "T_VG", "structure adds nothing over the same strings"), ("H3", "VGB", "ADJF", "no better than adjacency"), ("H4", "VGB", "VGB_RAND", "the DEF of relevance adds nothing over random edges of the same count"), ("H4b", "VG", "VG_RAND", "the void-gated edges alone add nothing over random edges of the same count"), ("H5", "VGB", "NG", "gating adds nothing over no gate"), ("H7", "VGB", "VG", "bindings add nothing"), ("H9", "VGR", "VGB", "the reached classes add nothing as a nomination")):
            dd = zc(X) - zc(Y); lo, hi = boot(lambda ix: zc(X, ix) - zc(Y, ix)); print(f"{tag} {X} {zc(X):.3f} vs {Y} {zc(Y):.3f}, diff {dd:+.3f} [{lo:+.3f}, {hi:+.3f}] -> {'HIT (' + why + ')' if (dd < 0.05 or lo <= 0) else 'not hit'}")
        t, s_ = zc("VGB"), zc("VGB_swap"); print(f"H6 VGB: true {t:.3f}, target-swap {s_:.3f}, ratio {s_ / t if t else float('nan'):.2f} -> {'HIT (topical, not referent-tied)' if t and s_ >= 0.5 * t else 'not hit'}")
    print(f"H8 precision@10 VGB {pr('VGB'):.3f} vs A0 {pr('A0'):.3f} -> {'HIT (gain bought with junk)' if pr('VGB') < 0.5 * pr('A0') else 'not hit'}")
    print("UNJUDGEABLE strata (< 30 gold):", [s for s in STR if pooled("A0", s)[1] < 30] or "none")
if __name__ == "__main__": main()
