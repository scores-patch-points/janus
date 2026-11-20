// kinds.mjs <fg.json> <out.json>: ADDENDUM-3 of PREREG-CLAIM-GRAPH-UNIVERSE. The kind of each anchor class, INDUCED from its relation profile by khora's own organ (kernel/entity-kind-induction.js), never from its name.
// Profile features per class (what it takes part in): dep:<base of the dependency label of the mention's root token>, gov:<lemma of its governor>, has:<base label of each dependent hanging on its tokens outside the mention>.
// Only kinds the organ validates (field.stable, not fallbackNomination) are kinds; a class in none is UNPLACED (null). A structure extractor: no regex, no word list, no verdict.
import fs from "node:fs";
const KH = process.env.KHORA ?? "/Users/mlacy/Documents/khora";
const { induceEntityKindCandidates } = await import(`${KH}/native/kernel/entity-kind-induction.js`);
const LANG = process.env.LANG_CODE ?? process.argv[4] ?? "eng";   // rule 11: kinds are induced from the codec rows fullgraph.mjs read in this language
const base = (d) => { const s = String(d ?? ""), i = s.indexOf(":"); return i < 0 ? s : s.slice(0, i); };
const R = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), out = [];
for (const rec of R) {
  const T = rec.tokens, n = rec.classes.length, feats = new Map(), put = (c0, sig, key, ev) => { const c = `c${c0}`; if (!feats.has(c)) feats.set(c, new Map()); const m = feats.get(c); if (!m.has(sig)) m.set(sig, { featureKey: key, featureValue: true, evidenceIds: new Set(), firstAt: 0, lastAt: 0 }); m.get(sig).evidenceIds.add(ev); };
  for (let i = 0; i < T.length; i++) {
    const t = T[i], h = t.head >= 0 ? T[t.head] : null;
    if (t.cls >= 0 && (h == null || h.cls !== t.cls)) { put(t.cls, `dep:${base(t.dep)}`, `dep:${base(t.dep)}`, `t${i}`); if (h) put(t.cls, `gov:${h.lemma}`, `gov:${h.lemma}`, `t${i}`); }
    if (t.cls < 0 && h && h.cls >= 0) put(h.cls, `has:${base(t.dep)}`, `has:${base(t.dep)}`, `t${i}`);
  }
  const res = induceEntityKindCandidates(feats, { population: `ctxadmit:${rec.title}` }), kinds = res.candidates.filter((k) => k.field?.stable === true && !k.fallbackNomination), kindOf = new Array(n).fill(null);
  kinds.forEach((k, ki) => { for (const ref of k.memberRefs) { const ci = Number(String(ref).slice(1)); if (kindOf[ci] == null) kindOf[ci] = ki; } });
  out.push({ file: rec.file, classes: n, profiled: feats.size, kinds: kinds.length, kindOf, diag: res.diagnostics });
}
fs.writeFileSync(process.argv[3], JSON.stringify(out));
const placed = out.reduce((s, r) => s + r.kindOf.filter((x) => x != null).length, 0), all = out.reduce((s, r) => s + r.classes, 0);
console.log(`wrote ${process.argv[3]}: ${out.length} documents, ${out.reduce((s, r) => s + r.kinds, 0)} stable kinds, ${placed} of ${all} classes placed (${(100 * placed / all).toFixed(1)}%), profiled ${out.reduce((s, r) => s + r.profiled, 0)}`);
