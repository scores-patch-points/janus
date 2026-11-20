"""libscore.py <run.json> [--label DEV|FRESH] [--primary LinES,ParTUT]   PREREG-PARSE-LIBRARIES: tables, falsifiers L1 to L3, the L2 agreement rates. Gold is used only to score."""
import sys, json, collections
import numpy as np
SEED = 20261119
def main():
    d = json.load(open(sys.argv[1])); label = sys.argv[sys.argv.index("--label") + 1] if "--label" in sys.argv else "UNLABELLED"; prim = (sys.argv[sys.argv.index("--primary") + 1].split(",") if "--primary" in sys.argv else [])
    S = d["sentences"]; sets = d["sets"]; by = {c: collections.defaultdict(list) for c in sets}
    for s in S: by[s["corpus"]][s["doc"]].append(s)
    ARMS = ["POOL", "BLEND", "EWT", "GUM", "STANZA", "ENS_LIB"]
    def agg(c, arm, docs=None):
        u = a = l = n = nn = 0
        for doc in (docs if docs is not None else by[c]):
            for s in by[c][doc]: x = s["arms"][arm]; u += x["u"]; a += x["a"]; l += x["l"]; n += x["n"]; nn += x["nnp"]
        return 100 * u / n, 100 * a / nn, 100 * l / nn
    print(f"=== parsing libraries, label {label}: " + ", ".join(f"{c} {sum(len(v) for v in by[c].values())} sentences in {len(by[c])} clusters" for c in sets))
    print("arm".ljust(9) + "".join(f"{c} UPOS  UAS   LAS".rjust(24) for c in sets))
    for a in ARMS: print(a.ljust(9) + "".join("".join(f"{x:8.1f}" for x in agg(c, a)).rjust(24) for c in sets))
    rng = np.random.default_rng(SEED)
    def boot(c, f, B=2000):
        docs = sorted(by[c]); v = []
        for _ in range(B): pick = rng.integers(0, len(docs), len(docs)); v.append(f([docs[i] for i in pick]))
        return f(docs), float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5))
    def diff(c, X, Y): return boot(c, lambda docs: agg(c, X, docs)[2] - agg(c, Y, docs)[2])
    def l2(c, docs=None):
        t = [0, 0, 0, 0]
        for doc in (docs if docs is not None else by[c]):
            for s in by[c][doc]: x = s["l2"]; t[0] += x["agreeN"]; t[1] += x["agreeWrong"]; t[2] += x["disN"]; t[3] += x["disWrong"]
        return t
    print("\nfalsifiers on the FRESH sets" + (f" ({', '.join(prim)})" if prim else "") + " (LAS points; a hit unless the interval is above 0 and the size is at least 0.5):")
    prim = prim or sets; hits = {"L1": [], "L3": []}
    for c in prim:
        v, lo, hi = diff(c, "STANZA", "POOL"); h = v < 0.5 or lo <= 0; hits["L1"].append(h); print(f"L1 {c}: STANZA minus POOL {v:+.2f} [{lo:+.2f}, {hi:+.2f}] -> {'HIT' if h else 'not hit'}")
        best = "STANZA" if agg(c, "STANZA")[2] >= agg(c, "POOL")[2] else "POOL"; v, lo, hi = diff(c, "ENS_LIB", best); h = v < 0.5 or lo <= 0; hits["L3"].append(h); print(f"L3 {c}: ENS_LIB minus the better of POOL and STANZA ({best}) {v:+.2f} [{lo:+.2f}, {hi:+.2f}] -> {'HIT' if h else 'not hit'}")
    print("L1 overall:", "HIT (the library adds nothing on at least one fresh set)" if any(hits["L1"]) else "not hit", "| L3 overall:", "HIT (layering adds nothing on at least one fresh set)" if any(hits["L3"]) else "not hit")
    tot = [0, 0, 0, 0]
    for c in prim: t = l2(c); tot = [x + y for x, y in zip(tot, t)]
    ra, rd = tot[1] / max(1, tot[0]), tot[3] / max(1, tot[2]); ratio = rd / ra if ra else float("inf")
    print(f"L2 over {', '.join(prim)}: POOL error rate where STANZA AGREES {100 * ra:.1f}% (of {tot[0]} tokens), where it DISAGREES {100 * rd:.1f}% (of {tot[2]}); ratio {ratio:.2f} -> {'HIT (a disagreement carries little signal about our errors)' if ratio < 2 else 'not hit'}  [2 is an arbitrary constant of ours, labelled]")
    print("\nsentences where POOL and STANZA disagree most:"); [print(f"  [{x['corpus']}] {x['disN']} of {x['n']} tokens: {x['forms'][:110]}") for x in d["disagreeTop"][:6]]
if __name__ == "__main__": main()
