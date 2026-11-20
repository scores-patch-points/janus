import test from "node:test"; import assert from "node:assert/strict";
import { assertionsFromClaims, overlaps } from "./claim-assertions.mjs";
import { makeMergeGate as make } from "./merge-gate.mjs";
import { induceKindsAndFunctions } from "../../../khora/native/kernel/kind-functional-induction.js"; import { makeIdentityExclusion } from "../../../khora/native/kernel/identity-exclusion.js";
const organs = { induceKindsAndFunctions, makeIdentityExclusion }, makeMergeGate = (o) => make({ organs, ...o });
const C = (rel, a, b, extra = {}) => ({ rel, a, b, polarity: "+", ...extra });
const grounds = { where: { Paris: "France", Lyon: "France" }, when: { Revolution: "Modern", Empire: "Modern" } };
const gateOf = (claims, o = {}) => { const A = assertionsFromClaims(claims, { grounds, ...o.adapter }); return makeMergeGate({ referents: A.referents, declaredKinds: [{ kindKey: "k", memberRefs: A.referents }], assertionsOf: A.assertionsOf, sameValue: A.sameValue, difference: A.difference, witnessed: (a) => a.ref === true, exposureFloor: 3, given: { functional: [{ kind: "k", rel: "capital", giver: "asker" }] }, ...o.gate }); };
const diffs = (g, a, b) => g.evidence(a, b).findings.filter((f) => f.type === "difference"), holes = (g, a, b) => g.evidence(a, b).findings.filter((f) => f.type === "hole" && f.why === "incomparable");

test("grounds overlap on an axis when equal, when one holds the other, or when either is absent; siblings do not", () => {
  const t = { Paris: "France", Lyon: "France", France: "Europe" };
  assert.equal(overlaps(t, "Paris", "Paris"), true); assert.equal(overlaps(t, "Paris", "France"), true); assert.equal(overlaps(t, "Europe", "Lyon"), true, "transitively");
  assert.equal(overlaps(t, "Paris", "Lyon"), false); assert.equal(overlaps(t, null, "Lyon"), true); assert.equal(overlaps(t, "Paris", undefined), true);
});

test("a negated claim is not an assertion; the being key is the caller's; claim order does not matter to what a being asserts", () => {
  const A = assertionsFromClaims([C("born", "Ann Lee", "1900"), C("born", "Ann Lee", "1901", { polarity: "-" })], { beingKey: (x) => x.toLowerCase() });
  assert.deepEqual(A.referents, ["ann lee"]); assert.equal(A.assertionsOf("ann lee").length, 1); assert.equal(A.assertionsOf("ann lee")[0].value.v, "1900"); assert.deepEqual(A.assertionsOf("nobody"), []);
});

test("two values leave a difference only where their grounds meet: the same time does, sibling times leave an incomparable hole, no ground meets everything", () => {
  const two = (x, y) => gateOf([C("capital", "p", x[0], { when: x[1] }), C("capital", "q", y[0], { when: y[1] })]);
  const same = two(["Paris", "Revolution"], ["Lyon", "Revolution"]); assert.equal(diffs(same, "p", "q").length, 1, "same time, two capitals: a difference on a given rule");
  const sib = two(["Paris", "Revolution"], ["Lyon", "Empire"]); assert.equal(diffs(sib, "p", "q").length, 0); assert.equal(holes(sib, "p", "q").length, 1, "incomparable: change, not a conflict");
  assert.equal(diffs(two(["Paris", "Modern"], ["Lyon", "Empire"]), "p", "q").length, 1, "a time that holds the other meets it");
  assert.equal(diffs(two(["Paris", null], ["Lyon", "Empire"]), "p", "q").length, 1, "no ground holds always");
});

test("the same holds along where, and for a range rule through the wrapped difference; the witnesses carry their ground", () => {
  const w = (x, y) => gateOf([C("capital", "p", "Paris", { where: x }), C("capital", "q", "Lyon", { where: y })]);
  assert.equal(diffs(w("Paris", "Lyon"), "p", "q").length, 0, "sibling places"); const d = diffs(w("France", "Lyon"), "p", "q"); assert.equal(d.length, 1); assert.deepEqual([d[0].witness.a.where, d[0].witness.b.where], ["France", "Lyon"]);
  const A = assertionsFromClaims([C("born", "x", 1850, { where: "Paris" }), C("died", "y", 1820, { where: "Paris" }), C("died", "z", 1820, { where: "Lyon" })], { grounds, difference: (u, v) => (typeof u === "number" && typeof v === "number" ? u - v : null), beingKey: (s) => s });
  const g = makeMergeGate({ referents: A.referents, declaredKinds: [{ kindKey: "k", memberRefs: A.referents }], assertionsOf: A.assertionsOf, sameValue: A.sameValue, difference: A.difference, witnessed: (a) => a.ref === true, exposureFloor: 3, given: { ranges: [{ kind: "k", rel: "died", base: "born", min: 0, max: 150, giver: "asker" }] } });
  assert.equal(diffs(g, "x", "y").length, 1, "born after death in the same place"); assert.equal(diffs(g, "x", "z").length, 0, "a death in a sibling place is not compared"); assert.equal(g.evidence("x", "z").findings.some((f) => f.type === "hole"), true);
});

test("a claim's SOURCE is the one the caller gives (a document address or a host), never derived from its ground; a claim that names none has none; two sources never hide a comparison", () => {
  const A = assertionsFromClaims([C("born", "x", 1850, { where: "s0", source: "docA" }), C("born", "x", 1860, { source: "host:example.org" }), C("born", "x", 1880)], { grounds: { where: { s0: "docA" } } });
  assert.deepEqual(A.assertionsOf("x").map((a) => a.value.source), ["docA", "host:example.org", null], "the ground s0 is inside docA but does not make docA the source");
  const g = makeMergeGate({ referents: ["x", "y"], declaredKinds: [{ kindKey: "k", memberRefs: ["x", "y"] }], ...(() => { const B = assertionsFromClaims([C("born", "x", 1850, { source: "docA" }), C("born", "y", 1860, { source: "docB" })], {}); return { assertionsOf: B.assertionsOf, sameValue: B.sameValue, difference: B.difference }; })(), witnessed: (a) => a.ref === true, exposureFloor: 3, given: { functional: [{ kind: "k", rel: "born", giver: "asker" }] } });
  assert.equal(diffs(g, "x", "y").length, 1, "claims from two DOCUMENTS (no ground) are compared: a source is not a ground");
});
