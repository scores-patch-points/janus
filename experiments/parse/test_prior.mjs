import assert from "node:assert/strict"; import fs from "node:fs";
import { mine, weights, spectrum, collapse, crosses, total, FEATS } from "./priorlib.mjs";
// 1. crossing: interleaved arcs cross, nested and disjoint do not, root arcs never
assert.equal(crosses(0, 3, [[2, 4]]), true, "1-3 and 2-4 interleave"); assert.equal(crosses(0, 4, [[2, 3]]), false, "nested"); assert.equal(crosses(0, 2, [[3, 4]]), false, "disjoint"); assert.equal(crosses(1, 0, [[1, 3]]), false, "a root arc never crosses");
// 2. mining: counts by relation; a DET always before a NOUN head teaches that
const mk = (rows) => ({ gold: rows.map(([u, h, d]) => ({ upos: u, head: h, deprel: d })) }), S = [];
for (let i = 0; i < 40; i++) S.push(mk([["DET", 2, "det"], ["NOUN", 3, "nsubj"], ["VERB", 0, "root"], ["PUNCT", 3, "punct"]]));
const T = mine(S); assert.equal(T.n, 120, "punctuation is not counted");
const good = weights(T, { u: "DET", r: "det", hu: "NOUN", dir: "L", dist: "1", cross: false }), bad = weights(T, { u: "DET", r: "det", hu: "VERB", dir: "R", dist: "2", cross: true });
for (const k of FEATS) assert.ok(k === "label" ? Math.abs(good[k] - bad[k]) < 1e-12 : good[k] > bad[k], `${k}: the seen configuration weighs more than the unseen one (the label weight is shared when child and relation are the same)`);
const badLabel = weights(T, { u: "DET", r: "nsubj", hu: "NOUN", dir: "L", dist: "1", cross: false }); assert.ok(good.label > badLabel.label, "label: P(det | DET) beats P(nsubj | DET)");
// 3. the spectrum keeps BOTH candidates; the margin is log2 weight(A) - log2 weight(B); the collapse is a use-time threshold
const sp = spectrum(T, { u: "DET", r: "det", hu: "NOUN", dir: "L", dist: "1", cross: false }, { u: "DET", r: "det", hu: "VERB", dir: "R", dist: "2", cross: true });
assert.ok(sp.margin > 0 && sp.held === true && Math.abs(sp.weight.A + sp.weight.B - 1) < 1e-12 && sp.weight.A > 0.5); assert.equal(collapse(sp, 0), "A"); assert.equal(collapse(sp, sp.margin + 1), "HELD", "below the margin the spectrum stays held"); assert.equal(collapse({ ...sp, margin: -3 }, 2), "B");
// 4. a margin of zero is a tie: both held at any positive threshold
assert.equal(collapse({ margin: 0 }, 0.5), "HELD");
// 5. the twin: shuffling the relation labels destroys the relation-specific information
let k = 0; const labs = ["det", "nsubj", "root", "punct"], Tt = mine(S, () => labs[(k++ * 7919) % 4]); const tw = weights(Tt, { u: "DET", r: "det", hu: "NOUN", dir: "L", dist: "1", cross: false }); assert.ok(total(tw) < total(good), "a shuffled-label prior loses the seen-configuration advantage");
// 6. ablation helpers: total(w, skip) and total(w, null, only)
assert.ok(Math.abs(total(good) - total(good, "dir") - good.dir) < 1e-12 && Math.abs(total(good, null, "label") - good.label) < 1e-12);
const src = fs.readFileSync(new URL("./priorlib.mjs", import.meta.url), "utf8"); assert.equal(/RegExp|\.match\(|\.replace\(\//.test(src), false, "no regex"); console.log("test_prior: OK");
