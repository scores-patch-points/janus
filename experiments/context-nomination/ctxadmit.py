"""ctxadmit.py <fg.json> <kinds.json> <out.json>   ADDENDUM-3 of PREREG-CLAIM-GRAPH-UNIVERSE: the void's ADMITS, by kind induction (kinds.mjs, khora's own organ over relation profiles).
For a query class q placed in a stable kind K, a candidate is ADMITTED if it is in K, REFUSED if it is placed in another stable kind, UNKNOWN if unplaced (a hole). Ranking by tier (admitted, unknown, refused), then the base arm's order.
A0A = A0 under the tiers; VGA = VG (the void-gated universe) under the tiers; *_SHUF = the same tiers with the kind labels shuffled among the placed classes (kind sizes kept). Every arm is a NOMINATOR; the arms never see the link targets."""
import sys, os, json, random, collections, time
import numpy as np
os.environ["HF_HUB_OFFLINE"] = "1"; os.environ["TOKENIZERS_PARALLELISM"] = "false"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ctxalias as A, ctxfull as F, ctxvoid as V
from ctxalias import strip, gold, order, toks
from ctxnom import check_registry, REF, SEED, K10
ARM_SPECS = {
 "A0":   dict(role="baseline", referent="none: the bare anchor string", evidence="the embedder's prior (a given from its training, a nominator)", twin=None, cut="none"),
 "A0A":  dict(role="context", referent="the bare anchor under the void's admits: candidates tiered by induced kind (admitted, unknown, refused)", evidence="induced kinds from khora's relation-profile organ", twin="A0A_SHUF", cut="admission: a stable induced kind, or a typed gap"),
 "VGA":  dict(role="context", referent="the void-gated universe under the void's admits", evidence="the void's edges; induced kinds", twin="VGA_SHUF", cut="relevance exhaustion and admission"),
 "A0A_SHUF": dict(role="twin", referent="the same tiers with the kind labels shuffled among the placed classes", evidence="strings only (random kinds of the same sizes)", twin=None, cut="same as A0A"),
 "VGA_SHUF": dict(role="twin", referent="the same tiers with the kind labels shuffled among the placed classes", evidence="strings only (random kinds of the same sizes)", twin=None, cut="same as VGA"),
 "VG":   dict(role="control", referent="the void-gated universe (ADDENDUM-2)", evidence="the reader's dependency edges admitted by the void's relation", twin=None, cut="relevance exhaustion"),
 "T_VG": dict(role="control", referent="hop-0 sentences plus random sentences to the size VGB reached", evidence="strings only", twin=None, cut="size copied"),
 "ADJF": dict(role="control", referent="adjacency universe", evidence="sentences kept as units", twin=None, cut="top-10 stability"),
 "PROX": dict(role="control", referent="locality alone", evidence="document order", twin=None, cut="none"),
}
def tiered(scores, q, kindOf, exclude=()):
    """rank every candidate by tier then base score; tier 0 admitted, 1 unknown, 2 refused; q unplaced -> one tier (the admits is a typed gap)"""
    kq = kindOf[q]; tier = lambda c: 1 if kq is None or kindOf[c] is None else (0 if kindOf[c] == kq else 2)
    idx = [i for i in range(len(scores)) if i != q and i not in exclude]
    return [int(i) for i in sorted(idx, key=lambda i: (tier(i), -scores[i], i))[:K10]]
def shuffled_kinds(kindOf, rng):
    placed = [i for i, k in enumerate(kindOf) if k is not None]; labs = [kindOf[i] for i in placed]; rng.shuffle(labs); out = list(kindOf)
    for i, l in zip(placed, labs): out[i] = l
    return out
def main():
    fgf, kf, outf = sys.argv[1], sys.argv[2], sys.argv[3]
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(os.path.join(REF, "models", "all-MiniLM-L6-v2"), device="cpu")
    enc = lambda xs: model.encode(list(xs), normalize_embeddings=True, batch_size=64, show_progress_bar=False)
    arb = check_registry(ARM_SPECS); print("REFERENT-FIRST: arms resting on an ARBITRARY CONSTANT:", ", ".join(arb) or "none"); import eot_law; print(eot_law.report_line()); print("twins: " + ", ".join(f"{a}<->{sp['twin']}" for a, sp in ARM_SPECS.items() if sp["role"] == "context"))
    R = json.load(open(fgf)); K = {k["file"]: k for k in json.load(open(kf))}; per = []; st = collections.Counter(); t0 = time.time()
    for di, full in enumerate(R):
        d = json.load(open(full["file"])); t = d["text"]; sents = [t[s["c0"]:s["c1"]] for s in d["sentences"]]; G = gold(full); rec0 = strip(full); C = rec0["classes"]
        if not G: per.append(None); continue
        kindOf = K[full["file"]]["kindOf"]; E = enc(sents); S11 = E @ E.T; EA = enc([c["anchor"] for c in C]); rng = random.Random(SEED + di)
        shell = {"classes": C, "anaphors": [], "clauses": []}; U = A.Universe(shell, S11, []); T = rec0["tokens"]; kids = V.kids_of(T); okmask = [V.bears(T, i, kids) for i in range(len(T))]
        gV, sV = V.build(rec0, pick=lambda i: okmask[i]); qs = sorted(G); rec = {}; prec = {}
        st["classes"] += len(C); st["placed"] += sum(1 for k in kindOf if k is not None); st["docs"] += 1
        def tally(arm, q, top):
            for gj in G[q]:
                dj = not (toks(C[q]["anchor"]) & toks(C[gj]["anchor"]))
                for s in ["ALIAS", "DISJOINT" if dj else "SHARED"]: rec.setdefault(arm, {}).setdefault(s, [0, 0]); rec[arm][s][1] += 1; rec[arm][s][0] += 1 if gj in top else 0
            p = prec.setdefault(arm, [0, 0]); p[0] += len(set(top) & set(G[q])); p[1] += len(top)
        for q in qs:
            sh = shuffled_kinds(kindOf, random.Random(SEED + 1000 * di + q)); base = EA @ EA[q]
            PV, _, _ = V.reach(rec0, gV, sV, q)
            M = S11[:, PV].copy()
            for c, pi in enumerate(PV): M[pi, c] = -9.0
            best = M.max(axis=1); vgs = np.array([max(best[x] for x in c["sents"]) for c in C])
            seeds = sorted(set(C[q]["sents"])); dist = np.min(np.abs(np.arange(len(sents))[:, None] - np.array(seeds)[None, :]), axis=1)
            ta = [(U.rank([i for i in range(len(sents)) if dist[i] <= hh], q), int((dist <= hh).sum())) for hh in range(F.HMAXF + 1)]
            pool = [i for i in range(len(sents)) if i not in set(seeds)]; Pt = seeds + rng.sample(pool, min(len(pool), max(0, len(PV) - len(seeds))))
            top = {"A0": order(base, {q}), "A0A": tiered(base, q, kindOf), "A0A_SHUF": tiered(base, q, sh), "VG": U.rank(PV, q), "VGA": tiered(vgs, q, kindOf), "VGA_SHUF": tiered(vgs, q, sh), "T_VG": U.rank(Pt, q), "ADJF": F.stop(ta, 0.8)[0], "PROX": order(np.array([-min(dist[x] for x in c["sents"]) for c in C]), {q})}
            for a, tp in top.items(): tally(a, q, tp)
            kq = kindOf[q]; st["queries"] += 1; st["q_placed"] += kq is not None
            for gj in G[q]:
                st["gold_pairs"] += 1
                if kq is not None: st["gold_q_placed"] += 1
                if kq is not None and kindOf[gj] is not None: st["gold_both_placed"] += 1; st["gold_same_kind"] += kindOf[gj] == kq; st["gold_refused"] += kindOf[gj] != kq
        per.append({"title": d["title"], "rec": rec, "prec": prec})
    json.dump({"per": per, "stats": dict(st)}, open(outf, "w")); report(per, st)
def report(per, st):
    per = [p for p in per if p]; rng = np.random.default_rng(SEED)
    def pooled(arm, s, idx=None):
        h = g = 0.0
        for i in (range(len(per)) if idx is None else idx):
            v = per[i]["rec"].get(arm, {}).get(s)
            if v: h += v[0]; g += v[1]
        return (h / g if g else float("nan")), g
    def boot(fn, B=2000):
        out = [fn(rng.integers(0, len(per), len(per))) for _ in range(B)]; return float(np.nanpercentile(out, 2.5)), float(np.nanpercentile(out, 97.5))
    STR = ["ALIAS", "DISJOINT", "SHARED"]; print(f"\n=== DOC-ALIAS (admits) recall@10 pooled over {len(per)} documents (gold: " + ", ".join(f"{s} {int(pooled('A0', s)[1])}" for s in STR) + ")"); print("arm".ljust(10) + "".join(s.rjust(11) for s in STR) + "   prec@10")
    pr = lambda a: sum(p["prec"].get(a, [0, 0])[0] for p in per) / max(1, sum(p["prec"].get(a, [0, 0])[1] for p in per))
    for a in ["A0", "A0A", "A0A_SHUF", "VG", "VGA", "VGA_SHUF", "T_VG", "ADJF", "PROX"]: print(a.ljust(10) + "".join(f"{pooled(a, s)[0]:11.3f}" for s in STR) + f"   {pr(a):.3f}")
    print(f"COVERAGE: classes placed in a stable kind {st['placed']} of {st['classes']} ({100 * st['placed'] / max(1, st['classes']):.1f}%); queries whose q is placed {st['q_placed']} of {st['queries']}; gold pairs with q placed {st['gold_q_placed']} of {st['gold_pairs']}; both placed {st['gold_both_placed']}, same kind {st['gold_same_kind']}, REFUSED {st['gold_refused']}")
    zc = lambda a, idx=None: pooled(a, "DISJOINT", idx)[0]; print("\n--- falsifiers on DISJOINT ---")
    for tag, X, Y, why in (("K1", "A0A", "A0", "admits adds nothing over the label"), ("K2", "A0A", "A0A_SHUF", "the induced kinds add nothing over random kinds"), ("K3", "VGA", "VG", "admits adds nothing to the void-gated universe")):
        dd = zc(X) - zc(Y); lo, hi = boot(lambda ix: zc(X, ix) - zc(Y, ix)); print(f"{tag} {X} {zc(X):.3f} vs {Y} {zc(Y):.3f}, diff {dd:+.3f} [{lo:+.3f}, {hi:+.3f}] -> {'HIT (' + why + ')' if (dd < 0.05 or lo <= 0) else 'not hit'}")
    r = st["gold_refused"] / max(1, st["gold_both_placed"]); print(f"K4 of the gold pairs with both classes placed, REFUSED {st['gold_refused']} of {st['gold_both_placed']} ({r:.2f}) -> {'HIT (the gate refuses true aliases)' if r >= 0.2 else 'not hit'}")
if __name__ == "__main__": main()
