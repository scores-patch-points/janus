import test from "node:test"; import assert from "node:assert/strict";
import { inducePrecedes, makeMergeGate as make } from "./merge-gate.mjs";
import { induceKindsAndFunctions } from "../../../khora/native/kernel/kind-functional-induction.js"; import { makeIdentityExclusion } from "../../../khora/native/kernel/identity-exclusion.js";
const organs = { induceKindsAndFunctions, makeIdentityExclusion }, makeMergeGate = (o) => make({ organs, ...o });
// the verdict words are hl.js's own values, stated here so no other repo is imported for them; the TWO ORGANS below are the test harness's injection (a sibling checkout), the one place a test reaches khora
const CONTRADICTED = "contradicted", UNBOUND = "unbound", BEYOND_REACH = "beyond-reach";
const diff = (u, v) => (typeof u === "number" && typeof v === "number" ? u - v : null), same = (u, v) => u === v, witnessed = (a) => a.ref === true;
let n = 0; const as = (rel, value) => ({ rel, value, id: `a${n++}`, ref: true });
// four people whose records are consistent: each states born twice the same, and died after born
const people = Object.fromEntries(["m1", "m2", "m3", "m4"].map((m, i) => [m, [as("born", 1800 + i), as("born", 1800 + i), as("died", 1850 + i)]]));
const world = { ...people, x: [as("born", 1850)], y: [as("died", 1820)], p: [as("born", 1850)], q: [as("born", 1860)] };
const referents = Object.keys(world), declaredKinds = [{ kindKey: "person", memberRefs: referents }], assertionsOf = (r) => world[r] ?? [];
const gate = (extra = {}) => makeMergeGate({ referents, declaredKinds, assertionsOf, sameValue: same, difference: diff, witnessed, exposureFloor: 3, order: [{ rel: "died", base: "born", kind: "person" }], ...extra });

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

test("learned from content alone: the order and the one-valuedness are candidates, so they RAISE a conflict and never convict", () => {
  const g = gate(), d = g.judge("x", "y");
  assert.equal(d.verdict, UNBOUND); assert.equal(d.raised[0].raisedAs, "candidate_conflict"); assert.equal(d.raised[0].rel, "died"); assert.equal(d.raised[0].base, "born");
  const f = g.judge("p", "q"); assert.equal(f.verdict, UNBOUND); assert.equal(f.raised[0].rel, "born"); assert.equal(f.raised[0].standing, "candidate");
  assert.equal(g.judge("p", "x").verdict, UNBOUND, "no conflict is never 'same': it is unbound, never bound");
});

test("a GIVEN rule convicts: the same merge with a named giver is CONTRADICTED, with the two assertions as proof", () => {
  const r = gate({ given: { ranges: [{ kind: "person", rel: "died", base: "born", min: 0, max: 150, giver: "asker" }] } }).judge("x", "y");
  assert.equal(r.verdict, CONTRADICTED); assert.equal(r.by, "range"); assert.equal(r.proof[0].giver, "asker");
  const f = gate({ given: { functional: [{ kind: "person", rel: "born", giver: "asker" }] } }).judge("p", "q"); assert.equal(f.verdict, CONTRADICTED); assert.equal(f.by, "functional");
});

test("a refuted or unexposed order learns nothing: the gate says beyond-reach, it does not guess", () => {
  const w2 = { ...world, z: [as("born", 1900), as("died", 1850)] }, refs = Object.keys(w2);
  const g = makeMergeGate({ referents: refs, declaredKinds: [{ kindKey: "person", memberRefs: refs }], assertionsOf: (k) => w2[k] ?? [], sameValue: same, difference: diff, witnessed, exposureFloor: 3, order: [{ rel: "died", base: "born", kind: "person" }] });
  assert.equal(g.precedes[0].standing, "refuted"); assert.equal(g.judge("x", "y").verdict, UNBOUND, "the one-valued candidate still stands, but the refuted order raises nothing");
  assert.equal(g.judge("x", "y").raised.length, 0);
});

test("a given rule or range with no giver is refused", () => {
  assert.throws(() => gate({ given: { ranges: [{ kind: "person", rel: "died", base: "born", min: 0, max: 1 }] } }), /giver/);
  assert.throws(() => gate({ given: { functional: [{ kind: "person", rel: "born" }] } }), /giver/);
});
test("the gate refuses to run without its organs: it imports no other repo, so they must be supplied", () => {
  assert.throws(() => make({ referents, declaredKinds, assertionsOf, sameValue: same, difference: diff, exposureFloor: 3 }), /organs/);
  assert.throws(() => make({ organs: { induceKindsAndFunctions }, referents, declaredKinds, assertionsOf, sameValue: same, difference: diff, exposureFloor: 3 }), /organs/);
});
