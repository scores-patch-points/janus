"""v2/readlist.py — the record's reading list (V2-PREREG.md part 3): every document whose ground language claim is English, spread over
the reading workers largest first, round robin, so the workers finish together. Order of reading does not matter here: v2/fold.py
puts the documents in reading order.
  HL_OUT=<v2 dir> python -I v2/readlist.py <work dir> <workers>"""
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from common import OUT

if __name__ == "__main__":
    work, n = sys.argv[1], int(sys.argv[2])
    docs = [d for d in json.load(open(os.path.join(OUT, "docs.json"), encoding="utf8")) if d.get("lang") == "en"]
    docs.sort(key=lambda d: (-d["bytes"], d["path"]))
    for k in range(n):
        with open(os.path.join(work, f"list-{k}.tsv"), "w", encoding="utf8") as f:
            for d in docs[k::n]: f.write(f"{d['id']}\t{d['path']}\n")
    print(json.dumps({"english_documents": len(docs), "bytes": sum(d["bytes"] for d in docs), "workers": n}))
