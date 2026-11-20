"""stanza_parse.py <out.json> <conllu> [<conllu> ...]   PREREG-PARSE-LIBRARIES: the Stanza English pos + depparse (combined_charlm), GOLD tokens handed in (tokenize_pretokenized), UPOS from its own tagger fed to its own parser.
Writes per sentence {file, doc, forms, upos, head, deprel} to a JSON file: the other arms are scored in node (libeval.mjs). No gold label is read except the token forms. No regex."""
import sys, json, os, time, logging
import stanza
logging.disable(logging.CRITICAL)
out, files = sys.argv[1], sys.argv[2:]
d = os.path.expanduser("~/.fold/stanza-models")
nlp = stanza.Pipeline("en", dir=d, processors="tokenize,pos,lemma,depparse", tokenize_pretokenized=True, package={"pos": "combined_charlm", "lemma": "combined_charlm", "depparse": "combined_charlm", "tokenize": "combined"}, download_method=None, verbose=False, use_gpu=False)
res = []; t0 = time.time(); n = 0
for f in files:
    doc = "doc0"; forms = []; sents = []; seen_doc = False
    def flush():
        global forms
        if forms: sents.append((doc, forms)); forms = []
    for line in open(f, encoding="utf8"):
        line = line.rstrip("\n")
        if not line.strip(): flush(); continue
        if line.startswith("#"):
            if line.startswith("# newdoc id"): flush(); doc = line.split("=", 1)[1].strip(); seen_doc = True
            continue
        c = line.split("\t")
        if len(c) == 10 and "-" not in c[0] and "." not in c[0]: forms.append(c[1])
    flush()
    for i in range(0, len(sents), 64):
        batch = sents[i:i + 64]; d_ = nlp([f_ for _, f_ in batch])
        for (dc, f_), s in zip(batch, d_.sentences):
            w = s.words; res.append({"file": os.path.basename(f), "doc": dc if seen_doc else f"sent{n}", "forms": f_, "upos": [x.upos for x in w], "head": [x.head for x in w], "deprel": [x.deprel for x in w]}); n += 1
json.dump(res, open(out, "w")); print(f"wrote {out}: {len(res)} sentences in {time.time() - t0:.0f}s ({1000 * (time.time() - t0) / max(1, len(res)):.0f} ms per sentence)")
