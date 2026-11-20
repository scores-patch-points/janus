// confcheck.mjs <train.conllu>: CALIBRATION of the colony's competency score (the Penelope session's check, 2026-11-20). For every word-final cut candidate (a seeded sample of 100), the mean tagger-margin change over the sentences it changes, on REAL text and on a CHARACTER-PERMUTED copy (noise: no structure), scored two ways:
//   FULL  the colony's score: mean margin over ALL tokens of the changed sentence, cut minus glued (the new pieces are included)
//   CTX   the same over the CONTEXT tokens only: the tokens other than the cut token and its pieces, the same tokens in both versions
// A candidate is GOOD if its observed change beats the MAXIMUM of 30 random same-length cuts applied to the same sentences. By chance at most 1/31 = 3.2% should be good. On noise the good rate should be near that; a higher rate is a bias. DEV, exploratory; nothing is written.
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { tokenize } from "../../../khora/native/adapters/text/ud-tokenizer.js"; import { tagWithMargins } from "../../../khora/native/adapters/text/ud-parser.js"; import { loadModel, readJson } from "../parse/parselib.mjs";
import { candidateMoves, lcg, permuteTokens } from "./antlib.mjs";
const trainF = process.argv[2], DRAWS = 30, CAP = Number(process.argv[3] ?? 300), NC = Number(process.argv[4] ?? 100);
const raws = fs.readFileSync(trainF, "utf8").split("\n").filter((l) => l.startsWith("# text = ")).map((l) => l.slice(9)), sents = raws.map((r) => tokenize(r, null)), train = sents.flat();
const model = loadModel(readJson(path.join(os.homedir(), ".fold", "ud-parse-eval", "pool", "ud-parser-eng-english-pool.json.gz"))), tag = model.tagger, M = (ws) => tagWithMargins(tag, ws, null, null).margins;
const r1 = lcg(1), sample = sents.filter((s) => s.length >= 3).map((s) => [r1(), s]).sort((a, b) => a[0] - b[0]).slice(0, CAP).map((x) => x[1]);
const cands = candidateMoves(train).filter((m) => m.startsWith("cut:")).map((m) => m.slice(4)), r2 = lcg(2), picked = cands.map((c) => [r2(), c]).sort((a, b) => a[0] - b[0]).slice(0, NC).map((x) => x[1]);
const letter = (t) => [...t].some((c) => c.toLowerCase() !== c.toUpperCase()), mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
function cutAt(ws, idxs, L) { const out = [], keepG = [], keepC = []; ws.forEach((w, i) => { if (idxs.has(i)) { const c = [...w]; out.push(c.slice(0, c.length - L).join(""), c.slice(c.length - L).join("")); } else { keepG.push(i); keepC.push(out.length); out.push(w); } }); return { out, keepG, keepC }; }
const fin = (m) => (Number.isFinite(m) ? m : null);
function delta(ws, gm, cut) { const cm = M(cut.out), full = mean(cm.map(fin).filter((x) => x !== null)) - mean(gm.map(fin).filter((x) => x !== null)), pairs = cut.keepG.map((g, j) => [fin(cm[cut.keepC[j]]), fin(gm[g])]).filter((p) => p[0] !== null && p[1] !== null), ctx = mean(pairs.map((p) => p[0] - p[1])); return { full, ctx }; }
function run(sample_, label) {
  const gms = sample_.map(M), rnd = lcg(99); let goodFull = 0, goodCtx = 0, n = 0; const passersFull = [], passersCtx = [];
  for (const s of picked) { const L = [...s].length, rows = [];
    sample_.forEach((ws, i) => { const idx = new Set(ws.map((w, j) => (w.endsWith(s) && [...w].length > L && letter(w) ? j : -1)).filter((j) => j >= 0)); if (idx.size) rows.push({ ws, i, idx }); }); if (rows.length < 5) continue; n++;
    const obs = rows.map(({ ws, i, idx }) => delta(ws, gms[i], cutAt(ws, idx, L))), oF = mean(obs.map((x) => x.full)), oC = mean(obs.map((x) => x.ctx).filter((x) => x !== null)), nF = [], nC = [];
    for (let d = 0; d < DRAWS; d++) { const dd = rows.map(({ ws, i }) => { const c = ws.map((w, j) => j).filter((j) => [...ws[j]].length > L + 1 && letter(ws[j])); if (!c.length) return null; return delta(ws, gms[i], cutAt(ws, new Set([c[Math.floor(rnd() * c.length)]]), L)); }).filter(Boolean); nF.push(mean(dd.map((x) => x.full))); nC.push(mean(dd.map((x) => x.ctx).filter((x) => x !== null))); }
    if (oF > Math.max(...nF)) { goodFull++; passersFull.push(s); } if (oC > Math.max(...nC)) { goodCtx++; passersCtx.push(s); } }
  console.log(`${label.padEnd(28)} candidates scored ${n}: FULL good ${goodFull} (${(100 * goodFull / n).toFixed(1)}%)  CTX good ${goodCtx} (${(100 * goodCtx / n).toFixed(1)}%)   [chance at most 3.2%]`);
  console.log(`   FULL passers: ${passersFull.slice(0, 18).map((x) => JSON.stringify(x)).join(" ")}${passersFull.length > 18 ? " ..." : ""}\n   CTX passers:  ${passersCtx.slice(0, 18).map((x) => JSON.stringify(x)).join(" ")}${passersCtx.length > 18 ? " ..." : ""}`);
}
console.log(`stream ${train.length} tokens; ${cands.length} cut candidates, ${picked.length} sampled; ${sample.length} sentences; ${DRAWS} null draws per candidate`);
run(sample, "REAL text"); const perm = sample.map((ws, i) => permuteTokens(ws, 1000 + i)); run(perm, "NOISE (chars shuffled)");
