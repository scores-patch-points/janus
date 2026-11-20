// libeval.mjs <stanza.json> <out.json> <label:file.conllu> [<label:file.conllu> ...]: PREREG-PARSE-LIBRARIES. Our frozen arms (POOL, BLEND, EWT, GUM) and the library's rows (stanza_parse.py) scored on the same gold-tokenized sentences, plus ENS_LIB and the agreement counts of L2. The gold is read here only to score.
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { loadModel, analyse, readJson, blendJson, mbr, loadSentences, score } from "./parselib.mjs";
const [stanzaF, out, ...sets] = process.argv.slice(2), O = path.join(os.homedir(), ".fold", "ud-parse-eval"), J = (tb) => readJson(path.join(O, tb, `ud-parser-eng-english-${tb}.json.gz`)), jE = J("ewt"), jG = J("gum"), jP = J("pool");
const M = { EWT: loadModel(jE), GUM: loadModel(jG), POOL: loadModel(jP), BLEND: loadModel(blendJson(jE, jG, 0.5, 0.5)) };
const stanza = JSON.parse(fs.readFileSync(stanzaF, "utf8")), byFile = new Map(); for (const s of stanza) { if (!byFile.has(s.file)) byFile.set(s.file, []); byFile.get(s.file).push(s); }
const res = [], disagree = [], rowsOf = (s) => s.forms.map((f, i) => ({ id: i + 1, form: f, upos: s.upos[i], head: s.head[i], deprel: s.deprel[i] }));
for (const spec of sets) {
  const label = spec.slice(0, spec.indexOf(":")), file = spec.slice(spec.indexOf(":") + 1), gold = loadSentences(file), st = byFile.get(path.basename(file)) ?? []; let si = 0, miss = 0, noDoc = new Set(gold.map((g) => g.doc)).size === 1;
  console.error(`${label}: ${gold.length} gold sentences, ${st.length} library sentences${noDoc ? " (no document ids: the bootstrap is by sentence)" : ""}`);
  gold.forEach((g, gi) => {
    while (si < st.length && st[si].forms.join("\u0001") !== g.forms.join("\u0001")) si++; if (si >= st.length) { miss++; si = 0; return; } const sRows = rowsOf(st[si++]);
    const rows = {}; for (const k of ["POOL", "BLEND", "EWT", "GUM"]) rows[k] = analyse(M[k], g.forms); rows.STANZA = sRows; rows.ENS_LIB = mbr([rows.POOL, rows.BLEND, rows.STANZA]);
    const arms = {}; for (const [k, r] of Object.entries(rows)) arms[k] = score(r, g.gold);
    const l2 = { agreeN: 0, agreeWrong: 0, disN: 0, disWrong: 0 }; g.gold.forEach((t, i) => { if (t.upos === "PUNCT") return; const p = rows.POOL[i], q = sRows[i], agree = p.head === q.head && p.deprel === q.deprel, wrong = !(p.head === t.head && p.deprel === t.deprel); if (agree) { l2.agreeN++; l2.agreeWrong += wrong; } else { l2.disN++; l2.disWrong += wrong; } });
    res.push({ corpus: label, doc: noDoc ? `s${gi}` : g.doc, arms, l2 }); if (l2.disN >= 5 && disagree.length < 2000) disagree.push({ corpus: label, disN: l2.disN, n: arms.POOL.nnp, forms: g.forms.join(" ").slice(0, 160) });
  });
  if (miss) console.error(`  ${miss} gold sentences had no matching library sentence (alignment)`);
}
disagree.sort((a, b) => b.disN / b.n - a.disN / a.n);
fs.writeFileSync(out, JSON.stringify({ sets: sets.map((s) => s.split(":")[0]), sentences: res, disagreeTop: disagree.slice(0, 25) })); console.log(`wrote ${out}: ${res.length} sentences`);
