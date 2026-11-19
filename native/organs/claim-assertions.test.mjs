import test from "node:test"; import assert from "node:assert/strict";
import { assertionsFromClaims, overlaps } from "./claim-assertions.mjs";
import { makeMergeGate } from "./merge-gate.mjs";
import { CONTRADICTED, UNBOUND } from "../../../khora/native/interpretation/hl.js";
const C = (rel, a, b, extra = {}) => ({ rel, a, b, polarity: "+", ...extra });
const grounds = { where: { Paris: "France", Lyon: "France" }, when: { Revolution: "Modern", Empire: "Modern" } };
const gateOf = (claims, o = {}) => { const A = assertionsFromClaims(claims, { grounds, ...o }); return makeMergeGate({ referents: A.referents, declaredKinds: [{ kindKey: "k", memberRefs: A.referents }], assertionsOf: A.assertionsOf, sameValue: A.sameValue, difference: A.difference, witnessed: (a) => a.ref === true, exposureFloor: 3, given: { functional: [{ kind: "k", rel: "capital", giver: "asker" }] }, ...o.gate }); };

test("grounds overlap on an axis when equal, when one holds the other, or when either is absent; siblings do not", () => {
  const t = { Paris: "France", Lyon: "France", France: "Europe" };
  assert.equal(overlaps(t, "Paris", "Paris"), true); assert.equal(overlaps(t, "Paris", "France"), true); assert.equal(overlaps(t, "Europe", "Lyon"), true, "transitively");
  assert.equal(overlaps(t, "Paris", "Lyon"), false); assert.equal(overlaps(t, null, "Lyon"), true); assert.equal(overlaps(t, "Paris", undefined), true);
});

test("a negated claim is not an assertion; the being key is the caller's; claim order does not matter to what a being asserts", () => {
  const A = assertionsFromClaims([C("born", "Ann Lee", "1900"), C("born", "Ann Lee", "1901", { polarity: "-" })], { beingKey: (x) => x.toLowerCase() });
  assert.deepEqual(A.referents, ["ann lee"]); assert.equal(A.assertionsOf("ann lee").length, 1); assert.equal(A.assertionsOf("ann lee")[0].value.v, "1900"); assert.deepEqual(A.assertionsOf("nobody"), []);
});

test("two values conflict only where their grounds meet: the same time convicts, sibling times are change, no ground meets everything", () => {
  const two = (x, y) => gateOf([C("capital", "p", x[0], { when: x[1] }), C("capital", "q", y[0], { when: y[1] })]).judge("p", "q");
  assert.equal(two(["Paris", "Revolution"], ["Lyon", "Revolution"]).verdict, CONTRADICTED, "same time, two capitals");
  const sib = two(["Paris", "Revolution"], ["Lyon", "Empire"]); assert.equal(sib.verdict, UNBOUND); assert.equal(sib.raised.length, 0); assert.equal(sib.incomparable.length, 1, "incomparable, not a conflict");
  assert.equal(two(["Paris", "Modern"], ["Lyon", "Empire"]).verdict, CONTRADICTED, "a time that holds the other meets it");
  assert.equal(two(["Paris", null], ["Lyon", "Empire"]).verdict, CONTRADICTED, "no ground holds always");
});

test("the same holds along where, and for a range rule through the wrapped difference", () => {
  const w = (x, y) => gateOf([C("capital", "p", "Paris", { where: x }), C("capital", "q", "Lyon", { where: y })]).judge("p", "q").verdict;
  assert.equal(w("Paris", "Lyon"), UNBOUND, "sibling places"); assert.equal(w("France", "Lyon"), CONTRADICTED);
  const A = assertionsFromClaims([C("born", "x", 1850, { where: "Paris" }), C("died", "y", 1820, { where: "Paris" }), C("died", "z", 1820, { where: "Lyon" })], { grounds, difference: (u, v) => (typeof u === "number" && typeof v === "number" ? u - v : null), beingKey: (s) => s });
  const g = makeMergeGate({ referents: A.referents, declaredKinds: [{ kindKey: "k", memberRefs: A.referents }], assertionsOf: A.assertionsOf, sameValue: A.sameValue, difference: A.difference, witnessed: (a) => a.ref === true, exposureFloor: 3, given: { ranges: [{ kind: "k", rel: "died", base: "born", min: 0, max: 150, giver: "asker" }] } });
  assert.equal(g.judge("x", "y").verdict, CONTRADICTED, "born after death in the same place"); assert.equal(g.judge("x", "z").verdict, UNBOUND, "a death in a sibling place is not compared");
});
