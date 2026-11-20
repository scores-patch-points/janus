"""ctxeot.py void|admit <eot.json> [kinds.json] <out.json>   ADDENDUM-4: the frozen void-gated (ctxvoid.py) and admits (ctxadmit.py) arms run on documents PARSED INTO EOT (eotgraph.mjs, through nl-eot.mjs).
The only change to the scorers: the copular predicate nominal is read from the head node's absorbed `cop` MARKER (EOT has no copula node), so kids_of is replaced by an EOT-aware one. Everything else, arms, twins, falsifiers, thresholds, is the frozen code."""
import sys, os, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ctxvoid as V, ctxadmit as D, eot_law
def kids_of_eot(T):
    k = collections.defaultdict(set)
    for i, t in enumerate(T):
        if t["head"] >= 0: k[t["head"]].add(V.base(t["dep"]))
    for i, t in enumerate(T):
        for m in t.get("mk", []): k[i].add(m)        # absorbed markers (cop, det, case ...) sit on the node they serve
    return k
V.kids_of = kids_of_eot
if __name__ == "__main__":
    mode = sys.argv[1]; print("RUN LEVEL (rule 11): EOT graph (nl-eot.mjs read; content nodes, cube-addressed arcs, absorbed markers, content-lemma class handle, lemma-set sentences). The embedder is a given from its training and sees lemma sets, not surface text.")
    sys.argv = [sys.argv[0]] + sys.argv[2:]
    (V.main if mode == "void" else D.main)()
