import test from "node:test"; import assert from "node:assert/strict";
import { inducePrecedes, makeMergeGate as make } from "./merge-gate.mjs";
// the two khora organs are the test harness's injection (a sibling checkout), the one place a test reaches khora
import { induceKindsAndFunctions } from "../../../khora/native/kernel/kind-functional-induction.js"; import { makeIdentityExclusion } from "../../../khora/native/kernel/identity-exclusion.js";
const organs = { induceKindsAndFunctions, makeIdentityExclusion }, makeMergeGate = (o) => make({ organs, ...o });
const diff = (u, v) => (typeof u === "number" && typeof v === "number" ? u - v : null), same = (u, v) => u === v, witnessed = (a) => a.ref === true;
let n = 0; const as = (rel, value) => ({ rel, value, id: `a${n++}`, ref: true });
// four people whose records are consistent: each states born twice the same, and died after born
const people = Object.fromEntries(["m1", "m2", "m3", "m4"].map((m, i) => [m, [as("born", 1800 + i), as("born", 1800 + i), as("died", 1850 + i)]]));
const world = { ...people, x: [as("born", 1850)], y: [as("died", 1820)], p: [as("born", 1850)], q: [as("born", 1860)] };
const referents = Object.keys(world), declaredKinds = [{ kindKey: "person", memberRefs: referents }], assertionsOf = (r) => world[r] ?? [];
const gate = (extra = {}) => makeMergeGate({ referents, declaredKinds, assertionsOf, sameValue: same, difference: diff, witnessed, exposureFloor: 3, order: [{ rel: "died", base: "born", kind: "person" }], ...extra });
const D = (g, a, b) => g.evidence(a, b).findings.filter((f) => f.type === "difference");

test("inducePrecedes: a candidate needs enough exposed members and no counterexample; one counterexample refutes; too few licenses nothing", () => {
  const o = { assertionsOf, difference: diff, rel: "died", base: "born" };
  const c = inducePrecedes(Object.keys(people), { ...o, exposureFloor: 3 }); assert.equal(c.standing, "candidate"); assert.equal(c.exposed, 4); assert.deepEqual([c.rule.min, c.rule.max], [0, Infinity]);
  assert.equal(inducePrecedes(["m1", "m2"], { ...o, exposureFloor: 3 }).standing, "unexposed");
  assert.equal(inducePrecedes(Object.keys(people), { ...o, exposureFloor: 4 }).standing, "candidate", "exactly the floor is enough"); assert.equal(inducePrecedes(Object.keys(people), { ...o, exposureFloor: 5 }).standing, "unexposed");
  const eq = { ...people, e: [as("born", 1850), as("died", 1850)] }; assert.equal(inducePrecedes([...Object.keys(people), "e"], { ...o, assertionsOf: (k) => eq[k] ?? [], exposureFloor: 3 }).standing, "candidate", "died the same year as born is not a counterexample");
  const bad = { ...world, z: [as("born", 1900), as("died", 1850)] }; const r = inducePrecedes([...Object.keys(people), "z"], { ...o, assertionsOf: (k) => bad[k] ?? [], exposureFloor: 3 });
  assert.equal(r.standing, "refuted"); assert.equal(r.counterexamples.length, 1); assert.equal(r.rule, undefined, "a refuted order yields no rule");
  assert.equal(inducePrecedes(["x", "y"], { ...o, exposureFloor: 1 }).standing, "unexposed", "different referents are not a pair: nothing is exposed");
});

test("learned from content alone: the order and the one-valuedness are left as differences with the standing CANDIDATE; a pair with no conflict has none, and is not 'same'", () => {
  const g = gate(), d = D(g, "x", "y"); assert.equal(d.length, 1); assert.deepEqual([d[0].rel, d[0].base, d[0].rule.standing, d[0].rule.giver], ["died", "born", "candidate", null]);
  const f = D(g, "p", "q"); assert.equal(f.length, 1); assert.deepEqual([f[0].rel, f[0].rule.standing], ["born", "candidate"]);
  const e = g.evidence("p", "x"); assert.equal(e.counts.differences, 0); assert.equal(e.counts.agreements, 1, "what janus found is an agreement; it says nothing about same");
});

test("a GIVEN rule leaves the same difference with its giver and the standing 'given', and the witnessing assertions; janus still does not apply it", () => {
  const r = D(gate({ given: { ranges: [{ kind: "person", rel: "died", base: "born", min: 0, max: 150, giver: "asker" }] } }), "x", "y")[0];
  assert.deepEqual([r.rule.standing, r.rule.giver, r.via, r.rule.kind], ["given", "asker", "witnessed", "range"]); assert.ok(r.witness.a.id && r.witness.b.id);
  const f = D(gate({ given: { functional: [{ kind: "person", rel: "born", giver: "asker" }] } }), "p", "q")[0]; assert.deepEqual([f.rule.standing, f.rule.giver, f.rule.kind], ["given", "asker", "one-valued"]);
});

test("whether a side was witnessed is COMPUTED by the gate and recorded: an unwitnessed assertion makes the difference unwitnessed", () => {
  const w2 = { ...world, x: [{ ...as("born", 1850), ref: false }] }, refs = Object.keys(w2);
  const g = makeMergeGate({ referents: refs, declaredKinds: [{ kindKey: "person", memberRefs: refs }], assertionsOf: (k) => w2[k] ?? [], sameValue: same, difference: diff, witnessed, exposureFloor: 3, given: { ranges: [{ kind: "person", rel: "died", base: "born", min: 0, max: 150, giver: "asker" }] } });
  assert.equal(D(g, "x", "y")[0].via, "unwitnessed"); assert.equal(D(gate({ given: { ranges: [{ kind: "person", rel: "died", base: "born", min: 0, max: 150, giver: "asker" }] } }), "x", "y")[0].via, "witnessed");
});

test("THE GATE CANNOT CONVICT: the organ is handed a witness test that always says no, so it only raises; it computes no conviction and the gate exposes no verdict", () => {
  const seen = []; const spy = (o) => { const gx = makeIdentityExclusion(o); seen.push({ opts: o, ask: () => gx }); return { judge: (a, b, op) => { const r = gx.judge(a, b, op); seen.push({ r }); return r; } }; };
  const g = makeMergeGate({ organs: { induceKindsAndFunctions, makeIdentityExclusion: spy }, referents, declaredKinds, assertionsOf, sameValue: same, difference: diff, witnessed, exposureFloor: 3, given: { ranges: [{ kind: "person", rel: "died", base: "born", min: 0, max: 150, giver: "asker" }] } });
  const ev = g.evidence("x", "y"); assert.equal(ev.findings.filter((f) => f.type === "difference")[0].rule.standing, "given");
  const opts = seen.find((s) => s.opts).opts; assert.equal(opts.witnessed({ ref: true }), false, "witnessed handed to the exclusion organ always answers no"); assert.equal(opts.witnessed(undefined), false);
  const r = seen.find((s) => s.r).r; assert.equal(r.verdict, "unbound"); assert.equal(r.proof, undefined, "the organ computed no conviction"); assert.equal(r.raised.length, 1);
  assert.equal("judge" in g, false); assert.equal("verdict" in ev, false);
  // the caller's own witness test still reaches the induction (a witnessed disagreement refutes), not the exclusion
  let called = 0; makeMergeGate({ organs: { induceKindsAndFunctions: (rs, o) => { assert.equal(o.witnessed, witnessed); called++; return induceKindsAndFunctions(rs, o); }, makeIdentityExclusion }, referents, declaredKinds, assertionsOf, sameValue: same, difference: diff, witnessed, exposureFloor: 3 }); assert.equal(called, 1);
});

test("a refused or unexposed order learns nothing: no range difference is left, and the gate does not guess", () => {
  const w2 = { ...world, z: [as("born", 1900), as("died", 1850)] }, refs = Object.keys(w2);
  const g = makeMergeGate({ referents: refs, declaredKinds: [{ kindKey: "person", memberRefs: refs }], assertionsOf: (k) => w2[k] ?? [], sameValue: same, difference: diff, witnessed, exposureFloor: 3, order: [{ rel: "died", base: "born", kind: "person" }] });
  assert.equal(g.precedes[0].standing, "refuted"); assert.equal(D(g, "x", "y").length, 0); assert.equal(g.evidence("x", "y").findings.some((f) => f.type === "hole"), true, "what it could not ask is a hole");
});

test("the gate synthesizes the merged world for a pair: both sides' assertions, labelled, none re-id'd", () => {
  const w = gate().world("x", "y"); assert.deepEqual([w.counts.a, w.counts.b], [1, 1]); assert.deepEqual(w.assertions.map((s) => s.side), ["a", "b"]);
});

test("a given rule or range with no giver is refused; the gate refuses to run without its organs", () => {
  assert.throws(() => gate({ given: { ranges: [{ kind: "person", rel: "died", base: "born", min: 0, max: 1 }] } }), /giver/);
  assert.throws(() => gate({ given: { functional: [{ kind: "person", rel: "born" }] } }), /giver/);
  assert.throws(() => make({ referents, declaredKinds, assertionsOf, sameValue: same, difference: diff, exposureFloor: 3 }), /organs/);
  assert.throws(() => make({ organs: { induceKindsAndFunctions }, referents, declaredKinds, assertionsOf, sameValue: same, difference: diff, exposureFloor: 3 }), /organs/);
});
