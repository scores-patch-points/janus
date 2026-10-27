"""Fold test: fold capitalized Russian forms by the measured ending inventory (priors/endings-rus-hl.json). Needs numpy only via the importers."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
import re,json,collections,sys
inv=json.load(open(os.path.join(HERE, "..", "..", "priors", "endings-rus-hl.json")))["rules"]
rules=[(r["lemmaEnd"],r["formEnd"]) for r in inv if r["pos"] in ("noun","name") and r["lemmas"]>=100]
print("rules used",len(rules))
def fold(path):
    t=open(path,encoding="utf8").read(); cnt=collections.Counter(re.findall(r"[Ѐ-ӿ]+",t))
    stop={w for w in cnt if w[0].isupper() and w.lower() in cnt and cnt[w.lower()]>cnt[w]}   # capitalized only at sentence start
    caps=[w for w in cnt if w[0].isupper() and len(w)>2 and w not in stop]
    parent={}
    def find(x):
        while parent.get(x,x)!=x: x=parent[x]
        return x
    for w in caps:
        for le,fe in rules:
            if fe and w.endswith(fe) and len(w)-len(fe)>=3:
                lem=w[:len(w)-len(fe)]+le
                if lem!=w and lem in cnt and lem[0].isupper(): parent[find(w)]=find(lem)
    g=collections.defaultdict(list)
    for w in caps: g[find(w)].append((w,cnt[w]))
    return caps,g
for path in ["/Users/mlacy/Downloads/workspace/Zenodotus/11-multi-language/war-and-peace/ru/voyna-i-mir_Tolstoy_wikisource.txt","/Users/mlacy/Downloads/workspace/Zenodotus/11-multi-language/war-and-peace/aligned/ru/voyna-i-mir-ch1-3-aligned.txt"]:
    caps,g=fold(path); multi={k:v for k,v in g.items() if len(v)>1}
    print(path.split("/")[-1],"capitalized types",len(caps),"groups",len(g),"merged groups",len(multi),"types merged",sum(len(v) for v in multi.values()))
    for k,v in sorted(multi.items(),key=lambda kv:-sum(c for _,c in kv[1]))[:14]: print("  ",sorted(v,key=lambda x:-x[1]))
    find=lambda w:[k for k,v in g.items() if any(x==w for x,_ in v)]
    for a,b in [("Николай","Николаевич"),("Пьер","Пьера"),("Пьер","Пьеру"),("Андрей","Андрея")]:
        ga,gb=find(a),find(b); print("  ",a,b,"present" if ga and gb else "absent","same" if ga and ga==gb else ("different" if ga and gb else "-"))
