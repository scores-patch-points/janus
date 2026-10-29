// choose-window-kind.mjs — PREREG-KIND-KIN section 2: the fresh window for the kind-induction arm. Only counts are computed per candidate block (statements, category A); no statement text is printed or read.
//   node choose-window-kind.mjs <full text> <out window.txt> <out choice.json>
// RULE R1 (the rule of PREREG-SCENE-MODEL section 2, continued past the block it chose): the series of PREREG-KIN-BINDER-2 section 0 (blocks of four chapter headings from the heading at line 1895); the first block from block 80 on with at least 40 statements AND at least one of category A.
// RULE R2 (registered beforehand, applied only if R1 finds no block): the first block from block 28 on, other than the spent block 79, with at least 40 statements (no category-A floor); blocks 28 to 78 have had counts computed and no statement read by anyone.
import fs from "node:fs";
import crypto from "node:crypto";
import { extract } from "./extract-kin.mjs";
import { loadPriors } from "./bind-kin2.mjs";
const [full, outTxt, outJson] = process.argv.slice(2);
const FROM_LINE = 1895, BLOCK = 4, MIN_STATEMENTS = 40, R1_FIRST = 80, R2_FIRST = 28, SPENT = new Set([79]);
const priors = loadPriors(), raw = fs.readFileSync(full, "utf8"), lines = raw.split("\n");
const heads = []; lines.forEach((l, i) => { if (/^\s*[IVXLC]+\.\s*$/.test(l) && i + 1 >= FROM_LINE) heads.push(i); });
const tried = [], count = (b) => {
  const first = heads[b * BLOCK], next = heads[(b + 1) * BLOCK] ?? lines.length, text = lines.slice(first, next).join("\n") + "\n";
  const ex = extract({ text, lang: "ru", lexicon: priors.lexicon, namePartsRu: priors.nameParts }), A = ex.stmts.filter((s) => s.cat === "A").length;
  return { text, row: { block: b + 1, lines: [first + 1, next], bytes: Buffer.byteLength(text), headings: lines.slice(first, next).filter((l) => /^\s*[IVXLC]+\.\s*$/.test(l)).map((l) => l.trim()), statements: ex.stmts.length, category_A: A } };
};
let chosen = null, rule = null;
for (let b = R1_FIRST - 1; b * BLOCK < heads.length && !chosen; b++) { const { text, row } = count(b); tried.push({ rule: "R1", ...row }); console.log(JSON.stringify({ rule: "R1", ...row })); if (row.statements >= MIN_STATEMENTS && row.category_A >= 1) { chosen = { text, row }; rule = "R1"; } }
if (!chosen) for (let b = R2_FIRST - 1; b * BLOCK < heads.length && !chosen; b++) { if (SPENT.has(b + 1)) continue; const { text, row } = count(b); tried.push({ rule: "R2", ...row }); console.log(JSON.stringify({ rule: "R2", ...row })); if (row.statements >= MIN_STATEMENTS) { chosen = { text, row }; rule = "R2"; } }
if (chosen) { fs.writeFileSync(outTxt, chosen.text); fs.writeFileSync(outJson, JSON.stringify({ rule: `PREREG-KIND-KIN section 2, rule ${rule}`, full_text_sha256: crypto.createHash("sha256").update(raw).digest("hex"), chosen: chosen.row, window_sha256: crypto.createHash("sha256").update(chosen.text).digest("hex"), tried }, null, 1) + "\n"); console.log("CHOSEN", rule, "block", chosen.row.block); }
else console.log("NO WINDOW");
