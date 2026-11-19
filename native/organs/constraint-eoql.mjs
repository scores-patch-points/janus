// organs/constraint-eoql.mjs: property constraints as EOQL expressions over claim-links (claim-links.mjs). Each kind is built from the nine verbs: SEG cuts, CON bonds and joins,
// SYN groups, EVA judges, REC projects. No hand-written check logic: the operators do the checking. ONE extra primitive is used and named: P-FIX (EOQL SPEC 4.x, a least fixed point),
// for the transitive closure of containment (Resolution) and for the cycle test (acyclic); the nine verbs compose a fixed number of steps and cannot close an unbounded chain.
// `precedes` is NOT here: it needs a DECLARED order the caller injects (EOT has no arithmetic); it stays in constraints.js and is reported as a typed gap.
const q = (s) => { if (/["\\\n]/.test(s)) throw new TypeError(`constraint-eoql: a relation name may not contain quotes, backslashes or newlines: ${s}`); return `"${s}"`; };
/** the live links of a relation as rows (s = subject, v = value): bonds joined to their claim (the Pattern), polarity "+" only */
export const links = (rel) => `REC(EVA(CON(SEG(sources; kinds: ["bond"]); as: "a"; to: SEG(sources; kinds: ["claim"]); on: a.claim = b._addr; join: "inner"; to_as: "b"); where: b.rel = ${q(rel)} AND b.polarity = "+"); set: {s: a._addr, v: a.to}; pick: ["s", "v"])`;
/** containment closure (c is inside p, transitively): P-FIX */
export const closure = () => { const W = 'REC(SEG(sources; kinds: ["within"]); set: {c: _addr, p: to}; pick: ["c", "p"])'; return `DEF(; fix: "anc"; base: ${W}; step: REC(CON(anc; as: "x"; to: ${W}; on: x.p = y.c; join: "inner"; to_as: "y"); set: {c: x.c, p: y.p}; pick: ["c", "p"]); in: anc)`; };
const subjects = (L) => `REC(SYN(${L}; by: ["s"]; agg: {n: count(*)}); pick: ["s"])`;
export const QUERIES = {
  facts: (r) => `SYN(${links(r.rel)}; agg: {n: count(*)})`,
  // two or more distinct values for one subject
  single_value_subjects: (r) => `REC(EVA(SYN(${links(r.rel)}; by: ["s"]; agg: {n: count(distinct v)}); where: n > 1); pick: ["s"])`,
  // a value of a violating subject that is inside, or holds, NO other value of that subject: the subject cannot be a Resolution
  single_value_unrelated: (r) => { const L = links(r.rel); return `REC(EVA(SYN(REC(CON(CON(${L}; as: "x"; to: ${L}; on: x.s = y.s AND x.v <> y.v; join: "inner"; to_as: "y"); to: ${closure()}; on: x.v = cl.c AND y.v = cl.p OR x.v = cl.p AND y.v = cl.c; join: "left"; to_as: "cl"); set: {s: x.s, v: x.v, hit: cl.c}; pick: ["s", "v", "hit"]); by: ["s", "v"]; agg: {r: count(hit)}); where: r = 0); pick: ["s"])`; },
  distinct_values: (r) => `REC(EVA(SYN(${links(r.rel)}; by: ["v"]; agg: {n: count(distinct s)}); where: n > 1); pick: ["v"])`,
  symmetric: (r) => `REC(EVA(CON(${links(r.rel)}; as: "x"; to: ${links(r.rel)}; on: x.v = y.s AND x.s = y.v; join: "left"; to_as: "y"); where: y.s is null); set: {s: x.s, v: x.v}; pick: ["s", "v"])`,
  inverse: (r) => `REC(EVA(CON(${links(r.rel)}; as: "x"; to: ${links(r.other)}; on: x.v = y.s AND x.s = y.v; join: "left"; to_as: "y"); where: y.s is null); set: {s: x.s, v: x.v}; pick: ["s", "v"])`,
  item_requires: (r) => `SYN(${subjects(links(r.rel))}; with: ${subjects(links(r.other))}; mode: "except")`,
  conflicts_with: (r) => `REC(SYN(REC(CON(${links(r.rel)}; as: "x"; to: ${links(r.other)}; on: x.s = y.s; join: "inner"; to_as: "y"); set: {s: x.s, v: x.v}; pick: ["s", "v"]); by: ["s", "v"]; agg: {n: count(*)}); pick: ["s", "v"])`,
  // a node that can reach itself
  acyclic: (r) => { const W = links(r.rel); return `EVA(DEF(; fix: "reach"; base: ${W}; step: REC(CON(reach; as: "x"; to: ${W}; on: x.v = y.s; join: "inner"; to_as: "y"); set: {s: x.s, v: y.v}; pick: ["s", "v"]); in: reach); where: s = v)`; },
};
/** evaluate(E, handle, rules) -> { violations: [{ kind, rel, difference, key }], gaps: [{ kind, rel, note }], checked } over a claim-links log. E = the EOQL module, injected. */
export function evaluate(E, handle, rules) {
  const run = (text) => E.run(handle, text, { params: {} }).rows ?? [], out = { violations: [], gaps: [], checked: 0 };
  const V = (r, difference, key) => out.violations.push({ kind: r.kind, rel: r.rel, difference, key });
  for (const r of rules) {
    if (r.kind === "precedes") { out.gaps.push({ kind: "declared_order", rel: r.rel, note: "precedes needs a declared order injected by the caller: not in the EOQL form, kept in constraints.js" }); continue; }
    if (!QUERIES[r.kind === "single_value" ? "single_value_subjects" : r.kind]) { out.gaps.push({ kind: "no_template", rel: r.rel, note: `no EOQL template for ${r.kind}` }); continue; }
    const f = run(QUERIES.facts(r)); if (!(f[0]?.n > 0)) { out.gaps.push({ kind: "no_facts", rel: r.rel, note: "the facts never use this relation: nothing was checked, which is not a pass" }); continue; }
    out.checked++;
    const nm = (x) => String(x).replace(/^being:/, ""), col = (rows, k) => rows.map((x) => nm(x[k])).sort();
    if (r.kind === "single_value") {
      const all = col(run(QUERIES.single_value_subjects(r)), "s"), unrel = new Set(col(run(QUERIES.single_value_unrelated(r)), "s"));
      for (const s of all) V(r, unrel.has(s) ? "Conflict" : "Resolution", s);
    } else if (r.kind === "distinct_values") for (const v of col(run(QUERIES.distinct_values(r)), "v")) V(r, "Conflict", v);
    else if (r.kind === "symmetric" || r.kind === "inverse") for (const x of run(QUERIES[r.kind](r)).sort((a, b) => `${a.s}|${a.v}`.localeCompare(`${b.s}|${b.v}`))) V(r, "Silence", `${nm(x.s)}|${nm(x.v)}`);
    else if (r.kind === "item_requires") for (const s of col(run(QUERIES.item_requires(r)), "s")) V(r, "Silence", s);
    else if (r.kind === "conflicts_with") for (const x of run(QUERIES.conflicts_with(r)).sort((a, b) => `${a.s}|${a.v}`.localeCompare(`${b.s}|${b.v}`))) V(r, "Conflict", `${nm(x.s)}|${nm(x.v)}`);
    else if (r.kind === "acyclic") { if (run(QUERIES.acyclic(r)).length) V(r, "Conflict", "cycle"); }
  }
  return out;
}
