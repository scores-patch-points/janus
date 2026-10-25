// s8_dotted_gold.mjs — DOTTED-PREREG.md's score: on UD English gold, the junctions where each arm's sentence cut disagrees with the gold.
// The arms differ only in priors.dotted; the cut is khora's own (read-core.mjs::abbreviationsFor, spans.js::splitSentences, its bare-use
// test included), with the measured punctuation prior and the text's own abbreviations the same in every arm.
//   node s8_dotted_gold.mjs --khora <khora native dir> --ud <UD root> --W <wiktionary dotted-eng.json> --H <hyperlexicon dotted-eng.json>
// A junction: a token of letters (not preceded by a letter, digit or period) followed by a period, white space and more text.
import fs from "node:fs";
import path from "node:path";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const KHORA = arg("khora"), UD = arg("ud"), WF = arg("W"), HF = arg("H");
if (!KHORA || !UD || !WF || !HF) { console.error("usage: s8_dotted_gold.mjs --khora <native> --ud <UD root> --W <json> --H <json>"); process.exit(2); }
const { abbreviationsFor, priorsFor } = await import(path.join(KHORA, "the-fold/read-core.mjs"));
const { splitSentences } = await import(path.join(KHORA, "adapters/text/spans.js"));

const TREEBANKS = ["UD_English-EWT", "UD_English-GUM", "UD_English-LinES", "UD_English-ParTUT", "UD_English-PUD"];
const JUNCTION = /(?<![\p{L}\p{N}.])(\p{L}+)\.(?=\s+\S)/gu;

// documents from a .conllu: `# newdoc` starts one, `# newpar` a paragraph; a sentence's end is a gold boundary
function documents(file) {
  const docs = []; let doc = null, par = false;
  const start = () => { doc = { text: "", ends: new Set() }; docs.push(doc); par = false; };
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (line.startsWith("# newdoc")) { start(); continue; }
    if (line.startsWith("# newpar")) { par = true; continue; }
    if (line.startsWith("# text = ")) {
      if (!doc) start();
      const t = line.slice(9).trim();
      if (doc.text) doc.text += par ? "\n\n" : " ";
      par = false;
      doc.text += t; doc.ends.add(doc.text.length);
    }
  }
  return docs.filter((d) => d.text);
}

const pr = priorsFor("eng");
const W = JSON.parse(fs.readFileSync(WF, "utf8")), H = JSON.parse(fs.readFileSync(HF, "utf8"));
const ARMS = { "0": { ...pr, dotted: null }, W: { ...pr, dotted: new Set(W.words) }, H: { ...pr, dotted: new Set(H.words) } };

const result = { prereg: "scripts/hyperlexicon/DOTTED-PREREG.md", W: { n: W.n, giver: W.giver }, H: { n: H.n, giver: H.giver }, treebanks: {}, pooled: {}, differ: [] };
const pooled = { junctions: 0, "0": 0, W: 0, H: 0 };
for (const tb of TREEBANKS) {
  const dir = path.join(UD, tb); if (!fs.existsSync(dir)) continue;
  const row = { junctions: 0, "0": 0, W: 0, H: 0 };
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".conllu")).sort()) {
    for (const doc of documents(path.join(dir, f))) {
      const cuts = {};
      for (const [arm, priors] of Object.entries(ARMS)) {
        const set = abbreviationsFor(doc.text, { priors }).set;
        cuts[arm] = new Set(splitSentences(doc.text, { abbreviations: set }).map((s) => s.offset + s.text.trimEnd().length));
      }
      for (const m of doc.text.matchAll(JUNCTION)) {
        const at = m.index + m[0].length;                   // just after the period
        const gold = doc.ends.has(at);
        row.junctions++;
        const verdict = {};
        for (const arm of Object.keys(ARMS)) { const cut = cuts[arm].has(at); verdict[arm] = cut; if (cut !== gold) row[arm]++; }
        if (verdict.W !== verdict.H && result.differ.length < 400) result.differ.push({ tb, form: m[1] + ".", gold, W: verdict.W, H: verdict.H, at: doc.text.slice(Math.max(0, m.index - 30), at + 30) });
      }
    }
  }
  row.gainW = row["0"] - row.W; row.gainH = row["0"] - row.H;
  result.treebanks[tb] = row;
  for (const k of ["junctions", "0", "W", "H"]) pooled[k] += row[k];
}
pooled.gainW = pooled["0"] - pooled.W; pooled.gainH = pooled["0"] - pooled.H;
result.pooled = pooled;
result.B1 = { rule: "gain_H >= gain_W, pooled", pass: pooled.gainH >= pooled.gainW };
result.B2 = { rule: "gain_H > 0", pass: pooled.gainH > 0 };
result.decision = result.B1.pass && result.B2.pass ? "H replaces W" : "W stays; H failed (REC)";
console.log(JSON.stringify(result, null, 1));
