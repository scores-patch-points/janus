"""gap2json.py <gap.tsv> <out.json>: GAP TSV -> JSON rows, literal tab split (QUOTE_NONE), gold label from A-coref/B-coref. Sanity: each row's pronoun, A and B equal the text at their offsets (a data check; the gold is not used for it). No regex."""
import sys, csv, json
csv.field_size_limit(10**9)
rows = list(csv.DictReader(open(sys.argv[1], encoding="utf-8", newline=""), delimiter="\t", quoting=csv.QUOTE_NONE)); out = []; bad = 0
for r in rows:
    t = r["Text"]; p, a, b = int(r["Pronoun-offset"]), int(r["A-offset"]), int(r["B-offset"])
    ok = t[p:p + len(r["Pronoun"])] == r["Pronoun"] and t[a:a + len(r["A"])] == r["A"] and t[b:b + len(r["B"])] == r["B"]; bad += not ok
    gold = "A" if r["A-coref"] == "TRUE" else "B" if r["B-coref"] == "TRUE" else "NEITHER"
    out.append({"id": r["ID"], "text": t, "pronoun": r["Pronoun"], "pOff": p, "A": r["A"], "aOff": a, "B": r["B"], "bOff": b, "gold": gold, "url": r["URL"], "offsets_ok": ok})
json.dump(out, open(sys.argv[2], "w")); print(f"{sys.argv[1]}: {len(out)} rows, offsets disagree with the text on {bad}; gold A {sum(o['gold']=='A' for o in out)} B {sum(o['gold']=='B' for o in out)} NEITHER {sum(o['gold']=='NEITHER' for o in out)}")
