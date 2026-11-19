// organs/merge-gate.mjs: WOULD MERGING TWO REFERENTS BREAK A RULE? Janus's Relate answer, wired from khora's organs; nothing here re-derives them.
//
//   kind              khora kernel/kind-functional-induction.js (declared kinds, or induced from relation profiles)
//   one-valued rules  the same organ: per kind, a relation a corpus REFUTES or leaves a CANDIDATE, never "given" (the grain theorem: content cannot establish a ∀)
//   order rules       inducePrecedes below: the one thing khora has no inducer for. "rel never comes before base" over every member that has both.
//   the verdict       khora kernel/identity-exclusion.js: contradicted | unbound | beyond-reach, hl.js's own values. A GIVEN rule (a named giver) may convict;
//                     an induced CANDIDATE may only RAISE a conflict (kelsen). Failing to find a conflict is never "same".
//
// Pure. What a value is, when two are the same and how far apart two dates are are INJECTED (sameValue, difference): EOT has no arithmetic, a codec decodes and
// the asker declares the order. A rule from content carries its evidence and stands as a candidate for ever; a rule from a giver may convict.
import { induceKindsAndFunctions } from "../../../khora/native/kernel/kind-functional-induction.js";
import { makeIdentityExclusion } from "../../../khora/native/kernel/identity-exclusion.js";

/**
 * inducePrecedes(members, { assertionsOf, difference, rel, base, exposureFloor }) -> { standing, rule?, exposed, counterexamples }
 *   exposed          members asserting BOTH rel and base with a decidable difference (an undecidable pair counts neither way)
 *   counterexamples  members where some decided rel - base < 0  (rel comes before base)
 *   standing         "refuted" (any counterexample), "candidate" (>= exposureFloor exposed, none refuted), "unexposed" (too few: licenses nothing)
 * The rule is { rel, base, min: 0, max: Infinity, standing: "candidate", evidence }. Only the sign is induced: an upper bound fitted to the sample is the sample, not a law.
 */
export function inducePrecedes(members, { assertionsOf, difference, rel, base, exposureFloor } = {}) {
  if (typeof assertionsOf !== "function" || typeof difference !== "function") throw new TypeError("inducePrecedes: assertionsOf and difference must be supplied");
  if (!Number.isInteger(exposureFloor) || exposureFloor < 1) throw new TypeError("inducePrecedes: exposureFloor must be declared");
  let exposed = 0; const counter = [];
  for (const m of members) {
    const xs = assertionsOf(m) ?? [], A = xs.filter((x) => x.rel === rel), B = xs.filter((x) => x.rel === base);
    const diffs = []; for (const u of A) for (const v of B) { const d = difference(u.value, v.value, rel, base); if (d != null) diffs.push([d, u, v]); }
    if (!diffs.length) continue;
    exposed += 1; const bad = diffs.find(([d]) => d < 0); if (bad) counter.push({ member: m, diff: bad[0], a: bad[1], b: bad[2] });
  }
  if (counter.length) return Object.freeze({ standing: "refuted", exposed, counterexamples: counter });
  if (exposed < exposureFloor) return Object.freeze({ standing: "unexposed", exposed, counterexamples: [] });
  return Object.freeze({ standing: "candidate", exposed, counterexamples: [], rule: Object.freeze({ rel, base, min: 0, max: Infinity, standing: "candidate", evidence: Object.freeze({ exposed, counterexamples: 0 }) }) });
}

/**
 * makeMergeGate({ referents, kindsOf?, declaredKinds?, kindOptions?, assertionsOf, sameValue, difference, witnessed, exposureFloor, order: [{rel, base}], given: { functional, ranges } })
 *   -> { judge(a, b, opts), register, precedes, induced }
 * `given` entries are { kind, rel, giver } (one-valued) and { kind, rel, base, min, max, giver } (range): they win over a candidate for the same relation.
 */
export function makeMergeGate(o = {}) {
  const { referents, assertionsOf, sameValue, difference, witnessed = null, exposureFloor, order = [], given = {}, declaredKinds = null, kindOptions } = o;
  const induced = induceKindsAndFunctions(referents, { assertionsOf, sameValue, witnessed, exposureFloor, declaredKinds, kindOptions });
  const functional = new Map([...induced.register].map(([k, m]) => [k, new Map(m)])), differences = new Map();
  for (const g of given.functional ?? []) { if (!g.giver) throw new TypeError("makeMergeGate: a given rule names its giver"); if (!functional.has(g.kind)) functional.set(g.kind, new Map()); functional.get(g.kind).set(g.rel, { giver: g.giver, temporal: g.temporal ?? "fixed" }); }
  const precedes = [];
  for (const { rel, base, kind } of order) {
    const p = inducePrecedes(referents, { assertionsOf, difference, rel, base, exposureFloor }); precedes.push({ rel, base, kind, ...p });
    if (p.rule) for (const k of kind ? [kind] : (declaredKinds ?? []).map((d) => d.kindKey)) { if (!differences.has(k)) differences.set(k, []); differences.get(k).push(p.rule); }
  }
  for (const g of given.ranges ?? []) { if (!g.giver) throw new TypeError("makeMergeGate: a given range names its giver"); const l = differences.get(g.kind) ?? []; differences.set(g.kind, [...l.filter((d) => !(d.rel === g.rel && d.base === g.base)), { rel: g.rel, base: g.base, min: g.min, max: g.max, giver: g.giver }]); }
  const kindsOf = o.kindsOf ?? ((r) => new Set([...(declaredKinds ?? [])].filter((d) => d.memberRefs.includes(r)).map((d) => d.kindKey)));
  const gate = makeIdentityExclusion({ kindsOf, assertionsOf, functional, sameValue, differences, difference, witnessed });
  return Object.freeze({ judge: gate.judge, register: functional, differences, precedes: Object.freeze(precedes), induced });
}
