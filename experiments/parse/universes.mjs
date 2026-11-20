// universes.mjs <stanza.json> <label:file.conllu>|<group> ...: PREREG-UNIVERSES (+ADDENDUM-1). Same inputs and priors as priorcollapse.mjs. One run; any change after is an erratum.
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { loadModel, analyse, readJson, loadSentences } from "./parselib.mjs"; import { mine, spectrum, dirOf, distOf, crosses } from "./priorlib.mjs"; import { universes, marginalB, family, validTree } from "./univlib.mjs";
const [stanzaF, ...specs] = process.argv.slice(2), O = path.join(os.homedir(), ".fold", "ud-parse-eval"), MP = loadModel(readJson(path.join(O, "pool", "ud-parser-eng-english-pool.json.gz")));
const trainSents = [...loadSentences("/Users/mlacy/Documents/data/ud/en_ewt/en_ewt-ud-train.conllu"), ...loadSentences("/Users/mlacy/Documents/janus-experiments/gum-raw/en_gum-ud-train.conllu")];
const T = mine(trainSents), rl = [...T.rels].sort(), mapTw = new Map(rl.map((r, i) => [r, rl[(i * 7 + 3) % rl.length]])), TW = mine(trainSents, (r) => mapTw.get(r) ?? r);
const M = 1, K = 6, ALIVE = 0.2;
const stanza = JSON.parse(fs.readFileSync(stanzaF, "utf8")), byFile = new Map(); for (const s of stanza) { if (!byFile.has(s.file)) byFile.set(s.file, []); byFile.get(s.file).push(s); }
const groups = new Map(); for (const sp of specs) { const [label, group] = sp.split("|"), file = label.slice(label.indexOf(":") + 1), lab = label.slice(0, label.indexOf(":")); if (!groups.has(group ?? lab)) groups.set(group ?? lab, []); groups.get(group ?? lab).push({ lab, file }); }
const rowsOf = (s) => s.forms.map((f, i) => ({ upos: s.upos[i], head: s.head[i], deprel: s.deprel[i] }));
const pct = (x, n) => (n ? (100 * x / n).toFixed(1) + "%" : "n/a"), q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : 0; };
for (const [name, files] of groups) {
  const C = { sent: 0, withFork: 0, complete: 0, capBound: 0, combos: 0, validCombos: 0, m1U: 0, m1T: 0, m1P: 0, m1O: 0, top: { U: 0, SHUF: 0, UNI: 0, P: 0 }, lg: { U: 0, SHUF: 0, UNI: 0 }, famInv: 0, famInvOk: 0, famInvTeacherOk: 0, famTot: 0, famHeld: 0, subjInv: 0, subjInvOk: 0, subjInvTeacherOk: 0, subjTot: 0 }, nU = [];
  for (const { file } of files) { const gold = loadSentences(file), S = byFile.get(path.basename(file)) ?? []; let si = 0;
    for (const g of gold) { while (si < S.length && S[si].forms.join("\u0001") !== g.forms.join("\u0001")) si++; if (si >= S.length) { si = 0; continue; } const s = rowsOf(S[si++]), p = analyse(MP, g.forms); C.sent++;
      const cons = []; s.forEach((t, i) => { if (g.gold[i].upos !== "PUNCT" && t.head === p[i].head && t.deprel === p[i].deprel && t.head !== 0) cons.push([i, [Math.min(i + 1, t.head), Math.max(i + 1, t.head)]]); });
      const cand = []; g.gold.forEach((gt, i) => { if (gt.upos === "PUNCT") return; const a = s[i], b = p[i]; if (a.head === b.head && a.deprel === b.deprel) return; const arcs = cons.filter(([j]) => j !== i).map((x) => x[1]);
        const mkc = (h, r) => ({ u: a.upos, r, hu: h === 0 ? "ROOT" : s[h - 1].upos, dir: dirOf(i, h), dist: distOf(i, h), cross: crosses(i, h, arcs) }), A = mkc(a.head, a.deprel), B = mkc(b.head, b.deprel), sp = spectrum(T, A, B), spTw = spectrum(TW, A, B);
        cand.push({ i, A: { head: a.head, rel: a.deprel }, B: { head: b.head, rel: b.deprel }, margin: sp.margin, pA: sp.weight.A, pTw: spTw.weight.A, aRight: a.head === gt.head && a.deprel === gt.deprel, bRight: b.head === gt.head && b.deprel === gt.deprel }); });
      const held = cand.filter((c) => Math.abs(c.margin) < M).sort((x, y) => Math.abs(x.margin) - Math.abs(y.margin)); if (!held.length) continue; C.withFork++;
      const forks = held.slice(0, K); if (held.length > K) C.capBound++;
      const base = s.map((t) => t.head), forkSet = new Set(forks.map((f) => f.i)); for (const c of cand) if (!forkSet.has(c.i)) base[c.i] = Math.abs(c.margin) >= M && c.margin < 0 ? c.B.head : c.A.head;   // collapsed by priors at m=1, else the teacher
      if (!forks.every((f) => f.aRight || f.bRight)) continue; C.complete++;
      const us = universes(base, forks), valid = us.filter((u) => u.valid); C.combos += us.length; C.validCombos += valid.length; nU.push(valid.length);
      const goldMask = forks.reduce((m, f, k) => m | ((f.bRight && !f.aRight ? 1 : 0) << k), 0), goldU = us.find((u) => u.mask === goldMask);
      // gold universe: where both candidates equal the gold (aRight and bRight) the mask bit is 0 by the same arc
      const present = !!goldU && goldU.valid; if (present) C.m1U++;
      const exact = (pick) => forks.every((f) => (pick(f) ? f.bRight : f.aRight)); if (exact(() => false)) C.m1T++; if (exact((f) => f.pA < 0.5)) C.m1P++; if (exact(() => true)) C.m1O++;
      const rank = (arr) => arr.slice().sort((a, b) => b.w - a.w);
      const wU = universes(base, forks).filter((u) => u.valid), wS = universes(base, forks, (f) => f.pTw).filter((u) => u.valid), wN = universes(base, forks, () => 0.5).filter((u) => u.valid);
      const topOk = (arr) => { const t = rank(arr)[0]; return t && t.mask === goldMask; }, lg = (arr) => { const u = arr.find((x) => x.mask === goldMask); return u && u.p > 0 ? Math.log2(u.p) : -20; };
      if (topOk(wU)) C.top.U++; if (topOk(wS)) C.top.SHUF++; if (topOk(wN)) C.top.UNI++; if (exact((f) => f.pA < 0.5)) C.top.P++;
      C.lg.U += lg(wU); C.lg.SHUF += lg(wS); C.lg.UNI += lg(wN);
      // M3 questions over the ALIVE candidates
      const alive = forks.map((f, k) => { const mb = marginalB(us, k); return { A: 1 - mb >= ALIVE, B: mb >= ALIVE }; });
      forks.forEach((f, k) => { const fa = family(f.A.rel), fb = family(f.B.rel), set = new Set([alive[k].A ? fa : null, alive[k].B ? fb : null].filter(Boolean)), gf = family(g.gold[f.i].deprel); C.famTot++;
        if (set.size === 1) { C.famInv++; if ([...set][0] === gf) C.famInvOk++; if (fa === gf) C.famInvTeacherOk++; } else C.famHeld++; });
      const subj = (heads, rels) => rels.map((r, i) => (String(r).split(":")[0] === "nsubj" ? i : -1)).filter((i) => i >= 0).join(","), goldSubj = subj(null, g.gold.map((t) => t.deprel));
      const aliveMasks = valid.filter((u) => forks.every((f, k) => ((u.mask >> k) & 1 ? alive[k].B : alive[k].A))), relsOf = (u) => s.map((t, i) => { const k = forks.findIndex((f) => f.i === i); return k < 0 ? (cand.find((c) => c.i === i) ? (Math.abs(cand.find((c) => c.i === i).margin) >= M && cand.find((c) => c.i === i).margin < 0 ? p[i].deprel : t.deprel) : t.deprel) : (u.mask >> k) & 1 ? forks[k].B.rel : forks[k].A.rel; });
      const answers = new Set(aliveMasks.map((u) => subj(null, relsOf(u)))); C.subjTot++;
      if (answers.size === 1) { C.subjInv++; if ([...answers][0] === goldSubj) C.subjInvOk++; if (subj(null, s.map((t) => t.deprel)) === goldSubj) C.subjInvTeacherOk++; } } }
  const n = C.complete; console.log(`\n===== ${name}: ${C.sent} sentences, ${C.withFork} with a forked token (|margin|<${M}), ${n} COMPLETE (every forked token reachable); K-cap bound in ${C.capBound}`);
  console.log(`M1 presence: gold universe among valid universes ${pct(C.m1U, n)}; exact match on forked tokens: teacher ${pct(C.m1T, n)}, priors-forced ${pct(C.m1P, n)}, ours ${pct(C.m1O, n)}`);
  console.log(`M2 top-weight universe is the gold one: UNIV ${pct(C.top.U, n)}, SHUF twin ${pct(C.top.SHUF, n)}, UNIFORM twin ${pct(C.top.UNI, n)}, SINGLE-P ${pct(C.top.P, n)}; mean log2 weight of the gold universe: UNIV ${(C.lg.U / n).toFixed(2)}, SHUF ${(C.lg.SHUF / n).toFixed(2)}, UNIFORM ${(C.lg.UNI / n).toFixed(2)}`);
  console.log(`M3 Q-FAM: ${C.famTot} forked tokens, invariant ${pct(C.famInv, C.famTot)} (invariant answers right ${pct(C.famInvOk, C.famInv)} vs teacher ${pct(C.famInvTeacherOk, C.famInv)} on the same), HELD ${pct(C.famHeld, C.famTot)}`);
  console.log(`M3 Q-SUBJ: ${C.subjTot} sentences, invariant ${pct(C.subjInv, C.subjTot)} (invariant answers right ${pct(C.subjInvOk, C.subjInv)} vs teacher ${pct(C.subjInvTeacherOk, C.subjInv)} on the same)`);
  console.log(`M4 cost: valid universes per sentence median ${q(nU, 0.5)}, 95th ${q(nU, 0.95)}; validity pruned ${pct(C.combos - C.validCombos, C.combos)} of combinations`);
}
