// fit-kind-kin.mjs — the kind-induction arm on the four SPENT windows (the fit set): the three of the earlier passes (page-lens golds) and block 79 (the scene-lens gold of scene-model-5). Fit numbers are NOT evidence.
//   BEINGS_DIR=<dir with beings-dev.json, -heldout, -window2, -window3> POLARITY=<polarity-lexicon-ru.json> KIN_ROWS=<kin-store-rows.json> WINDOW2_TEXT=<lines 10467-10620> WINDOW3_TEXT=<lines 23441-23716> node fit-kind-kin.mjs [--verbose]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extract } from "./extract-kin.mjs";
import { loadPriors } from "./bind-kin2.mjs";
import { prepare, apply, segment } from "./scene-kin.mjs";
import { prepareKind, applyKind } from "./kind-kin.mjs";
const here = path.dirname(fileURLToPath(import.meta.url)), G = path.join(here, "kin-binder-gold"), priors = loadPriors(), env = process.env;
const FIT = [
  { name: "dev I-IV", text: env.DEV_TEXT ?? "/Users/mlacy/Downloads/workspace/Zenodotus/11-multi-language/war-and-peace/ru/voyna-i-mir_Tolstoy_wikisource.txt", ledger: "ledger-dev.json", gold: "gold-dev.json", beings: "beings-dev.json" },
  { name: "heldout V-VIII", text: env.HELDOUT_TEXT ?? "/Users/mlacy/Downloads/workspace/foldcode-answer-heldout/heldout-text.txt", ledger: "ledger-heldout.json", gold: "gold-heldout.json", beings: "beings-heldout.json" },
  { name: "window2", text: env.WINDOW2_TEXT, ledger: "ledger-window2.json", gold: "gold-window2.json", beings: "beings-window2.json" },
  { name: "window3 (block 79)", text: env.WINDOW3_TEXT, ledger: "ledger-scene-window3.json", gold: "gold-scene-window3.json", beings: "beings-window3.json" },
];
const verbose = process.argv.includes("--verbose"), j = (f) => JSON.parse(fs.readFileSync(f, "utf8")), polarity = j(env.POLARITY), kinRows = j(env.KIN_ROWS);
const tot = {};
for (const w of FIT) {
  const text = fs.readFileSync(w.text, "utf8"), ledger = j(path.join(G, w.ledger)), gold = j(path.join(G, w.gold)), beingRows = j(path.join(env.BEINGS_DIR, w.beings));
  const extraction = extract({ text, lang: "ru", lexicon: priors.lexicon, namePartsRu: priors.nameParts });
  const K = prepareKind({ text, ledger, extraction, priors, beingRows, polarity, kinRows, induction: env.INDUCTION ?? "company" }), P = prepare({ text, ledger, extraction, priors });
  const kc = {}; for (const k of K.kinds.values()) { const key = k.person ? "person" + (k.sex ? ":" + k.sex : ":?") : "non"; kc[key] = (kc[key] ?? 0) + 1; }
  console.log(`== ${w.name}: ${extraction.stmts.length} statements; kinds ${JSON.stringify(kc)}; polarity read ${JSON.stringify(applyKind(K).counts.polarity_read)}`);
  const arms = { T2: P.base, S3: apply(P, { tier: 3, scenes: segment(P) }), K: applyKind(K), "K-lenientSex": applyKind(K, { sexStrict: false }), "K-strictSex": applyKind(K, { sexStrict: true }), KG0: applyKind(K, { gate: false }), KP0: applyKind(K, { polarityOn: false }) };
  for (const [name, r] of Object.entries(arms)) {
    let bound = 0, correct = 0, wrongNull = 0, facts = 0, factsOk = 0; const byRule = {};
    r.statements.forEach((s, i) => { if (extraction.stmts[i].cat === "A") return; const g = gold.statements[i];
      for (const e of ["holder", "possessor"]) if (s[e].ref) { bound++; const ok = s[e].ref === g[e].ref; if (ok) correct++; else if (!g[e].ref) wrongNull++; const q = (byRule[s[e].rule] ??= { b: 0, ok: 0 }); q.b++; if (ok) q.ok++;
        if (verbose && name === "K" && /^K-/.test(s[e].rule)) console.log("  ", w.name, i, s.term, e, s[e].rule, ok ? "OK" : g[e].ref ? "WRONG(gold:" + g[e].kind + ")" : "NULLGOLD(" + g[e].why + ")", "|", s[e].text); }
      if (s.holder.ref && s.possessor.ref && s.fact !== null || (s.holder.ref && s.possessor.ref && name.startsWith("T2"))) { facts++; if (s.holder.ref === g.holder.ref && s.possessor.ref === g.possessor.ref) factsOk++; } });
    const t = (tot[name] ??= { bound: 0, correct: 0, facts: 0, factsOk: 0 }); t.bound += bound; t.correct += correct; t.facts += facts; t.factsOk += factsOk;
    console.log(`  ${name.padEnd(13)} bound ${String(bound).padStart(3)} correct ${String(correct).padStart(3)} wrong-where-gold-null ${String(wrongNull).padStart(2)} precision ${bound ? (correct / bound).toFixed(3) : "—"} facts ${facts} (right ${factsOk}) ${verbose ? JSON.stringify(byRule) : ""}`);
  }
}
console.log("== pooled over the four windows");
for (const [name, t] of Object.entries(tot)) console.log(`  ${name.padEnd(13)} bound ${t.bound} correct ${t.correct} precision ${t.bound ? (t.correct / t.bound).toFixed(3) : "—"} facts ${t.facts} right ${t.factsOk}`);
