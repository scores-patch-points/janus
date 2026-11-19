import test from "node:test"; import assert from "node:assert/strict";
import { makeRule, rulesFromDeclare, check, KINDS } from "./constraints.js";
const F = (rel, a, b, polarity = "+") => ({ rel, a, b, polarity }), G = "test-giver";
const run = (facts, rules, o) => check(facts, rules.map((r) => makeRule({ giver: G, ...r })), o);
test("a rule with no giver, an unknown kind, or a missing other relation is refused", () => {
  assert.throws(() => makeRule({ rel: "capital", kind: "single_value" }), /giver/); assert.throws(() => makeRule({ rel: "x", kind: "bogus", giver: G }), /kind/); assert.throws(() => makeRule({ rel: "x", kind: "inverse", giver: G }), /other/);
});
test("single value: two different values are a Conflict; nested values (Topeka in Kansas) are a Resolution that narrows", () => {
  const rules = [{ rel: "capital", kind: "single_value" }];
  const c = run([F("capital", "Kansas", "Topeka"), F("capital", "Kansas", "Wichita")], rules); assert.equal(c.violations.length, 1); assert.equal(c.violations[0].difference, "Conflict");
  const r = run([F("born_in", "Ann", "Topeka"), F("born_in", "Ann", "Kansas")], [{ rel: "born_in", kind: "single_value" }], { containers: { Topeka: "Kansas", Kansas: "USA" } }); assert.equal(r.violations[0].difference, "Resolution");
  assert.equal(run([F("capital", "Kansas", "Topeka")], rules).violations.length, 0);
  assert.equal(run([F("capital", "Kansas", "Topeka"), F("capital", "Kansas", "Wichita", "-")], rules).violations.length, 0, "a negated fact is not a second value");
});
test("symmetric and inverse: the absent converse is Silence, a hole and not a conflict", () => {
  const s = run([F("sibling", "Ann", "Bo")], [{ rel: "sibling", kind: "symmetric" }]); assert.equal(s.violations[0].difference, "Silence");
  assert.equal(run([F("sibling", "Ann", "Bo"), F("sibling", "Bo", "Ann")], [{ rel: "sibling", kind: "symmetric" }]).violations.length, 0);
  const i = run([F("parent", "Ann", "Bo")], [{ rel: "parent", kind: "inverse", other: "child" }, ]); assert.equal(i.gaps.length, 0); assert.equal(i.violations[0].difference, "Silence");
  assert.equal(run([F("parent", "Ann", "Bo"), F("child", "Bo", "Ann")], [{ rel: "parent", kind: "inverse", other: "child" }]).violations.length, 0);
});
test("distinct values, requires, conflicts and acyclic", () => {
  assert.equal(run([F("id", "A", "7"), F("id", "B", "7")], [{ rel: "id", kind: "distinct_values" }]).violations[0].difference, "Conflict");
  assert.equal(run([F("spouse", "Ann", "Bo")], [{ rel: "spouse", kind: "item_requires", other: "birth" }]).violations[0].difference, "Silence");
  assert.equal(run([F("alive", "Ann", "yes"), F("dead", "Ann", "yes")], [{ rel: "alive", kind: "conflicts_with", other: "dead" }]).violations[0].difference, "Conflict");
  const cyc = run([F("defeat", "A", "B"), F("defeat", "B", "C"), F("defeat", "C", "A")], [{ rel: "defeat", kind: "acyclic" }]); assert.equal(cyc.violations[0].difference, "Conflict"); assert.match(cyc.violations[0].note, /A > B > C > A/);
  assert.equal(run([F("defeat", "A", "B"), F("defeat", "B", "C")], [{ rel: "defeat", kind: "acyclic" }]).violations.length, 0);
});
test("a rule over a relation the facts never use is a typed gap, not a pass; the asker's declare becomes rules", () => {
  const r = run([F("x", "a", "b")], [{ rel: "capital", kind: "single_value" }]); assert.equal(r.violations.length, 0); assert.equal(r.gaps[0].kind, "no_facts"); assert.equal(r.checked, 0);
  const rules = rulesFromDeclare({ functional: ["capital"], symmetric: ["sibling"], acyclic: ["defeat"] }); assert.deepEqual(rules.map((x) => x.kind), ["single_value", "symmetric", "acyclic"]); assert.ok(rules.every((x) => x.giver === "asker"));
  assert.deepEqual(KINDS.length, 7);
});
test("the output does not depend on the order of the facts", () => {
  const facts = [F("capital", "K", "T"), F("capital", "K", "W"), F("sibling", "A", "B")], rules = [{ rel: "capital", kind: "single_value" }, { rel: "sibling", kind: "symmetric" }];
  const a = JSON.stringify(run(facts, rules).violations.map((v) => [v.difference, v.note])), b = JSON.stringify(run([...facts].reverse(), rules).violations.map((v) => [v.difference, v.note])); assert.equal(a, b);
});
