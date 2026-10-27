"""Gloss measure: giver translations vs aligned-English window correlation for the fold groups (chapters I to III). Run: python3 -I needs numpy; see parallel_names.py."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
import re, json, collections, unicodedata, math
import numpy as np
exec(open(os.path.join(HERE, "fold_test.py")).read().split("for path in")[0])        # fold(path) -> caps, groups
A="/Users/mlacy/Downloads/workspace/Zenodotus/11-multi-language/war-and-peace/aligned/"
caps,g=fold(A+"ru/voyna-i-mir-ch1-3-aligned.txt")
groups=[sorted(v,key=lambda x:-x[1]) for v in g.values()]
ru=open(A+"ru/voyna-i-mir-ch1-3-aligned.txt",encoding="utf8").read(); en=open(A+"en/pg2600-ch1-3-aligned.txt",encoding="utf8").read()
# --- giver side: translation links into a ru lemma node ---
D="/Users/mlacy/hyperlexicon/v2/"; m=json.load(open(D+"manifest.json")); langs,kinds=m["langs"],m["kinds"]
def tbl(p): return np.fromfile(D+p+".off","<u8"), open(D+p+".bin","rb").read()
so,sb=tbl("names.surface"); grp=np.fromfile(D+"names.grp","<u4"); nn=np.fromfile(D+"names.node","<u4"); nl=np.fromfile(D+"names.lang","<u2"); nk=np.fromfile(D+"names.kind","u1")
lf=np.fromfile(D+"link.from","<u4"); lt=np.fromfile(D+"link.to","<u4"); lk=np.fromfile(D+"link.kind","u1"); ll=np.fromfile(D+"link.lang","<u2")
ids=np.fromfile(D+"nodes.id","<u8")
surf_of_row=np.repeat(np.arange(len(grp)-1),np.diff(grp))
S=lambda i: sb[so[i]:so[i+1]].decode("utf8")
en_i,ru_i,lem=langs.index("en"),langs.index("ru"),kinds.index("lemma")
def ru_lemma_nodes(word):
    out=set()
    for cand in (word,word.lower()):
        key=cand.encode()
        lo,hi=0,len(so)-1
        while lo<hi:
            mid=(lo+hi)//2
            if sb[so[mid]:so[mid+1]]<key: lo=mid+1
            else: hi=mid
        if lo<len(so)-1 and sb[so[lo]:so[lo+1]]==key:
            for r in range(grp[lo],grp[lo+1]):
                if nl[r]==ru_i and nk[r]==lem: out.add(int(nn[r]))
    return out
order=np.argsort(lt,kind="stable"); lts=lt[order]
rows_by_node=None
def en_names_of(nodeidx):
    global rows_by_node
    if rows_by_node is None:
        sel=np.nonzero((nl==en_i)&(nk==lem))[0]; rows_by_node=collections.defaultdict(list)
        for r in sel: rows_by_node[int(nn[r])].append(int(surf_of_row[r]))
    return [S(i) for i in rows_by_node.get(nodeidx,[])]
def gloss(word):
    nodes=ru_lemma_nodes(word); eng=collections.Counter()
    for n in nodes:
        a,b=np.searchsorted(lts,n,"left"),np.searchsorted(lts,n,"right")
        for k in order[a:b]:
            if kinds[lk[k]].startswith("link:") and True: 
                for s in en_names_of(int(lf[k])): eng[s]+=1
    return nodes,eng
# --- parallel side: windows by relative position ---
W=60
def windows(text,pred):
    toks=[(mm.start()/len(text),mm.group()) for mm in re.finditer(r"\w+",text)]
    return toks
norm=lambda s: "".join(c for c in unicodedata.normalize("NFKD",s) if not unicodedata.combining(c))
ru_t=[(mm.start()/len(ru),mm.group()) for mm in re.finditer(r"[Ѐ-ӿ]+",ru)]
en_t=[(mm.start()/len(en),norm(mm.group())) for mm in re.finditer(r"[A-Za-zÀ-ſ]+",en)]
encaps=collections.Counter(w for _,w in en_t if w[0].isupper()); lowc=collections.Counter(w for _,w in en_t if w[0].islower())
cand=[w for w,c in encaps.items() if c>=3 and len(w)>2 and lowc.get(w.lower(),0)<c]    # capitalized more than lower-cased
def vec(tokens,forms):
    v=np.zeros(W); 
    for p,w in tokens:
        if w in forms: v[min(W-1,int(p*W))]+=1
    return v
envec={w:vec(en_t,{w}) for w in cand}
report=[]
for gr in groups:
    total=sum(c for _,c in gr)
    if total<3: continue
    forms={w for w,_ in gr}; v=vec(ru_t,forms); root=gr[0][0]
    best=None
    for w,ev in envec.items():
        if ev.std()==0 or v.std()==0: continue
        r=float(np.corrcoef(v,ev)[0,1])
        if best is None or r>best[1]: best=(w,r)
    nodes,eng=gloss(root)
    report.append((root,total,len(gr),best,[e for e,_ in eng.most_common(3)],len(nodes)))
print("groups with >=3 uses:",len(report))
withnode=sum(1 for r in report if r[5]); withgloss=sum(1 for r in report if r[4])
print("giver: ru lemma node found",withnode,"English gloss via translation links",withgloss)
print("parallel: windows",W)
for root,total,n,best,eng,nn_ in sorted(report,key=lambda r:-r[1]): print(f"{root:12} uses {total:3} forms {n} | giver {eng if eng else ('node, no translation' if nn_ else 'GAP no node')} | parallel {best[0]+' r=%.2f'%best[1] if best else '-'}")
# --- falsifying control: shuffle the Russian windows, take the best correlation over all English candidates; 200 shuffles per group ---
rng=np.random.default_rng(5); M=np.array([envec[w] for w in envec if envec[w].std()>0]); Mz=(M-M.mean(1,keepdims=True))/M.std(1,keepdims=True)
print("english candidates",len(Mz)); passed=0; rows=[]
for gr in groups:
    total=sum(c for _,c in gr)
    if total<3: continue
    v=vec(ru_t,{w for w,_ in gr})
    if v.std()==0: continue
    z=lambda x:(x-x.mean())/x.std()
    obs=float((Mz@z(v)/W).max()); null=[float((Mz@z(rng.permutation(v))/W).max()) for _ in range(200)]
    p95=float(np.percentile(null,95)); rows.append((gr[0][0],obs,p95)); passed+=obs>p95
print("groups whose best r beats the shuffled 95th percentile:",passed,"of",len(rows)); print([(a,round(b,2),round(c,2)) for a,b,c in rows if b<=c])
