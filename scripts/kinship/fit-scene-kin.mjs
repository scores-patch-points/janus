// fit-scene-kin.mjs — the scene model on the three SPENT windows (the fit set), against the page-lens golds of the earlier passes. Fit numbers are NOT evidence: the model was built looking at these windows.
//   WINDOW2_TEXT=<full-text lines 10467 to 10620> [DEV_TEXT=<chapters I to IV>] [HELDOUT_TEXT=<chapters V to VIII>] node fit-scene-kin.mjs [--verbose]   (the defaults are the paths on the author's machine; the texts are identified by sha256 in PREREG-KIN-BINDER.md and -2)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extract } from "./extract-kin.mjs";
import { loadPriors } from "./bind-kin2.mjs";
import { prepare, apply, segment } from "./scene-kin.mjs";
const here = path.dirname(fileURLToPath(import.meta.url)), G = path.join(here, "kin-binder-gold"), priors = loadPriors();
export const FIT = [
  { name: "dev I-IV", text: process.env.DEV_TEXT ?? "/Users/mlacy/Downloads/workspace/Zenodotus/11-multi-language/war-and-peace/ru/voyna-i-mir_Tolstoy_wikisource.txt", ledger: "ledger-dev.json", gold: "gold-dev.json" },
  { name: "heldout V-VIII", text: process.env.HELDOUT_TEXT ?? "/Users/mlacy/Downloads/workspace/foldcode-answer-heldout/heldout-text.txt", ledger: "ledger-heldout.json", gold: "gold-heldout.json" },
  { name: "window2", text: process.env.WINDOW2_TEXT, ledger: "ledger-window2.json", gold: "gold-window2.json" },
];
const verbose = process.argv.includes("--verbose");
for (const w of FIT) {
  const text = fs.readFileSync(w.text, "utf8"), ledger = JSON.parse(fs.readFileSync(path.join(G, w.ledger), "utf8")), gold = JSON.parse(fs.readFileSync(path.join(G, w.gold), "utf8"));
  const extraction = extract({ text, lang: "ru", lexicon: priors.lexicon, namePartsRu: priors.nameParts }), P = prepare({ text, ledger, extraction, priors }), scenes = segment(P);
  console.log(`== ${w.name}: ${extraction.stmts.length} statements, ${scenes.length} scenes over ${P.paras.length} paragraphs (sizes ${scenes.map((s) => s.to - s.from + 1).join(",")})`);
  const arms = { T2: P.base, ...Object.fromEntries([1, 2, 3].map((t) => [`S${t}`, apply(P, { tier: t, scenes })])), A0: apply(P, { tier: 3, mode: "paragraph", scenes }) };
  for (const [name, r] of Object.entries(arms)) {
    let bound = 0, correct = 0, wrongGold = 0, wrongNull = 0, facts = 0, factsOk = 0; const byRule = {};
    r.statements.forEach((s, i) => { if (extraction.stmts[i].cat === "A") return; const g = gold.statements[i];
      for (const e of ["holder", "possessor"]) if (s[e].ref) { bound++; const ok = s[e].ref === g[e].ref; if (ok) correct++; else if (g[e].ref) wrongGold++; else wrongNull++; const q = (byRule[s[e].rule] ??= { b: 0, ok: 0, nullgold: 0 }); q.b++; if (ok) q.ok++; else if (!g[e].ref) q.nullgold++;
        if (verbose && name === "S3" && /^(S-|K-)/.test(s[e].rule)) console.log("  ", w.name, i, s.term, e, s[e].rule, ok ? "OK" : g[e].ref ? "WRONG(gold:" + g[e].kind + ")" : "NULLGOLD(" + g[e].why + ")", "|", s[e].text); }
      if (s.holder.ref && s.possessor.ref) { facts++; if (s.holder.ref === g.holder.ref && s.possessor.ref === g.possessor.ref) factsOk++; } });
    console.log(`  ${name}: bound ${bound} correct ${correct} wrong-where-gold-bound ${wrongGold} wrong-where-gold-null ${wrongNull} precision ${bound ? (correct / bound).toFixed(3) : "—"} facts ${facts} (right ${factsOk}) ${JSON.stringify(byRule)}`);
  }
}
