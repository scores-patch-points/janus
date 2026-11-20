// parselib.mjs: the computed-codec arms of PREREG-PARSE-ENGLISH-LAYERS over khora's UDParser@1 models (averaged perceptrons). No regex, no word list, no model judging.
//   blend(A, B, wA, wB)  the weighted average of two models' weight tables, classes aligned by NAME (a feature absent from one model is weight 0 in it); the label sets are united; nothing is retrained
//   permuted(B, seed)    the strings-only twin: B's weight vectors permuted among B's feature keys (the same weights, the association with the feature destroyed)
//   mbr(cands)           the candidate analysis that agrees most (head and label, non-punctuation) with the others; ties go to the LAST candidate (the pooled model)
import fs from "node:fs"; import zlib from "node:zlib";
const KH = process.env.KHORA ?? "/Users/mlacy/Documents/khora";
export const { loadModel, analyse } = await import(`${KH}/native/adapters/text/ud-parser.js`);
export const { parseConllu } = await import(`${KH}/native/kernel/eot-rich.js`);
export const readJson = (f) => JSON.parse(f.endsWith(".gz") ? zlib.gunzipSync(fs.readFileSync(f)) : fs.readFileSync(f, "utf8"));
const unionList = (a, b) => { const out = [...a], seen = new Set(a); for (const x of b) if (!seen.has(x)) { seen.add(x); out.push(x); } return out; };
function blendTable(P, Q, wP, wQ) {
  const classes = unionList(P.classes, Q.classes), at = new Map(classes.map((c, i) => [c, i])), mapP = P.classes.map((c) => at.get(c)), mapQ = Q.classes.map((c) => at.get(c)), w = {};
  const put = (acc, vec, map, wt) => { for (let i = 0; i < vec.length; i += 2) { const c = map[vec[i]]; acc.set(c, (acc.get(c) ?? 0) + wt * vec[i + 1]); } };
  for (const key of unionList(Object.keys(P.w), Object.keys(Q.w))) { const acc = new Map(); if (P.w[key]) put(acc, P.w[key], mapP, wP); if (Q.w[key]) put(acc, Q.w[key], mapQ, wQ); const flat = []; for (const c of [...acc.keys()].sort((x, y) => x - y)) flat.push(c, +acc.get(c).toFixed(6)); w[key] = flat; }
  return { ...P, classes, w };
}
/** blend of two model JSONs (the files' contents), as a model JSON; lexicon and meta follow A and say what the model is */
export function blendJson(A, B, wA = 0.5, wB = 0.5) { return { ...A, labels: unionList(A.labels, B.labels), tagger: blendTable(A.tagger, B.tagger, wA, wB), parser: blendTable(A.parser, B.parser, wA, wB), meta: { ...A.meta, blend: { wA, wB, of: [A.meta?.treebank, B.meta?.treebank] } } }; }
const rng = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
export function permutedJson(B, seed = 20261119) {
  const r = rng(seed), perm = (T) => { const keys = Object.keys(T.w), vals = keys.map((k) => T.w[k]); for (let i = vals.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [vals[i], vals[j]] = [vals[j], vals[i]]; } const w = {}; keys.forEach((k, i) => { w[k] = vals[i]; }); return { ...T, w }; };
  return { ...B, tagger: perm(B.tagger), parser: perm(B.parser) };
}
export const agreement = (rowsA, rowsB) => { let n = 0; for (let i = 0; i < rowsA.length; i++) { if (rowsA[i].upos === "PUNCT") continue; if (rowsA[i].head === rowsB[i].head && rowsA[i].deprel === rowsB[i].deprel) n++; } return n; };
export function mbr(cands) { let best = -1, pick = cands.length - 1; cands.forEach((c, i) => { let s = 0; cands.forEach((d, j) => { if (i !== j) s += agreement(c, d); }); if (s > best || (s === best && i === cands.length - 1)) { best = s; pick = i; } }); return cands[pick]; }
/** conllu -> [{ doc, forms, gold: [{upos, head, deprel}] }]; the document id is the last '# newdoc id' comment seen */
export function loadSentences(file) {
  const out = []; let doc = "doc0", seenDoc = false;
  for (const s of parseConllu(fs.readFileSync(file, "utf8"))) {
    for (const c of s.comments ?? []) if (c.startsWith("# newdoc id")) { doc = c.split("=").slice(1).join("=").trim(); seenDoc = true; }
    if (!s.tokens.length || !s.tokens.every((t) => t.head !== null)) continue;
    out.push({ doc, forms: s.tokens.map((t) => t.form), gold: s.tokens.map((t) => ({ upos: t.upos, head: t.head, deprel: t.deprel })) });
  }
  return out;
}
export function score(rows, gold) { let u = 0, a = 0, l = 0, nnp = 0; rows.forEach((r, i) => { const g = gold[i]; if (r.upos === g.upos) u++; if (g.upos === "PUNCT") return; nnp++; if (r.head === g.head) { a++; if (r.deprel === g.deprel) l++; } }); return { n: gold.length, nnp, u, a, l }; }
