// choose-window-scene.mjs — PREREG-SCENE-MODEL section 2: the fresh window by the registered rule, the series of PREREG-KIN-BINDER-2 section 0 CONTINUED past the block it chose. Only two counts are computed per candidate block (statements, category A); no statement text is printed or read.
//   node choose-window-scene.mjs <full text> <out window.txt> <out choice.json>
import fs from "node:fs";
import crypto from "node:crypto";
import { extract } from "./extract-kin.mjs";
import { loadPriors } from "./bind-kin2.mjs";
const [full, outTxt, outJson] = process.argv.slice(2);
const FROM_LINE = 1895, BLOCK = 4, MIN_STATEMENTS = 40, FIRST_BLOCK = 28;     // the rule's numbers: the series of kin-binder-2 (blocks of four chapter headings from the heading at line 1895), whose block 27 was spent; this series starts at block 28
const priors = loadPriors(), raw = fs.readFileSync(full, "utf8"), lines = raw.split("\n");
const heads = []; lines.forEach((l, i) => { if (/^\s*[IVXLC]+\.\s*$/.test(l) && i + 1 >= FROM_LINE) heads.push(i); });
const tried = [];
for (let b = FIRST_BLOCK - 1; b * BLOCK < heads.length; b++) {
  const first = heads[b * BLOCK], next = heads[(b + 1) * BLOCK] ?? lines.length;
  const text = lines.slice(first, next).join("\n") + "\n";
  const ex = extract({ text, lang: "ru", lexicon: priors.lexicon, namePartsRu: priors.nameParts });
  const A = ex.stmts.filter((s) => s.cat === "A").length, row = { block: b + 1, lines: [first + 1, next], bytes: Buffer.byteLength(text), headings: lines.slice(first, next).filter((l) => /^\s*[IVXLC]+\.\s*$/.test(l)).map((l) => l.trim()), statements: ex.stmts.length, category_A: A };
  tried.push(row); console.log(JSON.stringify(row));
  if (ex.stmts.length >= MIN_STATEMENTS && A >= 1) { fs.writeFileSync(outTxt, text); fs.writeFileSync(outJson, JSON.stringify({ rule: "PREREG-SCENE-MODEL section 2 (the series of PREREG-KIN-BINDER-2 section 0, continued from block 28)", full_text_sha256: crypto.createHash("sha256").update(raw).digest("hex"), chosen: row, window_sha256: crypto.createHash("sha256").update(text).digest("hex"), tried }, null, 1) + "\n"); console.log("CHOSEN block", b + 1); break; }
}
