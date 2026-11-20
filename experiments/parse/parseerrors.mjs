// parseerrors.mjs <out.json>: DEV ONLY, exploratory. Per token of both dev files, the pooled parser's analysis against gold, with the token's STRUCTURAL profile (never its word): gold relation, gold part of speech, the gold head's part of speech and relation, direction and distance to the head, the error type. No regex, no word list.
import path from "node:path"; import os from "node:os"; import fs from "node:fs";
import { loadModel, analyse, readJson, loadSentences } from "./parselib.mjs";
const O = path.join(os.homedir(), ".fold", "ud-parse-eval"), M = loadModel(readJson(path.join(O, "pool", "ud-parser-eng-english-pool.json.gz")));
const bucketD = (d) => (d <= 1 ? "1" : d === 2 ? "2" : d <= 4 ? "3-4" : d <= 8 ? "5-8" : "9+"), bucketL = (n) => (n <= 10 ? "<=10" : n <= 20 ? "11-20" : n <= 35 ? "21-35" : "36+");
const out = [];
for (const [corpus, file] of [["EWT", "/Users/mlacy/Documents/data/ud/en_ewt/en_ewt-ud-dev.conllu"], ["GUM", "/Users/mlacy/Documents/janus-experiments/gum-raw/en_gum-ud-dev.conllu"]]) {
  for (const [si, s] of loadSentences(file).entries()) {
    const rows = analyse(M, s.forms), n = s.gold.length, kids = new Array(n + 1).fill(0); s.gold.forEach((g) => { if (g.head > 0) kids[g.head]++; });
    s.gold.forEach((g, i) => {
      if (g.upos === "PUNCT") return; const r = rows[i], headOk = r.head === g.head, labOk = r.deprel === g.deprel, tagOk = r.upos === g.upos, h = g.head > 0 ? s.gold[g.head - 1] : null;
      const err = headOk && labOk ? "none" : !headOk && !labOk ? "both" : !headOk ? "head" : "label";
      out.push({ corpus, doc: s.doc, sent: si, tok: i, err, tagErr: !tagOk,
        prof: { rel: g.deprel, pos: g.upos, hpos: h ? h.upos : "ROOT", hrel: h ? h.deprel : "ROOT", dir: g.head === 0 ? "root" : g.head < i + 1 ? "R" : "L", dist: g.head === 0 ? "root" : bucketD(Math.abs(g.head - (i + 1))), kids: kids[i + 1] >= 2 ? "2+" : String(kids[i + 1]), slen: bucketL(n) },
        pred: { rel: r.deprel, head: r.head, headGold: g.head } });
    });
  }
}
fs.writeFileSync(process.argv[2], JSON.stringify(out));
const w = out.filter((t) => t.err !== "none"); console.log(`wrote ${process.argv[2]}: ${out.length} non-punctuation tokens, ${w.length} wrong (${(100 * w.length / out.length).toFixed(1)}%): head-only ${out.filter((t) => t.err === "head").length}, label-only ${out.filter((t) => t.err === "label").length}, both ${out.filter((t) => t.err === "both").length}`);
