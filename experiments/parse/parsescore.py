"""parsescore.py <run.json> [--label DEV|TEST]   PREREG-PARSE-ENGLISH-LAYERS: pooled UPOS/UAS/LAS per arm and corpus, document bootstrap, falsifiers P1 to P6, the macro LAS. Gold is used only to score."""
import sys, json, collections
import numpy as np
SEED = 20261119; PRIMARY = ["EWT", "GUM", "POOL", "BLEND", "BLEND_PERM", "ENS_MBR", "VARIETY_ORACLE"]; SWEEP = ["BLEND_W25", "BLEND_W75"]; REFS = ["REF_EWT_PRIOR", "REF_GUM_PRIOR"]
def main():
    d = json.load(open(sys.argv[1])); label = sys.argv[sys.argv.index("--label") + 1] if "--label" in sys.argv else "UNLABELLED"; S = d["sentences"]
    arms = [a for a in PRIMARY + SWEEP + REFS if a in S[0]["arms"]]; corp = ["EWT", "GUM"]
    byc = {c: collections.defaultdict(list) for c in corp}
    for s in S: byc[s["corpus"]][s["doc"]].append(s)
    def agg(c, arm, docs=None):
        u = a = l = n = nn = 0
        for doc in (docs if docs is not None else byc[c]):
            for s in byc[c][doc]: x = s["arms"][arm]; u += x["u"]; a += x["a"]; l += x["l"]; n += x["n"]; nn += x["nnp"]
        return 100 * u / n, 100 * a / nn, 100 * l / nn
    print(f"=== parsing English, label {label}, set {d['set']}: " + ", ".join(f"{c} {sum(len(v) for v in byc[c].values())} sentences in {len(byc[c])} documents" for c in corp))
    print("arm".ljust(16) + "".join(f"{c} UPOS   UAS    LAS   ".rjust(26) for c in corp) + "  macro LAS")
    for a in arms:
        r = {c: agg(c, a) for c in corp}; print(a.ljust(16) + "".join(f"{r[c][0]:11.1f}{r[c][1]:7.1f}{r[c][2]:7.1f}   " for c in corp) + f"{(r['EWT'][2] + r['GUM'][2]) / 2:9.2f}")
    rng = np.random.default_rng(SEED)
    def boot(c, f, B=2000):
        docs = sorted(byc[c]); vals = []
        for _ in range(B): pick = rng.integers(0, len(docs), len(docs)); vals.append(f([docs[i] for i in pick]))
        return f(docs), float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))
    las = lambda c, a: (lambda docs: agg(c, a, docs)[2])
    def diff(c, X, Y, Yb=None):
        f = (lambda docs: agg(c, X, docs)[2] - (agg(c, Y, docs)[2] if Yb is None else (agg(c, Y, docs)[2] + agg(c, Yb, docs)[2]) / 2)); return boot(c, f)
    ind = {"EWT": "EWT", "GUM": "GUM"}; out = {"EWT": "GUM", "GUM": "EWT"}
    print("\nfalsifiers (LAS points; document bootstrap, 2000 resamples; a hit unless the interval is above 0 and the size is at least 0.5):")
    def say(tag, c, v, lo, hi, why, need=0.5, flip=False):
        hit = (v <= need or lo <= 0) if not flip else (v < -need or hi >= 0); print(f"{tag} {c}: {v:+.2f} [{lo:+.2f}, {hi:+.2f}] -> {'HIT (' + why + ')' if hit else 'not hit'}")
    for c in corp:
        v, lo, hi = diff(c, "POOL", ind[c]); say("P1 POOL minus the in-domain single", c, v, lo, hi, "pooling adds nothing at home")
        v, lo, hi = diff(c, "POOL", out[c]); say("P2 POOL minus the out-of-domain single", c, v, lo, hi, "pooling does not fix the mismatch")
        v, lo, hi = diff(c, "BLEND", "EWT", "GUM"); say("P3 BLEND minus the mean of the two singles", c, v, lo, hi, "a blend with no context is not better than picking a source at random")
        v, lo, hi = diff(c, "BLEND", "BLEND_PERM"); say("P4 BLEND minus BLEND_PERM", c, v, lo, hi, "the association between feature and weight is decoration")
        v, lo, hi = diff(c, "BLEND", ind[c]); hit = lo <= -0.5 and v < -0.5; print(f"P5 BLEND minus the in-domain single {c}: {v:+.2f} [{lo:+.2f}, {hi:+.2f}] -> {'HIT (the blend costs at home)' if (v < -0.5 and hi < 0) else 'not hit'}")
        best = "EWT" if agg(c, "EWT")[2] >= agg(c, "GUM")[2] else "GUM"; v, lo, hi = diff(c, "ENS_MBR", best); say(f"P6 ENS_MBR minus the best single ({best})", c, v, lo, hi, "the ensemble adds nothing")
    print("\nreported (no falsifier): VARIETY_ORACLE vs POOL and vs BLEND, per corpus:")
    for c in corp:
        for Y in ("POOL", "BLEND"): v, lo, hi = diff(c, "VARIETY_ORACLE", Y); print(f"  {c}: VARIETY_ORACLE minus {Y}: {v:+.2f} [{lo:+.2f}, {hi:+.2f}]")
if __name__ == "__main__": main()
