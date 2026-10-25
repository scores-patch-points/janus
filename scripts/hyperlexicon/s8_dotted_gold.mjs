// s8_dotted_gold.mjs — DOTTED-PREREG.md's score: on UD English gold, the junctions where each arm's sentence cut disagrees with the gold.
// The arms differ only in priors.dotted; the cut is khora's own (read-core.mjs::abbreviationsFor, spans.js::splitSentences, its bare-use
// test included), with the measured punctuation prior and the text's own abbreviations the same in every arm.
//   node s8_dotted_gold.mjs --khora <khora native dir> --ud <UD root> --W <wiktionary dotted-eng.json> --H <hyperlexicon dotted-eng.json>
//   frame 2 (DOTTED-PREREG-2.md): any arms, each a union of lists, scored on material that leaves a split out:
//   node s8_dotted_gold.mjs --khora <dir> --ud <root> --arm W=<json> --arm T=<ud-tokenizer.json.gz> --arm H2=<ud-tokenizer.json.gz>+<json>
//        --exclude en_ewt-ud-train.conllu --target H2 --baseline W
//   A list is a DottedWords@1 prior (its `words`) or a UDTokenizer@1 prior (its measured `abbrev`).
// A junction: a token of letters (not preceded by a letter, digit or period) followed by a period, white space and more text.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const all = (k) => process.argv.flatMap((x, i) => (x === `--${k}` ? [process.argv[i + 1]] : []));
const KHORA = arg("khora"), UD = arg("ud"), WF = arg("W"), HF = arg("H");
const ARM_SPECS = all("arm"), EXCLUDE = new Set(all("exclude")), TARGET = arg("target", "H"), BASELINE = arg("baseline", "W");
if (!KHORA || !UD || (!ARM_SPECS.length && (!WF || !HF))) { console.error("usage: s8_dotted_gold.mjs --khora <native> --ud <UD root> (--W <json> --H <json> | --arm name=<list>[+<list>] ...)"); process.exit(2); }
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
// a list: a DottedWords@1 prior's words, or a UDTokenizer@1 prior's measured abbrev (gzip or plain JSON)
const readList = (f) => { const b = fs.readFileSync(f); const j = JSON.parse((f.endsWith(".gz") ? zlib.gunzipSync(b) : b).toString("utf8")); return { words: (j.schema === "UDTokenizer@1" ? j.abbrev : j.words) ?? [], giver: j.giver ?? j.source ?? null, schema: j.schema }; };   // a UDTokenizer@1 prior's `words` are its elisions: its list is `abbrev`
const specs = ARM_SPECS.length ? ARM_SPECS.map((x) => { const i = x.indexOf("="); return [x.slice(0, i), x.slice(i + 1).split("+")]; }) : [["W", [WF]], ["H", [HF]]];
const ARMS = { "0": { ...pr, dotted: null } }, LISTS = {};
for (const [name, files] of specs) { const ls = files.map(readList); const words = new Set(ls.flatMap((l) => l.words)); ARMS[name] = { ...pr, dotted: words }; LISTS[name] = { n: words.size, from: files.map((f, i) => ({ file: path.basename(f), schema: ls[i].schema, n: ls[i].words.length, giver: ls[i].giver })) }; }
const NAMES = Object.keys(ARMS);

const result = { prereg: ARM_SPECS.length ? "scripts/hyperlexicon/DOTTED-PREREG-2.md" : "scripts/hyperlexicon/DOTTED-PREREG.md", arms: LISTS, excluded: [...EXCLUDE], treebanks: {}, pooled: {}, differ: [] };
const pooled = Object.fromEntries([["junctions", 0], ...NAMES.map((n) => [n, 0])]);
for (const tb of TREEBANKS) {
  const dir = path.join(UD, tb); if (!fs.existsSync(dir)) continue;
  const row = Object.fromEntries([["junctions", 0], ...NAMES.map((n) => [n, 0])]);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".conllu") && !EXCLUDE.has(x)).sort()) {
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
        if (verdict[BASELINE] !== verdict[TARGET] && result.differ.length < 400) result.differ.push({ tb, form: m[1] + ".", gold, [BASELINE]: verdict[BASELINE], [TARGET]: verdict[TARGET], at: doc.text.slice(Math.max(0, m.index - 30), at + 30) });
      }
    }
  }
  for (const n of NAMES) if (n !== "0") row["gain" + n] = row["0"] - row[n];
  result.treebanks[tb] = row;
  for (const k of ["junctions", ...NAMES]) pooled[k] += row[k];
}
for (const n of NAMES) if (n !== "0") pooled["gain" + n] = pooled["0"] - pooled[n];
result.pooled = pooled;
const gT = pooled["gain" + TARGET], gB = pooled["gain" + BASELINE];
result.B1 = { rule: `gain_${TARGET} >= gain_${BASELINE}, pooled`, pass: gT >= gB };
result.B2 = { rule: `gain_${TARGET} > 0`, pass: gT > 0 };
result.decision = result.B1.pass && result.B2.pass ? `${TARGET} replaces ${BASELINE}` : result.B2.pass ? `${BASELINE} stays; ${TARGET} cuts gold worse by ${gB - gT} — the trade is the user's (frame 2) or a REC (frame 1)` : `${TARGET} failed`;
console.log(JSON.stringify(result, null, 1));
