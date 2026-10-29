// make-labelling-pack-scene.mjs — the labeller's inputs for the scene gold: the window with its narrative paragraphs numbered, the kin statements (the plain extractor's, unchanged), and the reader's beings with their mentions. Nothing else: no binder output, no scene model.
//   node make-labelling-pack-scene.mjs <window text> <ledger.json> <out dir>
import fs from "node:fs";
import path from "node:path";
import { extract } from "./extract-kin.mjs";
import { loadPriors } from "./bind-kin2.mjs";
import { paragraphsOf } from "./scene-kin.mjs";
const [textPath, ledgerPath, outDir] = process.argv.slice(2);
const priors = loadPriors(), text = fs.readFileSync(textPath, "utf8"), ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8")), buf = Buffer.from(text);
const ex = extract({ text, lang: "ru", lexicon: priors.lexicon, namePartsRu: priors.nameParts }), paras = paragraphsOf(text);
const charOfByte = (b) => buf.subarray(0, b).toString("utf8").length;
const paraOfChar = (c) => { let lo = 0, hi = paras.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (paras[m].from <= c) lo = m; else hi = m - 1; } return lo; };
fs.mkdirSync(outDir, { recursive: true });
// numbered text: walk the lines in order and prefix each narrative paragraph with its number
{ const out = []; let k = 0, ln = 0; for (const line of text.split("\n")) { if (/^\s*[IVXLC]+\.\s*$/.test(line)) out.push(`=== chapter heading ${line.trim()} (a new scene starts at the next paragraph) ===`); else if (k < paras.length && paras[k].line === ln) { out.push(`[P${k}] ${line}`); k++; } else out.push(line); ln++; }
  fs.writeFileSync(path.join(outDir, "window-numbered.txt"), out.join("\n")); }
const statements = ex.stmts.map((s, i) => ({ i, term: s.en, text: buf.subarray(s.termAt[0], s.termAt[1]).toString("utf8"), termSpan: s.span, termAt: s.termAt, extractor_cat: s.cat, paragraph: paraOfChar(charOfByte(s.termAt[0])),
  snippet: text.slice(Math.max(0, charOfByte(s.termAt[0]) - 140), Math.min(text.length, charOfByte(s.termAt[1]) + 100)).replace(/\n/g, " ⏎ ") }));
fs.writeFileSync(path.join(outDir, "statements.json"), JSON.stringify(statements, null, 1) + "\n");
const byRef = new Map(); for (const sp of ledger.spans) { if (sp.kind !== "name" || !sp.ref) continue; (byRef.get(sp.ref) ?? byRef.set(sp.ref, []).get(sp.ref)).push({ text: sp.text, bytes: sp.bytes, paragraph: paraOfChar(sp.at[0]) }); }
const beings = ledger.referents.filter((r) => r.standing === "referent").map((r) => ({ id: r.id, face: r.face, forms: r.forms, mentions: byRef.get(r.id) ?? [] }));
fs.writeFileSync(path.join(outDir, "beings.json"), JSON.stringify(beings, null, 1) + "\n");
console.log(JSON.stringify({ out: outDir, paragraphs: paras.length, statements: statements.length, beings: beings.length }));
