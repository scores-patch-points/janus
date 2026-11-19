// organs/constraint-eoql.mjs: property constraints as EOQL expressions over claim-links (claim-links.mjs). Each kind is built from the nine verbs: SEG cuts, CON bonds and joins,
// SYN groups, EVA judges, REC projects. No hand-written check logic: the operators do the checking. ONE extra primitive is used and named: P-FIX (EOQL SPEC, a least fixed point),
// for the transitive closure of containment (Resolution; grounds holding grounds) and for the cycle test (acyclic); the nine verbs compose a fixed number of steps and cannot close an unbounded chain.
// GROUND AND TIME. Two claims meet only where their grounds OVERLAP on BOTH axes (where, when): equal, or one holds the other (claim-links `holds_in`, closed by P-FIX). Siblings never meet, so
// "Kansas has capital Topeka in 1861 and Wichita in 1900" is no conflict when the two times are sibling grounds. single_value, distinct_values, symmetric, inverse and conflicts_with are ground-aware;
// item_requires and acyclic are GROUND-BLIND and report the typed gap `ground_blind` when a claim of that relation sits in a non-root ground. `asof` is a causal cut of the log ({pos: n} or a timestamp):
// the same check, evaluated at an earlier position. `precedes` is NOT here: it needs a DECLARED order the caller injects (EOT has no arithmetic); it stays in constraints.js and is a typed gap here.
const q = (s) => { if (/["\\\n]/.test(s)) throw new TypeError(`constraint-eoql: a name may not contain quotes, backslashes or newlines: ${s}`); return `"${s}"`; };
const R = { where: "where:*", when: "when:*" };
/** the live links of a relation as rows (s = subject, v = value; with g, w = the claim's grounds when `grounded`): bonds joined to their claim (the Pattern), polarity "+" only */
export const links = (rel, src = "sources", grounded = false) => `REC(EVA(CON(SEG(${src}; kinds: ["bond"]); as: "a"; to: SEG(${src}; kinds: ["claim"]); on: a.claim = b._addr; join: "inner"; to_as: "b"); where: b.rel = ${q(rel)} AND b.polarity = "+"); set: {s: a._addr, v: a.to${grounded ? ", g: b.ground, w: b.when" : ""}}; pick: ["s", "v"${grounded ? ', "g", "w"' : ""}])`;
/** a containment closure (c is inside p, transitively) over links of kind `kind`: P-FIX */
export const closure = (kind = "within", src = "sources") => { const W = `REC(SEG(${src}; kinds: ["${kind}"]); set: {c: _addr, p: to}; pick: ["c", "p"])`; return `DEF(; fix: "anc"; base: ${W}; step: REC(CON(anc; as: "x"; to: ${W}; on: x.p = y.c; join: "inner"; to_as: "y"); set: {c: x.c, p: y.p}; pick: ["c", "p"]); in: anc)`; };
/** the pairs (x, y) of grounded links joined on `cond` whose grounds OVERLAP on both axes. Rows carry x.s x.v y.s y.v. */
const meet = (L1, L2, cond, src) => { const H = closure("holds_in", src); return `EVA(EVA(CON(CON(CON(${L1}; as: "x"; to: ${L2}; on: ${cond}; join: "inner"; to_as: "y"); to: ${H}; on: x.g = cg.c AND y.g = cg.p OR x.g = cg.p AND y.g = cg.c; join: "left"; to_as: "cg"); to: ${H}; on: x.w = cw.c AND y.w = cw.p OR x.w = cw.p AND y.w = cw.c; join: "left"; to_as: "cw"); where: x.g = y.g OR cg.c is not null); where: x.w = y.w OR cw.c is not null)`; };
const subjects = (L) => `REC(SYN(${L}; by: ["s"]; agg: {n: count(*)}); pick: ["s"])`;
const pairKeys = (M) => `REC(SYN(REC(${M}; set: {s: x.s, v: x.v}; pick: ["s", "v"]); by: ["s", "v"]; agg: {n: count(*)}); pick: ["s", "v"])`;
export const QUERIES = {
  facts: (r, src) => `SYN(${links(r.rel, src)}; agg: {n: count(*)})`,
  nonroot: (r, src) => `SYN(EVA(${links(r.rel, src, true)}; where: g <> ${q(R.where)} OR w <> ${q(R.when)}); agg: {n: count(*)})`,
  // two claims, overlapping grounds, one subject, two different values
  single_value_subjects: (r, src) => { const L = links(r.rel, src, true); return `REC(SYN(REC(${meet(L, L, "x.s = y.s AND x.v <> y.v", src)}; set: {s: x.s}; pick: ["s"]); by: ["s"]; agg: {n: count(*)}); pick: ["s"])`; },
  // a value of such a pair that is inside, or holds, NO other value in the pair: the subject cannot be a Resolution
  single_value_unrelated: (r, src) => { const L = links(r.rel, src, true); return `REC(EVA(SYN(REC(CON(${meet(L, L, "x.s = y.s AND x.v <> y.v", src)}; to: ${closure("within", src)}; on: x.v = cl.c AND y.v = cl.p OR x.v = cl.p AND y.v = cl.c; join: "left"; to_as: "cl"); set: {s: x.s, v: x.v, hit: cl.c}; pick: ["s", "v", "hit"]); by: ["s", "v"]; agg: {r: count(hit)}); where: r = 0); pick: ["s"])`; },
  distinct_values: (r, src) => { const L = links(r.rel, src, true); return `REC(SYN(REC(${meet(L, L, "x.v = y.v AND x.s <> y.s", src)}; set: {v: x.v}; pick: ["v"]); by: ["v"]; agg: {n: count(*)}); pick: ["v"])`; },
  // a link with NO overlapping converse
  symmetric: (r, src) => { const L = links(r.rel, src, true); return `SYN(REC(${L}; pick: ["s", "v"]); with: ${pairKeys(meet(L, L, "x.v = y.s AND x.s = y.v", src))}; mode: "except")`; },
  inverse: (r, src) => { const L = links(r.rel, src, true), M = links(r.other, src, true); return `SYN(REC(${L}; pick: ["s", "v"]); with: ${pairKeys(meet(L, M, "x.v = y.s AND x.s = y.v", src))}; mode: "except")`; },
  conflicts_with: (r, src) => pairKeys(meet(links(r.rel, src, true), links(r.other, src, true), "x.s = y.s", src)),
  item_requires: (r, src) => `SYN(${subjects(links(r.rel, src))}; with: ${subjects(links(r.other, src))}; mode: "except")`,
  // a node that can reach itself
  acyclic: (r, src) => { const W = links(r.rel, src); return `EVA(DEF(; fix: "reach"; base: ${W}; step: REC(CON(reach; as: "x"; to: ${W}; on: x.v = y.s; join: "inner"; to_as: "y"); set: {s: x.s, v: y.v}; pick: ["s", "v"]); in: reach); where: s = v)`; },
};
const asofText = (a) => (a == null ? null : typeof a === "object" ? `{pos: ${Number(a.pos)}}` : q(String(a)));
/** evaluate(E, handle, rules, { asof }) -> { violations: [{ kind, rel, difference, key }], gaps: [{ kind, rel, note }], checked } over a claim-links log. E = the EOQL module, injected. */
export function evaluate(E, handle, rules, { asof = null } = {}) {
  const src = asof == null ? "sources" : `DEF(sources; asof: ${asofText(asof)})`;
  const run = (text) => E.run(handle, text, { params: {} }).rows ?? [], out = { violations: [], gaps: [], checked: 0 };
  const V = (r, difference, key) => out.violations.push({ kind: r.kind, rel: r.rel, difference, key });
  const nm = (x) => String(x).replace(/^being:/, ""), col = (rows, k) => rows.map((x) => nm(x[k])).sort();
  for (const r of rules) {
    if (r.kind === "precedes") { out.gaps.push({ kind: "declared_order", rel: r.rel, note: "precedes needs a declared order injected by the caller: not in the EOQL form, kept in constraints.js" }); continue; }
    if (!QUERIES[r.kind === "single_value" ? "single_value_subjects" : r.kind]) { out.gaps.push({ kind: "no_template", rel: r.rel, note: `no EOQL template for ${r.kind}` }); continue; }
    const f = run(QUERIES.facts(r, src)); if (!(f[0]?.n > 0)) { out.gaps.push({ kind: "no_facts", rel: r.rel, note: "the facts never use this relation: nothing was checked, which is not a pass" }); continue; }
    out.checked++;
    if ((r.kind === "item_requires" || r.kind === "acyclic") && (run(QUERIES.nonroot(r, src))[0]?.n ?? 0) > 0) out.gaps.push({ kind: "ground_blind", rel: r.rel, note: `${r.kind} does not yet look at grounds: a claim of ${r.rel} sits in a non-root ground, so the result treats all claims as meeting` });
    if (r.kind === "single_value") {
      const all = [...new Set(col(run(QUERIES.single_value_subjects(r, src)), "s"))], unrel = new Set(col(run(QUERIES.single_value_unrelated(r, src)), "s"));
      for (const s of all) V(r, unrel.has(s) ? "Conflict" : "Resolution", s);
    } else if (r.kind === "distinct_values") for (const v of [...new Set(col(run(QUERIES.distinct_values(r, src)), "v"))]) V(r, "Conflict", v);
    else if (r.kind === "symmetric" || r.kind === "inverse") for (const x of run(QUERIES[r.kind](r, src)).sort((a, b) => `${a.s}|${a.v}`.localeCompare(`${b.s}|${b.v}`))) V(r, "Silence", `${nm(x.s)}|${nm(x.v)}`);
    else if (r.kind === "item_requires") for (const s of col(run(QUERIES.item_requires(r, src)), "s")) V(r, "Silence", s);
    else if (r.kind === "conflicts_with") for (const x of run(QUERIES.conflicts_with(r, src)).sort((a, b) => `${a.s}|${a.v}`.localeCompare(`${b.s}|${b.v}`))) V(r, "Conflict", `${nm(x.s)}|${nm(x.v)}`);
    else if (r.kind === "acyclic") { if (run(QUERIES.acyclic(r, src)).length) V(r, "Conflict", "cycle"); }
  }
  return out;
}
