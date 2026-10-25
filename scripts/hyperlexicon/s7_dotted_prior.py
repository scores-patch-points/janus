"""S7: Rule H (DOTTED-PREREG.md) over S6's counts -> a dotted-words prior for one language, DottedWords@1 as janus priors/ carries.
A type of letters only, at most 11 letters (12 characters with its period, as Wiktionary's list was cut), is a dotted word when the
corpus writes it with its period in most of its uses beyond chance: a one-sided exact binomial test of d/n > 1/2 at alpha 0.01.
  python3 -I s7_dotted_prior.py <lang> <stem> <out.json> [--rule H|H2]      (HL_OUT as for the build)
Rule H2 (DOTTED-PREREG-2.md) adds C2: what follows the word's period (s = upper-case letter or end of line, of d) looks like a sentence
start less often than what follows the corpus's own periods (p0 = sum s / sum d over the language's letters-only rows, measured):
a one-sided exact binomial test of s/d < p0 at alpha 0.01."""
import sys
import os, json, gzip, math, re, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import OUT

ALPHA = 0.01                      # declared in DOTTED-PREREG.md, not tuned
LETTERS = re.compile(r"^[^\W\d_]{1,11}$")


def upper_tail(d, n):
    """P(X >= d) for X ~ Binomial(n, 1/2), exactly: summed from d up while the terms still count."""
    if d <= n / 2: return 1.0
    lg = math.lgamma(n + 1) - n * math.log(2)
    total, k = 0.0, d
    while k <= n:
        term = math.exp(lg - math.lgamma(k + 1) - math.lgamma(n - k + 1))
        total += term
        if term < total * 1e-17: break
        k += 1
    return min(1.0, total)


def lower_tail(s, d, p):
    """P(X <= s) for X ~ Binomial(d, p), exactly: summed from s down while the terms still count."""
    if d <= 0 or s >= d * p: return 1.0
    lg = math.lgamma(d + 1); lp, lq = math.log(p), math.log1p(-p)
    total, k = 0.0, s
    while k >= 0:
        term = math.exp(lg - math.lgamma(k + 1) - math.lgamma(d - k + 1) + k * lp + (d - k) * lq)
        total += term
        if term < total * 1e-17: break
        k -= 1
    return min(1.0, total)


def main():
    lang, stem, out = sys.argv[1], sys.argv[2], sys.argv[3]
    rule = sys.argv[sys.argv.index("--rule") + 1] if "--rule" in sys.argv else "H"
    use = os.environ.get("HL_USE", os.path.join(OUT, "use")); man = json.load(open(os.path.join(use, "dotted.manifest.json")))
    words, near, rows = [], [], 0
    def read_rows():
        with gzip.open(os.path.join(use, "dotted.tsv.gz"), "rt", encoding="utf8") as f:
            cols = f.readline().rstrip("\n").split("\t")
            for line in f:
                r = dict(zip(cols, line.rstrip("\n").split("\t")))
                if r["lang"] == lang and LETTERS.match(r["surface"]): yield r
    # p0: the pooled profile of the corpus's own periods in this language — what follows them looks like a sentence start this often
    S = D = 0
    for r in read_rows(): S += int(r["upper"]) + int(r["end"]); D += int(r["d"])
    p0 = S / D if D else None
    rejected_c2 = []
    for r in read_rows():
        rows += 1
        n, d = int(r["n"]), int(r["d"])
        if n <= 0: continue
        p = upper_tail(d, n)
        s_ = int(r["upper"]) + int(r["end"])
        row = {"w": r["surface"] + ".", "n": n, "d": d, "s": s_, "after": {k: int(r[k]) for k in ("lower", "upper", "digit", "mark", "end")}}
        if p < ALPHA:
            if rule == "H2":
                q = lower_tail(s_, d, p0)
                if q < ALPHA: words.append({**row, "c2p": q})
                else: rejected_c2.append({**row, "c2p": q})      # most uses dotted, but followed like a sentence end: not kept
            else: words.append(row)
        elif d / n > 0.5: near.append({**row, "p": p})          # most uses dotted, but too few to pass the test: shown, not kept
    rejected_c2.sort(key=lambda x: (-x["n"], x["w"]))
    words.sort(key=lambda x: (-x["n"], x["w"])); near.sort(key=lambda x: (-x["n"], x["w"]))
    me = hashlib.sha256(open(os.path.abspath(__file__), "rb").read()).hexdigest()
    prior = {
        "schema": "DottedWords@1", "lang": lang, "stem": stem,
        "giver": {"name": "janus hyperlexicon v1", "head": man["compiled_from_head"], "stage": "s6 dotted share + s7 rule H",
                  "s6_sha256": man["script_sha256"], "s7_sha256": me, "documents": man["documents_read"], "tokens": man["tokens"],
                  "licence": "the corpus documents' own; the counts are janus's"},
        "rule": ("a type of letters only (at most 11) that the corpus writes with a period straight after in most of its uses in this "
                 "language, by a one-sided exact binomial test of d/n > 1/2 at alpha 0.01 (scripts/hyperlexicon/DOTTED-PREREG.md)")
                if rule == "H" else
                ("C1: written with a period straight after in most of its uses (one-sided exact binomial, d/n > 1/2, alpha 0.01) AND C2: "
                 "what follows the period (upper-case letter or end of line) looks like a sentence start less often than the corpus's own "
                 "periods do (one-sided exact binomial, s/d < p0, alpha 0.01; p0 measured over this language's letters-only rows) — "
                 "scripts/hyperlexicon/DOTTED-PREREG-2.md"),
        "ruleName": rule, "alpha": ALPHA, "p0": p0, "rows_read": rows, "n": len(words),
        "words": [w["w"] for w in words],
        "evidence": words,
        "nearMisses": near[:200],
        **({"rejectedByC2": rejected_c2[:300], "rejectedByC2Count": len(rejected_c2)} if rule == "H2" else {}),
    }
    json.dump(prior, open(out, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print(json.dumps({"lang": lang, "rule": rule, "p0": p0, "rows": rows, "kept": len(words), "near": len(near), "rejectedByC2": len(rejected_c2), "top": [w["w"] for w in words[:40]], "rejectedTop": [w["w"] for w in rejected_c2[:25]]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
