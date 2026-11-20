// priorcollapse.mjs <stanza.json> <label:file.conllu> [<label:file.conllu> ...]: PREREG-PRIOR-COLLAPSE. Reports the sweep, the ablation, the twin and the veto for the disagreement tokens of each LABELLED GROUP of sets (labels joined by "+" are pooled: "LinES+ParTUT"). The gold of the TEST sets is read only to score; the priors are mined from gold TRAIN only.
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { loadModel, analyse, readJson, loadSentences } from "./parselib.mjs"; import { mine, weights, spectrum, collapse, crosses, total, base, dirOf, distOf, FEATS } from "./priorlib.mjs";
const [stanzaF, ...specs] = process.argv.slice(2), O = path.join(os.homedir(), ".fold", "ud-parse-eval"), MP = loadModel(readJson(path.join(O, "pool", "ud-parser-eng-english-pool.json.gz")));
const trainSents = [...loadSentences("/Users/mlacy/Documents/data/ud/en_ewt/en_ewt-ud-train.conllu"), ...loadSentences("/Users/mlacy/Documents/janus-experiments/gum-raw/en_gum-ud-train.conllu")];
const T = mine(trainSents); let k = 0; const rl = [...T.rels].sort(), perm = rl.map((_, i) => rl[(i * 7 + 3) % rl.length]), mapTw = new Map(rl.map((r, i) => [r, perm[i]])); const TW = mine(trainSents, (r) => mapTw.get(r) ?? r);
console.error(`priors mined from ${trainSents.length} gold train sentences, ${T.n} non-punctuation arcs, ${T.rels.size} relations`);
const stanza = JSON.parse(fs.readFileSync(stanzaF, "utf8")), byFile = new Map(); for (const s of stanza) { if (!byFile.has(s.file)) byFile.set(s.file, []); byFile.get(s.file).push(s); }
const groups = new Map(); for (const sp of specs) { const [label, group] = sp.split("|"), file = label.slice(label.indexOf(":") + 1), lab = label.slice(0, label.indexOf(":")); if (!groups.has(group ?? lab)) groups.set(group ?? lab, []); groups.get(group ?? lab).push({ lab, file }); }
const rowsOf = (s) => s.forms.map((f, i) => ({ upos: s.upos[i], head: s.head[i], deprel: s.deprel[i] }));
function tokensOf(files) {
  const out = []; for (const { lab, file } of files) { const gold = loadSentences(file), S = byFile.get(path.basename(file)) ?? []; let si = 0;
    for (const g of gold) { while (si < S.length && S[si].forms.join("\u0001") !== g.forms.join("\u0001")) si++; if (si >= S.length) { si = 0; continue; } const s = rowsOf(S[si++]), p = analyse(MP, g.forms), n = g.forms.length;
      const cons = []; s.forEach((t, i) => { if (g.gold[i].upos !== "PUNCT" && t.head === p[i].head && t.deprel === p[i].deprel && t.head !== 0) cons.push([i, [Math.min(i + 1, t.head), Math.max(i + 1, t.head)]]); });
      g.gold.forEach((gt, i) => { if (gt.upos === "PUNCT") return; const a = s[i], b = p[i]; if (a.head === b.head && a.deprel === b.deprel) return; const arcs = cons.filter(([j]) => j !== i).map((x) => x[1]), mkc = (h, r) => ({ u: a.upos, r, hu: h === 0 ? "ROOT" : s[h - 1].upos, dir: dirOf(i, h), dist: distOf(i, h), cross: crosses(i, h, arcs) }); const A = mkc(a.head, a.deprel), B = mkc(b.head, b.deprel);
        out.push({ lab, sp: spectrum(T, A, B), spTw: spectrum(TW, A, B), aRight: a.head === gt.head && a.deprel === gt.deprel, bRight: b.head === gt.head && b.deprel === gt.deprel }); }); } }
  return out;
}
const pct = (x, n) => (n ? (100 * x / n).toFixed(1).padStart(5) + "%" : "  n/a ");
const MS = [0, 0.5, 1, 2, 3, 4];
for (const [name, files] of groups) {
  const all = tokensOf(files), reach = all.filter((t) => t.aRight || t.bRight); console.log(`\n===== ${name}: ${all.length} disagreement tokens, ${reach.length} REACHABLE (the gold equals the teacher's or ours: teacher ${reach.filter((t) => t.aRight).length}, ours ${reach.filter((t) => t.bRight).length}), ${all.length - reach.length} unreachable`);
  const rate = (arr, f) => arr.filter(f).length, sweep = (items, label, margin = (t) => t.sp.margin) => { console.log(`${label}\n   m      coverage   precision   | same tokens: always-teacher  always-ours`); for (const m of MS) { const c = items.filter((t) => Math.abs(margin(t)) >= m), pick = (t) => (margin(t) >= 0 ? t.aRight : t.bRight), ok = rate(c, pick); console.log(`   ${String(m).padEnd(5)}  ${pct(c.length, items.length)} (${String(c.length).padStart(4)})  ${pct(ok, c.length)}   | ${pct(rate(c, (t) => t.aRight), c.length)}          ${pct(rate(c, (t) => t.bRight), c.length)}`); } };
  sweep(reach, "PRIORS (all five), collapse at use: coverage = share of reachable tokens collapsed:");
  sweep(reach, "TWIN (relation labels shuffled in the mined tables):", (t) => t.spTw.margin);
  console.log("ABLATION at m = 1 (precision on collapsed reachable tokens, coverage in brackets):"); for (const f of FEATS) { const only = (t) => total(t.sp.A.w, null, f) - total(t.sp.B.w, null, f), drop = (t) => total(t.sp.A.w, f) - total(t.sp.B.w, f), co = reach.filter((t) => Math.abs(only(t)) >= 1), cd = reach.filter((t) => Math.abs(drop(t)) >= 1); console.log(`   ${f.padEnd(9)} alone ${pct(rate(co, (t) => (only(t) >= 0 ? t.aRight : t.bRight)), co.length)} (${pct(co.length, reach.length)})   left out ${pct(rate(cd, (t) => (drop(t) >= 0 ? t.aRight : t.bRight)), cd.length)} (${pct(cd.length, reach.length)})`); }
  console.log("VETO: reachable tokens where the priors prefer OURS at margin m (negative margin): ours right vs teacher right"); for (const m of MS) { const c = reach.filter((t) => t.sp.margin <= -m && (m > 0 || t.sp.margin < 0)); console.log(`   m ${String(m).padEnd(4)} tokens ${String(c.length).padStart(4)}   ours right ${pct(rate(c, (t) => t.bRight), c.length)}   teacher right ${pct(rate(c, (t) => t.aRight), c.length)}`); }
  const wt = reach.filter((t) => Math.abs(t.sp.margin) < 0.5).length; console.log(`HELD at m = 0.5: ${wt} of ${reach.length} reachable tokens (${pct(wt, reach.length)}) stay in the spectrum with both candidates and their weights`);
}
