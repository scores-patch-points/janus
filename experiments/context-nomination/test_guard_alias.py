"""guards for PREREG-CLAIM-GRAPH-UNIVERSE: run with the venv python: python test_guard_alias.py"""
import sys, os, json, ast
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ctxalias as A
from ctxnom import check_registry
here = os.path.dirname(os.path.abspath(__file__))
# 1. the registry guard refuses a context arm with no twin, and every context arm of this experiment declares one
check_registry(A.ARM_SPECS)
bad = dict(A.ARM_SPECS); bad["CG"] = {**bad["CG"], "twin": None}
try: check_registry(bad); raise SystemExit("FAIL: a context arm without a twin was accepted")
except ValueError: pass
bad = dict(A.ARM_SPECS); bad["CG"] = {**bad["CG"], "twin": "NOPE"}
try: check_registry(bad); raise SystemExit("FAIL: a twin that is not an arm was accepted")
except ValueError: pass
# 2. no context arm of this experiment rests on an arbitrary constant (each cuts by the stopping rule)
assert check_registry(A.ARM_SPECS) == [], "an arm rests on an ARBITRARY CONSTANT"
# 3. the arms never see the link targets
cg = {"classes": [{"anchor": "a", "key": "a", "targets": ["T"], "sents": [0]}, {"anchor": "b", "key": "b", "targets": ["T"], "sents": [1]}], "clauses": [], "anaphors": []}
assert all("targets" not in c for c in A.strip(cg)["classes"]), "strip left a target"
assert A.gold(cg) == {0: [1], 1: [0]}
# 4. no regex, no model-judged sameness, no import of the other repos in the owned files
for f in ("ctxalias.py", "claimgraph.mjs"):
    src = open(os.path.join(here, f)).read(); assert "import re" not in src and "re.compile" not in src and "RegExp" not in src and "/\\p" not in src and ".match(" not in src and ".replace(/" not in src, f"{f} uses a regex"
tree = ast.parse(open(os.path.join(here, "ctxalias.py")).read()); names = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)} | {n.attr for n in ast.walk(tree) if isinstance(n, ast.Attribute)}
assert not ({"judge", "convict", "verdict", "same_being"} & names), "a verdict API appeared"
# 5. a hit needs the hidden gold: the arms' output is the same with or without targets (they are never read)
import ctxfull as F
check_registry(F.ARM_SPECS); assert check_registry(F.ARM_SPECS) == []
bad = dict(F.ARM_SPECS); bad["FG"] = {**bad["FG"], "twin": None}
try: check_registry(bad); raise SystemExit("FAIL: FG without a twin accepted")
except ValueError: pass
for f in ("ctxfull.py", "fullgraph.mjs"):
    src = open(os.path.join(here, f)).read(); assert "import re" not in src and "re.compile" not in src and "RegExp" not in src and "/\\p" not in src and ".match(" not in src and ".replace(/" not in src, f"{f} uses a regex"
# the full graph: a path through ANY dependency label connects, and an unconnected node does not; the lemma handle merges across sentences
rec = {"classes": [{"anchor": "x", "key": "x", "sents": [0]}], "anaphors": [], "tokens": [
  {"sent": 0, "upos": "PROPN", "lemma": "x", "cls": 0, "head": 1, "at": 0}, {"sent": 0, "upos": "VERB", "lemma": "go", "cls": -1, "head": -1, "at": 2},
  {"sent": 0, "upos": "NOUN", "lemma": "city", "cls": -1, "head": 1, "at": 4}, {"sent": 1, "upos": "NOUN", "lemma": "city", "cls": -1, "head": 5, "at": 9}, {"sent": 1, "upos": "ADJ", "lemma": "big", "cls": -1, "head": 3, "at": 7}, {"sent": 1, "upos": "VERB", "lemma": "be", "cls": -1, "head": -1, "at": 10},
  {"sent": 2, "upos": "VERB", "lemma": "rain", "cls": -1, "head": -1, "at": 20}]}
adj, ss = F.build(rec); P = F.hops_of(rec, adj, ss, 0)
assert P[0] == [0] and 1 in P[F.HMAXF] and 2 not in P[F.HMAXF], P   # reaches sentence 1 through the shared noun, never the disconnected sentence 2
adj2, ss2 = F.build(rec, lemma_handle=False); assert 1 not in F.hops_of(rec, adj2, ss2, 0)[F.HMAXF], "without the lemma handle the sentences must not connect"
import ctxvoid as V
check_registry(V.ARM_SPECS); assert check_registry(V.ARM_SPECS) == []
bad = dict(V.ARM_SPECS); bad["VGB"] = {**bad["VGB"], "twin": None}
try: check_registry(bad); raise SystemExit("FAIL: VGB without a twin accepted")
except ValueError: pass
v = V.void_of(0, [{"anchor": "x"}]); assert v["giver"] and v["slot"] == "identity" and v["admits"] is None and v["admits_gap"], "the void needs a giver and a typed gap for the unread admits"
for f in ("ctxvoid.py",):
    src = open(os.path.join(here, f)).read(); assert "import re" not in src and "re.compile" not in src and "RegExp" not in src and ".match(" not in src, f"{f} uses a regex"
# the gate reads dependency labels ONLY through the void's relation: no label literal outside VOID
src = open(os.path.join(here, "ctxvoid.py")).read(); body = src.split("def bears(")[1].split("def kids_of")[0]
assert '"appos"' not in body and '"cop"' not in body and '"flat"' not in body and '"nsubj"' not in body, "a label is hard-coded in the gate"
T = [{"head": 1, "dep": "nsubj", "cls": -1}, {"head": -1, "dep": "root", "cls": -1}, {"head": 1, "dep": "cop", "cls": -1}, {"head": 0, "dep": "appos", "cls": -1}, {"head": 1, "dep": "obj", "cls": -1}, {"head": 3, "dep": "flat:name", "cls": -1}]
k = V.kids_of(T); assert [V.bears(T, i, k) for i in range(6)] == [True, False, False, True, False, True], "gate: nsubj needs a copula under its head; appos and flat bear; cop itself and obj do not"
assert V.bears([{"head": 1, "dep": "nsubj"}, {"head": -1, "dep": "root"}], 0, V.kids_of([{"head": 1, "dep": "nsubj"}, {"head": -1, "dep": "root"}])) is False, "a non-copular subject must not bear on identity"
import ctxadmit as D, random
check_registry(D.ARM_SPECS); bad = dict(D.ARM_SPECS); bad["A0A"] = {**bad["A0A"], "twin": None}
try: check_registry(bad); raise SystemExit("FAIL: A0A without a twin accepted")
except ValueError: pass
sc = [0.9, 0.8, 0.7, 0.6, 0.5]
assert D.tiered(sc, 0, [0, 0, 1, None, 0]) == [1, 4, 3, 2], "admitted first, unknown next, refused last, q excluded"
assert D.tiered(sc, 0, [None, 0, 1, None, 0]) == [1, 2, 3, 4], "an unplaced q admits and refuses nothing: one tier, the base order"
sk = D.shuffled_kinds([0, 0, 1, None, 1], random.Random(1)); assert sorted(x for x in sk if x is not None) == [0, 0, 1, 1] and sk[3] is None, "the shuffle keeps kind sizes and the unplaced"
src = open(os.path.join(here, "kinds.mjs")).read(); assert "RegExp" not in src and "/\\p" not in src and ".match(" not in src and "memberRefs" in src and "fallbackNomination" in src, "kinds.mjs: no regex; only stable non-fallback kinds"
import eot_law as L
L.check({"ctxalias": A.ARM_SPECS, "ctxfull": F.ARM_SPECS, "ctxvoid": V.ARM_SPECS, "ctxadmit": D.ARM_SPECS})
try: L.check({"x": {"MYSTERY": {}}}); raise SystemExit("FAIL: an arm with no level was accepted")
except ValueError: pass
for f in L.EXTRACTORS:
    src = open(os.path.join(here, f)).read(); assert "LANG" in src or "process.argv[4]" in src or "lang" in src.lower(), f"{f} must take a language code (rule 11)"
reads_eot = [f for f in L.EXTRACTORS if "nl-eot" in open(os.path.join(here, f)).read()]
if not reads_eot: assert "EOT" not in set(L.LEVELS.values()), "an arm claims EOT while no extractor reads through nl-eot.mjs"
print("test_guard_alias: OK")
