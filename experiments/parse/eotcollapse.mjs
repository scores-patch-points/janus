// eotcollapse.mjs <stanza.json> <label:file.conllu>|<group> ...: PREREG-EOT-PRIORS. Same delta tokens and structural priors as priorcollapse.mjs; adds the SURFACE, EOT-GOLD, EOT, COMBINED arms and the shuffled EOT twin. One run; any change after it is an erratum.
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { loadModel, analyse, readJson, loadSentences, parseConllu } from "./parselib.mjs"; import { mine, spectrum, dirOf, distOf, crosses } from "./priorlib.mjs";
import { recordsOf, surfaceRecord, newTables, mineInto, weightsE, totalE, base } from "./eotpriors.mjs";
const [stanzaF, ...specs] = process.argv.slice(2), O = path.join(os.homedir(), ".fold", "ud-parse-eval"), MP = loadModel(readJson(path.join(O, "pool", "ud-parser-eng-english-pool.json.gz")));
const GOLD = ["/Users/mlacy/Documents/data/ud/en_ewt/en_ewt-ud-train.conllu", "/Users/mlacy/Documents/janus-experiments/gum-raw/en_gum-ud-train.conllu"], SILVER = "/Users/mlacy/Documents/janus-experiments/silver/teacher.conllu";
const trainSents = GOLD.flatMap((f) => loadSentences(f)), T = mine(trainSents), rl = [...T.rels].sort(), mapTw = new Map(rl.map((r, i) => [r, rl[(i * 7 + 3) % rl.length]])), TWs = mine(trainSents, (r) => mapTw.get(r) ?? r);
const tw = (r) => mapTw.get(r) ?? r;
// ---- mining: GOLD (all arcs) and SILVER-AGREED (arcs where the teacher and our POOL parser agree), each through toEot
const G = newTables(), S = newTables(), GT = newTables(), ST = newTables(), Gs = newTables(), Ss = newTables(); const cnt = { goldSent: 0, goldRec: 0, silverSent: 0, silverRec: 0, silverArcs: 0 };
const rowsOfTok = (toks) => toks.map((t) => ({ form: t.form, lemma: t.lemma, upos: t.upos, head: t.head, deprel: t.deprel }));
for (const f of GOLD) for (const s of parseConllu(fs.readFileSync(f, "utf8"))) { if (!s.tokens.length || !s.tokens.every((t) => t.head !== null)) continue; const rows = rowsOfTok(s.tokens); cnt.goldSent++;
  for (const [id, r] of recordsOf(rows, s.sentId)) { mineInto(G, r); mineInto(GT, r, tw); cnt.goldRec++; } rows.forEach((r, i) => { if (r.upos !== "PUNCT") mineInto(Gs, surfaceRecord(rows, i, r.head, r.deprel)); }); }
for (const s of parseConllu(fs.readFileSync(SILVER, "utf8"))) { if (!s.tokens.length || !s.tokens.every((t) => t.head !== null)) continue; const rows = rowsOfTok(s.tokens), p = analyse(MP, rows.map((r) => r.form)); cnt.silverSent++;
  const rec = recordsOf(rows, s.sentId); rows.forEach((r, i) => { if (r.upos === "PUNCT") return; cnt.silverArcs++; if (p[i].head !== r.head || p[i].deprel !== r.deprel) return; const x = rec.get(i + 1); if (x) { mineInto(S, x); mineInto(ST, x, tw); cnt.silverRec++; } mineInto(Ss, surfaceRecord(rows, i, r.head, r.deprel)); }); }
console.error(`mined: gold ${cnt.goldSent} sentences ${cnt.goldRec} EOT records; silver ${cnt.silverSent} sentences, ${cnt.silverRec} of ${cnt.silverArcs} arcs agreed and kept`);
// ---- delta tokens
const stanza = JSON.parse(fs.readFileSync(stanzaF, "utf8")), byFile = new Map(); for (const s of stanza) { if (!byFile.has(s.file)) byFile.set(s.file, []); byFile.get(s.file).push(s); }
const groups = new Map(); for (const sp of specs) { const [label, group] = sp.split("|"), file = label.slice(label.indexOf(":") + 1), lab = label.slice(0, label.indexOf(":")); if (!groups.has(group ?? lab)) groups.set(group ?? lab, []); groups.get(group ?? lab).push({ lab, file }); }
const rowsOf = (s) => s.forms.map((f, i) => ({ upos: s.upos[i], head: s.head[i], deprel: s.deprel[i] }));
const ARMS = ["STRUCT", "SURFACE", "EOT-GOLD", "EOT", "COMBINED", "EOT-SHUF"], pct = (x, n) => (n ? (100 * x / n).toFixed(1).padStart(5) + "%" : "  n/a "), MS = [0, 0.5, 1, 2, 3, 4];
function tokensOf(files) { const out = [];
  for (const { file } of files) { const gold = loadSentences(file), SS = byFile.get(path.basename(file)) ?? []; let si = 0, gi = -1;
    for (const g of gold) { gi++; while (si < SS.length && SS[si].forms.join("\u0001") !== g.forms.join("\u0001")) si++; if (si >= SS.length) { si = 0; continue; } const s = rowsOf(SS[si++]), p = analyse(MP, g.forms);
      const cons = []; s.forEach((t, i) => { if (g.gold[i].upos !== "PUNCT" && t.head === p[i].head && t.deprel === p[i].deprel && t.head !== 0) cons.push([i, [Math.min(i + 1, t.head), Math.max(i + 1, t.head)]]); });
      const rowsA = s.map((t, i) => ({ form: g.forms[i], lemma: p[i].lemma ?? g.forms[i], upos: t.upos, head: t.head, deprel: t.deprel }));
      g.gold.forEach((gt, i) => { if (gt.upos === "PUNCT") return; const a = s[i], b = p[i]; if (a.head === b.head && a.deprel === b.deprel) return; const arcs = cons.filter(([j]) => j !== i).map((x) => x[1]);
        const mkc = (h, r) => ({ u: a.upos, r, hu: h === 0 ? "ROOT" : s[h - 1].upos, dir: dirOf(i, h), dist: distOf(i, h), cross: crosses(i, h, arcs) }), sp = spectrum(T, mkc(a.head, a.deprel), mkc(b.head, b.deprel));
        const rowsB = rowsA.map((r, j) => (j === i ? { ...r, head: b.head, deprel: b.deprel } : r)), rA = recordsOf(rowsA).get(i + 1), rB = recordsOf(rowsB).get(i + 1); if (!rA || !rB) return;
        const mE = (tabs, relab) => totalE(weightsE(tabs, relab ? { ...rA, rel: tw(rA.rel) } : rA)) - totalE(weightsE(tabs, relab ? { ...rB, rel: tw(rB.rel) } : rB));
        const sA = surfaceRecord(rowsA, i, a.head, a.deprel), sB = surfaceRecord(rowsA, i, b.head, b.deprel), mSurf = totalE(weightsE([Gs, Ss], sA)) - totalE(weightsE([Gs, Ss], sB)), mEot = mE([G, S]);
        out.push({ key: `${path.basename(file)}:${gi}:${i}`, m: { STRUCT: sp.margin, SURFACE: mSurf, "EOT-GOLD": mE([G]), EOT: mEot, COMBINED: sp.margin + mEot, "EOT-SHUF": mE([GT, ST], true) }, aRight: a.head === gt.head && a.deprel === gt.deprel, bRight: b.head === gt.head && b.deprel === gt.deprel }); }); } }
  return out; }
for (const [name, files] of groups) { const all = tokensOf(files), reach = all.filter((t) => t.aRight || t.bRight), nT = reach.filter((t) => t.aRight).length;
  console.log(`\n===== ${name}: ${all.length} disagreement tokens, ${reach.length} REACHABLE (teacher right ${nT}, ours right ${reach.length - nT}); always-teacher precision ${pct(nT, reach.length)}`);
  fs.writeFileSync(path.join(os.homedir(), "Documents/janus-experiments", `eotpriors-${name.replace(/\W+/g, "_")}.json`), JSON.stringify(reach.map((t) => ({ key: t.key, m: t.m, a: t.aRight, b: t.bRight }))));
  console.log("arm         " + MS.map((m) => `m=${m}`.padStart(15)).join("")); console.log("            " + MS.map(() => "  cov   prec  tchr").join(""));
  for (const arm of ARMS) { let line = arm.padEnd(12); for (const m of MS) { const c = reach.filter((t) => Math.abs(t.m[arm]) >= m && (m > 0 || true)), pick = (t) => (t.m[arm] >= 0 ? t.aRight : t.bRight), ok = c.filter(pick).length, tr = c.filter((t) => t.aRight).length; line += ` ${pct(c.length, reach.length).slice(0, 5)} ${pct(ok, c.length).slice(0, 5)} ${pct(tr, c.length).slice(0, 5)}`; } console.log(line); }
  console.log("VETO at m=1 (arm prefers OURS): ours right vs teacher right"); for (const arm of ARMS) { const c = reach.filter((t) => t.m[arm] <= -1); console.log(`  ${arm.padEnd(10)} tokens ${String(c.length).padStart(4)}  ours right ${pct(c.filter((t) => t.bRight).length, c.length)}  teacher right ${pct(c.filter((t) => t.aRight).length, c.length)}`); }
}
