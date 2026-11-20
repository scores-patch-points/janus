// errorkinds.mjs <errors.json> <out.json> [cap]: DEV ONLY, exploratory. khora's own kind induction (kernel/entity-kind-induction.js, relation-profile kinds with its search-aware random-subset null) over the WRONG tokens' structural profiles; the twin runs it on an equal-size seeded sample of RIGHT tokens.
// Features are structural only: rel, pos, hpos, hrel, dir, dist, kids, slen (never the word, never the error type). Only kinds the organ validates (field.stable, not fallbackNomination) are kinds. The sample cap is an ARBITRARY CONSTANT (declared, labelled), chosen so the organ's pairwise affinity field is tractable.
import fs from "node:fs";
const KH = "/Users/mlacy/Documents/khora"; const { induceEntityKindCandidates } = await import(`${KH}/native/kernel/entity-kind-induction.js`);
const T = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), CAP = Number(process.argv[4] ?? 2500), SEED = 20261119;
const rng = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const sample = (arr, n, r) => { const a = arr.map((x, i) => i); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, Math.min(n, arr.length)).sort((x, y) => x - y).map((i) => arr[i]); };
const FEATS = ["rel", "pos", "hpos", "hrel", "dir", "dist", "kids", "slen"], featsOf = (t) => FEATS.map((k) => `${k}:${t.prof[k]}`);
const wrong = T.filter((t) => t.err !== "none"), right = T.filter((t) => t.err === "none");
function induce(tokens, label) {
  const ents = new Map(); tokens.forEach((t, i) => { const m = new Map(); for (const f of featsOf(t)) m.set(f, { featureKey: f, featureValue: true, evidenceIds: new Set([`e${i}`]), firstAt: 0, lastAt: 0 }); ents.set(`e${i}`, m); });
  const t0 = Date.now(), res = induceEntityKindCandidates(ents, { population: `parse-errors:${label}` }), kinds = res.candidates.filter((k) => k.field?.stable === true && !k.fallbackNomination);
  console.error(`${label}: ${tokens.length} entities, ${kinds.length} stable kinds, validated ${res.diagnostics.validated}, fallbackUsed ${res.diagnostics.fallbackUsed} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  return kinds.map((k) => ({ members: k.memberRefs.map((r) => tokens[Number(String(r).slice(1))]), energy: k.field?.bindingEnergy ?? null }));
}
const prevalence = (ts, f) => ts.filter((t) => featsOf(t).includes(f)).length / ts.length;
const allFeats = [...new Set(wrong.flatMap(featsOf))], baseRate = wrong.length / T.length;
function describe(kind) {
  const ms = kind.members, errs = {}; for (const t of ms) errs[t.err] = (errs[t.err] ?? 0) + 1;
  const top = allFeats.map((f) => ({ f, inK: prevalence(ms, f), inAll: prevalence(wrong, f) })).filter((x) => x.inK >= 0.5).sort((a, b) => b.inK / (b.inAll + 1e-9) - a.inK / (a.inAll + 1e-9)).slice(0, 4);
  const sigs = top.slice(0, 3).map((x) => x.f), match = T.filter((t) => { const fs_ = featsOf(t); return sigs.every((s) => fs_.includes(s)); }), wr = match.filter((t) => t.err !== "none").length;
  return { size: ms.length, errTypes: errs, corpora: ms.reduce((o, t) => ((o[t.corpus] = (o[t.corpus] ?? 0) + 1), o), {}), top: top.map((x) => `${x.f} (${(100 * x.inK).toFixed(0)}% of kind, ${(100 * x.inAll).toFixed(0)}% of all errors)`), signature: sigs, tokensWithSignature: match.length, errorRateWithSignature: match.length ? wr / match.length : null, lift: match.length ? (wr / match.length) / baseRate : null };
}
const r = rng(SEED), wS = sample(wrong, CAP, r), rS = sample(right, wS.length, r), outk = { cap: CAP, sampled: wS.length, baseRate, wrongKinds: induce(wS, "WRONG").map(describe), rightKinds: induce(rS, "RIGHT (twin)").map(describe) };
fs.writeFileSync(process.argv[3], JSON.stringify(outk, null, 1));
for (const [name, ks] of [["WRONG tokens", outk.wrongKinds], ["RIGHT tokens (twin)", outk.rightKinds]]) { console.log(`\n=== kinds induced over ${name}: ${ks.length}`); ks.sort((a, b) => b.size - a.size).forEach((k, i) => console.log(`#${i + 1} size ${k.size}  errors ${JSON.stringify(k.errTypes)}  corpora ${JSON.stringify(k.corpora)}\n   signature ${k.signature.join(" & ")}  -> ${k.tokensWithSignature} tokens carry it, error rate ${k.errorRateWithSignature == null ? "n/a" : (100 * k.errorRateWithSignature).toFixed(1) + "%"} (lift ${k.lift == null ? "n/a" : k.lift.toFixed(2)}x of base ${(100 * baseRate).toFixed(1)}%)\n   defining: ${k.top.join("; ")}`)); }
