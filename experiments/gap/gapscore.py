"""gapscore.py <rows-run.json> [--label DEV|DEV-2|FRESH]   PREREG-GAP-PRONOUN-EOT: baselines, metrics, strata and falsifiers GP1 to GP6 from the decisions gaprun.mjs wrote. No arm reads the gold; the gold is used only here, to score.
Arms: EOT_J, EOT_P, ROWS_P, SHUF (gaprun.mjs); NEAR, FIRST, RAND (surface baselines, always commit). Output A, B, NEITHER or HELD (HELD = no commit)."""
import sys, json, random, collections
import numpy as np
SEED = 20261119
ARMS = {"EOT_J": "EOT", "EOT_P": "EOT", "ROWS_P": "GRAMMAR", "SHUF": "EOT", "NEAR": "SURFACE", "FIRST": "SURFACE", "RAND": "SURFACE"}
TWIN = {"EOT_P": "SHUF"}     # the strings-only twin of the headline arm (REFERENT-FIRST rule 3)
def baselines(rows):
    rng = random.Random(SEED)
    for r in rows:
        a, b, p = r["aOff"], r["bOff"], r["pOff"]
        r["NEAR"] = "A" if abs(p - a) <= abs(p - b) else "B"; r["FIRST"] = "A" if a <= b else "B"; r["RAND"] = rng.choice(["A", "B"])
    return rows
def commit(v): return v != "HELD"
def stats(rows, arm):
    c = [r for r in rows if commit(r[arm])]; ok = sum(1 for r in c if r[arm] == r["gold"]); n = len(rows)
    return {"n": n, "commits": len(c), "coverage": len(c) / n if n else float("nan"), "precision": ok / len(c) if c else float("nan"), "net": (ok - (len(c) - ok)) / n if n else float("nan"), "wrong_rate": (len(c) - ok) / n if n else float("nan")}
def boot_diff(rows, f, B=2000):
    """document-level bootstrap by URL: f(rows) -> number; returns (value, lo, hi)"""
    by = collections.defaultdict(list)
    for r in rows: by[r["url"]].append(r)
    urls = sorted(by); rng = np.random.default_rng(SEED); vals = []
    for _ in range(B):
        pick = rng.integers(0, len(urls), len(urls)); vals.append(f([r for i in pick for r in by[urls[i]]]))
    return f(rows), float(np.nanpercentile(vals, 2.5)), float(np.nanpercentile(vals, 97.5))
def main():
    d = json.load(open(sys.argv[1])); label = sys.argv[sys.argv.index("--label") + 1] if "--label" in sys.argv else "UNLABELLED"
    rows = baselines(d["rows"]); print(f"=== GAP pronoun binding, {len(rows)} rows, label {label}; swap-invariance violations {d['swapViolations']}; rows with no pronoun node {d['noPronounNode']}")
    import eot_law_gap as L; L.check(ARMS)
    print("arm".ljust(8) + "level".ljust(9) + "coverage".rjust(10) + "precision".rjust(11) + "net".rjust(9) + "wrong/rows".rjust(12))
    for a in ARMS: s = stats(rows, a); print(a.ljust(8) + ARMS[a].ljust(9) + f"{s['coverage']:10.3f}{s['precision']:11.3f}{s['net']:9.3f}{s['wrong_rate']:12.3f}")
    print("\nEOT_P strata (judged only with >= 30 rows):")
    strata = {"gold A": lambda r: r["gold"] == "A", "gold B": lambda r: r["gold"] == "B", "gold NEITHER": lambda r: r["gold"] == "NEITHER", "SEPARABLE": lambda r: r["separable"], "NOT-SEPARABLE": lambda r: not r["separable"], "same sentence": lambda r: r.get("sameSent") is True, "later sentence": lambda r: r.get("sameSent") is False, "pronoun Masc": lambda r: r.get("pgender") == "Masc", "pronoun Fem": lambda r: r.get("pgender") == "Fem"}
    for k, f in strata.items():
        sub = [r for r in rows if f(r)]; s = stats(sub, "EOT_P"); print(f"  {k.ljust(15)} rows {len(sub):5d}{'' if len(sub) >= 30 else ' (UNJUDGEABLE)'}  commits {s['commits']:4d}  coverage {s['coverage']:.3f}  precision {s['precision']:.3f}  net {s['net']:+.3f}")
    print("\nfalsifiers (bootstrap by URL, 2000 resamples):")
    com = [r for r in rows if commit(r["EOT_P"])]
    prec_gap = lambda rs: (lambda c: (sum(1 for r in c if r["EOT_P"] == r["gold"]) - sum(1 for r in c if r["RAND"] == r["gold"])) / len(c) if c else float("nan"))([r for r in rs if commit(r["EOT_P"])])
    v, lo, hi = boot_diff(rows, prec_gap); print(f"GP1 EOT_P precision minus RAND precision on EOT_P's committed rows (n={len(com)}): {v:+.3f} [{lo:+.3f}, {hi:+.3f}] -> {'HIT (the rules add nothing over a coin where they commit)' if (v < 0.10 or lo <= 0) else 'not hit'}")
    cov = stats(rows, "EOT_P")["coverage"]; print(f"GP2 EOT_P coverage {cov:.3f} -> {'HIT (the structure almost never decides)' if cov < 0.05 else 'not hit'}")
    for tag, other, why in (("GP3", "ROWS_P", "EOT adds nothing over the reader's rows (the owner's hypothesis is NOT supported on this task)"), ("GP4", "SHUF", "the structure adds nothing over the same strings")):
        f = lambda rs, o=other: stats(rs, "EOT_P")["net"] - stats(rs, o)["net"]; v, lo, hi = boot_diff(rows, f); need = 0.02 if tag == "GP3" else 0.0
        print(f"{tag} net(EOT_P) minus net({other}): {v:+.3f} [{lo:+.3f}, {hi:+.3f}] -> {'HIT (' + why + ')' if (v <= need or lo <= 0) else 'not hit'}")
    e, nr = stats(rows, "EOT_P"), stats(rows, "NEAR"); hit5 = e["wrong_rate"] >= nr["wrong_rate"] and nr["precision"] > e["precision"]
    print(f"GP5 wrong-commit rate EOT_P {e['wrong_rate']:.3f} vs NEAR {nr['wrong_rate']:.3f}; precision EOT_P {e['precision']:.3f} vs NEAR {nr['precision']:.3f} -> {'HIT (less accurate and not safer than a distance heuristic)' if hit5 else 'not hit'}")
    dis = [r for r in rows if r["EOT_P"] != r["ROWS_P"]]; rate = len(dis) / len(rows)
    print(f"GP6 EOT_P and Penelope's organ over the reader's rows decide differently on {len(dis)} of {len(rows)} rows ({rate:.3f}) -> {'HIT (the EOT mirror and the organ differ: every difference is a finding about the representation or the mirror)' if rate > 0.05 else 'not hit'}")
    pairs = collections.Counter((r["EOT_P"], r["ROWS_P"]) for r in dis); print("   disagreements (EOT_P, ROWS_P): " + ", ".join(f"{a}/{b} x{n}" for (a, b), n in pairs.most_common(8)))
    print(f"   EOT_J (cube agreement only) coverage {stats(rows, 'EOT_J')['coverage']:.3f}, precision {stats(rows, 'EOT_J')['precision']:.3f}")
if __name__ == "__main__": main()
