// derive-scene-params.mjs — derive the scene model's one parameter W (the number of paragraphs a being keeps a scene going) from the recurrence gaps of the SPENT fit windows, and the null that says what a gap means.
//   node derive-scene-params.mjs <text1> <ledger1> [<text2> <ledger2> ...]
// For every paragraph that names at least one being, and for every w = 1..WMAX, the OVERLAP RATE is the share of such paragraphs whose beings include one named in the previous w paragraphs of the same chapter. The null is the
// same rate with the paragraphs of each chapter shuffled (seeded, 1000 draws); a paragraph's overlap with the last w paragraphs counts as scene continuity only where the real rate stands above the null's p95. W is the smallest w at which the
// real rate's GAIN OVER THE NULL stops growing by at least one paragraph's worth of new continuity (a rate step smaller than 1/N for N = the number of paragraphs with beings): the scene's memory ends where more paragraphs add nothing beyond chance.
import fs from "node:fs";
import { paragraphsOf } from "./scene-kin.mjs";
const WMAX = 12, DRAWS = 1000;
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pct = (xs, p) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))]; };
export function chaptersOfBeings(text, ledger) {
  const paras = paragraphsOf(text), beings = new Set(ledger.referents.filter((r) => r.standing === "referent").map((r) => r.id));
  const inPara = paras.map(() => new Set()); const startOf = paras.map((p) => p.from);
  for (const sp of ledger.spans) { if (sp.kind !== "name" || !sp.ref || !beings.has(sp.ref)) continue; let lo = 0, hi = paras.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (startOf[m] <= sp.at[0]) lo = m; else hi = m - 1; } if (paras[lo] && sp.at[0] < paras[lo].to + 1) inPara[lo].add(sp.ref); }
  const chapters = []; paras.forEach((p, k) => { if (p.heading || !chapters.length) chapters.push([]); chapters[chapters.length - 1].push(inPara[k]); });
  return chapters;
}
const rate = (chapters, w) => { let n = 0, hit = 0; for (const ch of chapters) for (let k = 0; k < ch.length; k++) { if (!ch[k].size) continue; n++; let ok = false; for (let q = Math.max(0, k - w); q < k && !ok; q++) for (const r of ch[k]) if (ch[q].has(r)) { ok = true; break; } if (ok) hit++; } return n ? hit / n : 0; };
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), chapters = []; for (let i = 0; i < args.length; i += 2) chapters.push(...chaptersOfBeings(fs.readFileSync(args[i], "utf8"), JSON.parse(fs.readFileSync(args[i + 1], "utf8"))));
  const N = chapters.reduce((a, ch) => a + ch.filter((s) => s.size).length, 0), rng = mulberry32(20261028);
  const real = [], nullP95 = [];
  for (let w = 1; w <= WMAX; w++) {
    real.push(rate(chapters, w)); const d = [];
    for (let k = 0; k < DRAWS; k++) { const sh = chapters.map((ch) => { const a = ch.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }); d.push(rate(sh, w)); }
    nullP95.push(pct(d, 0.95));
  }
  const gain = real.map((r, i) => r - nullP95[i]); let W = WMAX;
  for (let w = 1; w < WMAX; w++) if (gain[w] - gain[w - 1] < 1 / N) { W = w; break; }      // gain[w] is the gain at w+1 paragraphs
  console.log(JSON.stringify({ paragraphs_with_beings: N, chapters: chapters.length, real: real.map((x) => +x.toFixed(4)), null_p95: nullP95.map((x) => +x.toFixed(4)), gain: gain.map((x) => +x.toFixed(4)), W }));
}
