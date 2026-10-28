"""Build priors/parallel-names-rus-eng.json (ParallelNames@1): the aligned English edition as the gloss giver for the Russian fold groups,
with the shuffled-null control. Needs numpy and /Users/mlacy/hyperlexicon/v2; scope is Russian chapters I to III (the Russian on disk).
  python3 scripts/hyperlexicon/parallel_names.py [out.json]"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
import json, random
src=open(os.path.join(HERE, "gloss_measure.py")).read()
exec(src.split("# --- falsifying control")[0].replace('print(','(lambda *a,**k:None)('))   # reuse groups, vec, envec, ru_t, W
rng=np.random.default_rng(5)
M=np.array([envec[w] for w in envec if envec[w].std()>0]); names=[w for w in envec if envec[w].std()>0]
Mz=(M-M.mean(1,keepdims=True))/M.std(1,keepdims=True); z=lambda x:(x-x.mean())/x.std()
def best(v):
    s=Mz@z(v)/W; i=int(s.argmax()); null=[float((Mz@z(rng.permutation(v))/W).max()) for _ in range(200)]
    return names[i],float(s[i]),float(np.percentile(null,95))
rows,gaps=[],[]; token_rows=collections.defaultdict(list); G={}
for gr in groups:
    total=sum(c for _,c in gr)
    if total<3: continue
    v=vec(ru_t,{w for w,_ in gr})
    if v.std()==0: continue
    tok,r,p95=best(v); G[gr[0][0]]=(gr,tok)
    row={"root":gr[0][0],"forms":[{"form":w,"uses":c} for w,c in gr],"uses":total,"english":tok,"r":round(r,3),"nullP95":round(p95,3),"windows":W}
    if r>p95: rows.append(row); token_rows[tok].append(row["root"])
    else: gaps.append({"root":row["root"],"forms":row["forms"],"uses":total,"gap":"no_english_name","reason":"best correlation does not beat the shuffled 95th percentile","observed":{"english":tok,"r":round(r,3),"nullP95":round(p95,3)}})
for r_ in rows:
    others=[x for x in token_rows[r_["english"]] if x!=r_["root"]]
    if others: r_["collidesWith"]=others; r_["note"]="two groups map to this English token with the same position profile; composition must not use either as the whole name"
    r_["standing"]="candidate"; r_["giver"]="aligned edition (Maude translation, Gutenberg pg2600)"
out={"schema":"ParallelNames@1","language":{"from":"rus","to":"eng"},
 "provenance":{"giver":"the aligned Maude edition of War and Peace (Gutenberg pg2600) beside the Russian text, Zenodotus 11-multi-language/war-and-peace/aligned/{ru,en}/*-ch1-3-aligned.txt","method":"60 relative-position windows; Pearson r between a fold group's summed form counts and each capitalized English token (>=3 occurrences, capitalized more often than lower-cased, accents stripped; 32 candidates); null = the best r after shuffling the Russian windows 200 times, 95th percentile","folds":"priors/declension-rus.json (UniMorph rus, 89 rules), a form folds when its candidate lemma occurs capitalized in the text","scope":"Russian chapters I to III only: the method reaches no further than the Russian text on disk","not_claimed":"that a row is a referent or a true translation; windows are by character position, not sentence alignment"},
 "rows":rows,"gaps":gaps,"groupsBelowThreeUses":"not rowed (a profile of fewer than 3 uses is not correlated)"}
json.dump(out,open(os.path.join(HERE, "..", "..", "priors", "parallel-names-rus-eng.json") if len(sys.argv) < 2 else sys.argv[1],"w"),ensure_ascii=False,indent=1)
print("rows",len(rows),"gaps",len(gaps),[g["root"] for g in gaps],"collisions",[(r["root"],r["collidesWith"]) for r in rows if "collidesWith" in r])
# --- purity on merged groups ---
elig=0; res=[]
def member_best(w):
    v=vec(ru_t,{w}); 
    if v.std()==0: return None
    tok,r,p95=best(v); return tok if r>p95 else "undecided"
for root,(gr,tok) in G.items():
    mem=[w for w,c in gr if c>=2]
    if len(gr)<2 or len(mem)<2: res.append((root,"UNTESTABLE",len(gr),len(mem),None)); continue
    ans=[member_best(w) for w in mem]; dec=[a for a in ans if a not in (None,"undecided")]
    if len(dec)<2: res.append((root,"UNTESTABLE",len(gr),len(mem),None)); continue
    p=sum(a==tok for a in dec)/len(dec); res.append((root,"PURE" if p>=0.8 else "SUSPECT",len(gr),len(dec),round(p,2)))
print(res)
# control: same-size random groups of forms drawn across fold groups
allforms=[(w,c) for gr,_ in G.values() for w,c in gr if c>=2]; ctl=[]
for _ in range(40):
    k=random.Random(len(ctl)).choice([2,3,4]); mem=random.Random(100+len(ctl)).sample(allforms,k)
    vsum=sum(vec(ru_t,{w}) for w,_ in mem); tok,r,p95=best(vsum)
    ans=[member_best(w) for w,_ in mem]; dec=[a for a in ans if a not in (None,"undecided")]
    if len(dec)>=2: ctl.append(sum(a==tok for a in dec)/len(dec))
tested=[r for r in res if r[1]!="UNTESTABLE"]
print("real groups tested",len(tested),"mean purity",round(sum(r[4] for r in tested)/max(1,len(tested)),2),"| random control groups",len(ctl),"mean purity",round(sum(ctl)/max(1,len(ctl)),2))
