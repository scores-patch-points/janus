// priorlib.mjs: PREREG-PRIOR-COLLAPSE (stamp in its .sha256short). Structural likelihood PRIORS mined from gold TRAIN (counts, treebank as giver, standing candidate) and the SPECTRUM of two candidate arcs with weights; both candidates are kept, the collapse is a use-time margin. No regex, no word list, no model.
export const base = (d) => String(d).split(":")[0], bD = (d) => (d <= 1 ? "1" : d === 2 ? "2" : d <= 4 ? "3-4" : d <= 8 ? "5-8" : "9+"), ALPHA = 1, FEATS = ["label", "headupos", "dir", "dist", "cross"];
export const dirOf = (i, h) => (h === 0 ? "root" : h < i + 1 ? "R" : "L"), distOf = (i, h) => (h === 0 ? "root" : bD(Math.abs(h - (i + 1))));
/** does the arc (i+1 <- h) cross any arc in `arcs` ([[a, b], ...] over 1-based positions)? interleaved endpoints only; root arcs never cross */
export function crosses(i, h, arcs) { if (h === 0) return false; const a = Math.min(i + 1, h), b = Math.max(i + 1, h); for (const [c, d] of arcs) { if ((a < c && c < b && b < d) || (c < a && a < d && d < b)) return true; } return false; }
const bump = (m, k1, k2) => { if (!m.has(k1)) m.set(k1, new Map()); const x = m.get(k1); x.set(k2, (x.get(k2) ?? 0) + 1); };
/** mine the five tables from gold sentences [{ gold: [{upos, head, deprel}] }]; relabel(r) lets the twin permute relation labels */
export function mine(sentences, relabel = (r) => r) {
  const T = { label: new Map(), headupos: new Map(), dir: new Map(), dist: new Map(), cross: new Map(), rels: new Set(), upos: new Set(), hup: new Set(), n: 0 };
  for (const s of sentences) { const g = s.gold, arcs = g.map((t, i) => (t.upos === "PUNCT" || t.head === 0 ? null : [Math.min(i + 1, t.head), Math.max(i + 1, t.head)]));
    g.forEach((t, i) => { if (t.upos === "PUNCT") return; const r = relabel(base(t.deprel)), hu = t.head === 0 ? "ROOT" : g[t.head - 1].upos; T.rels.add(r); T.upos.add(t.upos); T.hup.add(hu); T.n++;
      bump(T.label, t.upos, r); bump(T.headupos, r, hu); bump(T.dir, r, dirOf(i, t.head)); bump(T.dist, r, distOf(i, t.head)); bump(T.cross, r, crosses(i, t.head, arcs.filter((a, j) => a && j !== i)) ? "yes" : "no"); }); }
  return T;
}
const lp = (map, k1, k2, K) => { const row = map.get(k1), tot = row ? [...row.values()].reduce((a, b) => a + b, 0) : 0, c = row?.get(k2) ?? 0; return Math.log2((c + ALPHA) / (tot + ALPHA * K)); };
/** the five log2 weights of a candidate arc (child UPOS u, relation r, head UPOS hu, direction, distance, crossing) */
export function weights(T, { u, r, hu, dir, dist, cross }) { r = base(r); return { label: lp(T.label, u, r, T.rels.size), headupos: lp(T.headupos, r, hu, T.hup.size), dir: lp(T.dir, r, dir, 3), dist: lp(T.dist, r, dist, 6), cross: lp(T.cross, r, cross ? "yes" : "no", 2) }; }
export const total = (w, skip = null, only = null) => FEATS.reduce((a, k) => a + ((skip && k === skip) || (only && k !== only) ? 0 : w[k]), 0);
/** the SPECTRUM of two candidates: both stay; margin = log2 weight(A) - log2 weight(B); normalized weights; `collapse(m)` commits only at use */
export function spectrum(T, A, B) { const wa = weights(T, A), wb = weights(T, B), margin = total(wa) - total(wb), pa = 1 / (1 + Math.pow(2, -margin)); return { A: { ...A, w: wa }, B: { ...B, w: wb }, margin, weight: { A: pa, B: 1 - pa }, held: true }; }
export const collapse = (sp, m) => (Math.abs(sp.margin) >= m ? (sp.margin >= 0 ? "A" : "B") : "HELD");
