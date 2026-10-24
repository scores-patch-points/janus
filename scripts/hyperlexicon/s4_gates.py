"""S4 (EVA): the integrity gates of HYPERLEXICON-V1-PREREG.md, judged against the bars frozen there. v1 makes no empirical claim.
T1 reopen: 2,000 random postings (byte-offset documents) re-read from the Zenodotus file give the stored type; every sampled file still hashes
   to its doc event's sha256.                                                                                              bar 100%
T2 determinism: for 200 random documents, S0's claims and S1's postings recomputed now are identical to the log's.        bar 100%
T3 exactness: for 200 random types the per-document counts sum to the vocabulary count; for 20 random (type, document) pairs
   the count equals an independent count over the document's own tokens.                                                bar exact
T4 claims: for 300 random documents every frontmatter field (other than *_basis) is a claim event with that value.      bar 100%"""
import sys
import os, json, random, collections, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # run with python3 -I: the script's own folder only
from common import *
import s0_ground, s1_postings

if __name__ == "__main__":
    t0 = time.time(); R = random.Random(1); docs = read_docs(); vtypes, vcounts = read_vocab(); byid = {d["id"]: d for d in docs}
    res = {}
    # T1
    bd = [d for d in docs if d.get("offsets") == "byte" and d.get("tokens")]; ok = tot = 0; bad = []; shaok = True; seen = set()
    for _ in range(2000):
        d = R.choice(bd); a = postings(d); i = R.randrange(len(a)); t, s, n = (int(x) for x in a[i])
        b = open(os.path.join(ZEN, d["path"]), "rb").read()
        if d["id"] not in seen: seen.add(d["id"]); shaok &= sha256_hex(b) == d["sha256"]
        got = b[s:s + n].decode("utf8").lower(); tot += 1
        if got == vtypes[t]: ok += 1
        elif len(bad) < 5: bad.append({"doc": d["path"], "start": s, "got": got, "want": vtypes[t]})
    res["T1"] = {"checked": tot, "ok": ok, "files_sha256_ok": shaok, "examples_bad": bad, "pass": ok == tot and shaok}
    # T2
    s1_postings.VOC = {t: i for i, t in enumerate(vtypes)}; sample = R.sample(docs, min(200, len(docs))); ok_p = ok_c = 0
    stored = collections.defaultdict(set)
    for e in read_events("ground"):
        if e["k"] == "claim" and e["doc"] in {d["id"] for d in sample}: stored[e["doc"]].add(e["id"])
    for d in sample:
        _, claims = s0_ground.ground(d["path"])
        ids = {eid({"k": "claim", "doc": d["id"], **c}) for c in claims}; ok_c += ids <= stored[d["id"]]
        tmp = os.path.join(OUT, "postings", d["id"] + ".npy"); keep = open(tmp, "rb").read()
        try: _, psha, _ = s1_postings.pass2(d)
        finally: open(tmp, "wb").write(keep)
        ok_p += psha == d["postings_sha256"]
    res["T2"] = {"docs": len(sample), "postings_identical": ok_p, "claims_identical": ok_c, "pass": ok_p == len(sample) and ok_c == len(sample)}
    # T3
    z = np.load(os.path.join(OUT, "doccounts.npz")); tot_by_type = np.zeros(len(vtypes), dtype=np.int64); np.add.at(tot_by_type, z["types"], z["counts"].astype(np.int64))
    ts = R.sample(range(len(vtypes)), min(200, len(vtypes))); ok_a = sum(int(tot_by_type[t] == vcounts[t]) for t in ts)
    pairs_ok = 0; pairs = []
    for _ in range(20):
        d = R.choice([x for x in docs if x.get("tokens")]); a = postings(d); t = int(a[R.randrange(len(a)), 0])
        text, body = s1_postings.read(d); indep = sum(1 for m in TOKEN.finditer(text, body) if m.group(0).lower() == vtypes[t])
        k = docs.index(d); lo, hi = z["indptr"][k], z["indptr"][k + 1]
        j = np.nonzero(z["types"][lo:hi] == t)[0]; stored_n = int(z["counts"][lo:hi][j[0]]) if len(j) else 0
        pairs_ok += stored_n == indep; pairs.append((d["path"], vtypes[t], stored_n, indep))
    res["T3"] = {"types_checked": len(ts), "type_totals_exact": ok_a, "pairs_checked": 20, "pairs_exact": pairs_ok, "pass": ok_a == len(ts) and pairs_ok == 20}
    # T4
    claims = collections.defaultdict(set)
    sample = R.sample(docs, min(300, len(docs))); want = {d["id"] for d in sample}
    for e in read_events("ground"):
        if e["k"] == "claim" and e["doc"] in want: claims[e["doc"]].add((e["about"], json.dumps(e["value"], ensure_ascii=False)))
    fields = ok4 = 0; missing = []
    for d in sample:
        b = open(os.path.join(ZEN, d["path"]), "rb").read(); fm, _ = front(b.decode("utf8", "replace"))
        for k, v in fm.items():
            if k.endswith("_basis"): continue
            fields += 1
            if (k, json.dumps(v, ensure_ascii=False)) in claims[d["id"]]: ok4 += 1
            elif len(missing) < 5: missing.append((d["path"], k))
    res["T4"] = {"docs": len(sample), "fields": fields, "as_claims": ok4, "missing": missing, "pass": ok4 == fields}
    res["all_pass"] = all(res[k]["pass"] for k in ("T1", "T2", "T3", "T4")); res["seconds"] = round(time.time() - t0)
    json.dump(res, open(os.path.join(OUT, "gates.json"), "w"), indent=1, ensure_ascii=False); print(json.dumps(res, ensure_ascii=False)[:2000], flush=True)
