"""teacher_silver.py <out.conllu>: PREREG-PARSE-TEACHERS (+ADDENDUM-1). The teacher (Stanza English combined_charlm, its own tokenizer) annotates the local Wikipedia sentences: syntactic words only, a `# source =` line per sentence. Silver, a nomination, local only. No regex."""
import sys, json, glob, os, time, logging
import stanza
logging.disable(logging.CRITICAL)
out = sys.argv[1]; d = os.path.expanduser("~/.fold/stanza-models")
nlp = stanza.Pipeline("en", dir=d, processors="tokenize,mwt,pos,lemma,depparse", package={"pos": "combined_charlm", "lemma": "combined_charlm", "depparse": "combined_charlm", "tokenize": "combined", "mwt": "combined"}, download_method=None, verbose=False, use_gpu=False)
texts = []
for dd in ["/Users/mlacy/Documents/khora-cast/penelope/experiments/zero-overlap/referent/data/dev", "/Users/mlacy/Documents/janus-experiments/ctxnom/data/fresh2"]:
    for f in sorted(glob.glob(dd + "/*.json")):
        j = json.load(open(f)); t = j["text"]
        for s in j["sentences"]: texts.append((os.path.basename(f), t[s["c0"]:s["c1"]].strip()))
texts = [(f, s) for f, s in texts if len(s) > 3]; print(len(texts), "sentences to annotate", flush=True)
t0 = time.time(); n = 0
with open(out, "w", encoding="utf8") as o:
    for i in range(0, len(texts), 64):
        batch = texts[i:i + 64]; docs = nlp.bulk_process([stanza.Document([], text=s_) for _, s_ in batch])   # one Document per sentence text: its own tokenization and sentence cut
        for (f, raw), dd in zip(batch, docs):
            for sent in dd.sentences:
                n += 1; o.write(f"# sent_id = silver-{n}\n# source = stanza-1.15.1 combined_charlm\n# origin = {f}\n# text = {raw}\n")
                for w in sent.words: o.write("\t".join([str(w.id), w.text, w.lemma or "_", w.upos or "_", w.xpos or "_", w.feats or "_", str(w.head), w.deprel or "_", "_", "_"]) + "\n")
                o.write("\n")
        if (i // 64) % 20 == 0: print(f"  {i + len(batch)}/{len(texts)} ({time.time() - t0:.0f}s)", flush=True)
print(f"wrote {out}: {n} sentences in {time.time() - t0:.0f}s")
