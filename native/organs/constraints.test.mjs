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
  assert.deepEqual(KINDS.length, 8);
});
test("the output does not depend on the order of the facts", () => {
  const facts = [F("capital", "K", "T"), F("capital", "K", "W"), F("sibling", "A", "B")], rules = [{ rel: "capital", kind: "single_value" }, { rel: "sibling", kind: "symmetric" }];
  const a = JSON.stringify(run(facts, rules).violations.map((v) => [v.difference, v.note])), b = JSON.stringify(run([...facts].reverse(), rules).violations.map((v) => [v.difference, v.note])); assert.equal(a, b);
});
// the declared order a test injects (a stand-in for a codec's decode + the asker's declared order): numbers are themselves, ISO dates go through Date.parse, anything else cannot be ordered
const order = (x, y) => { const t = (v) => (typeof v === "number" ? v : /^-?\d+$/.test(v) ? Number(v) : Date.parse(v)), a = t(x), b = t(y); return Number.isNaN(a) || Number.isNaN(b) ? null : a - b; };
test("precedes: a birth dated after its death is a Conflict; equal, living, other items, negated facts and unorderable values are not", () => {
  const rules = [{ rel: "born", kind: "precedes", other: "died" }], v = (facts) => run(facts, rules, { order });
  const bad = v([F("born", "Ann", "1900"), F("died", "Ann", "1850")]); assert.equal(bad.violations.length, 1); assert.equal(bad.violations[0].difference, "Conflict"); assert.match(bad.violations[0].note, /Ann born 1900 comes after died 1850/); assert.equal(bad.violations[0].facts.length, 2);
  assert.equal(v([F("born", "Ann", "1850-03-02"), F("died", "Ann", "1850-03-01")]).violations.length, 1, "one day too late still convicts");
  assert.equal(v([F("born", "Ann", "1850"), F("died", "Ann", "1900")]).violations.length, 0, "the right order passes");
  assert.equal(v([F("born", "Ann", "1850"), F("died", "Ann", "1850")]).violations.length, 0, "the same instant is allowed");
  assert.equal(v([F("born", "Ann", "1850")]).violations.length, 0, "no death is a living subject, not a hole"); assert.equal(v([F("born", "Ann", "1850")]).checked, 1);
  assert.equal(v([F("born", "Ann", "1900"), F("died", "Bo", "1850")]).violations.length, 0, "dates of different items are not compared");
  assert.equal(v([F("born", "Ann", "1900"), F("died", "Ann", "1850", "-")]).violations.length, 0, "a negated death is not a death");
  assert.equal(v([F("born", "Ann", 1900), F("died", "Ann", 1850)]).violations.length, 1, "numeric years work");
  assert.equal(v([F("born", "Caesar", "-0100"), F("died", "Caesar", "-0044")]).violations.length, 0, "a BCE year orders correctly");
  const g = v([F("born", "Ann", "long ago"), F("died", "Ann", "1850")]); assert.equal(g.violations.length, 0); assert.equal(g.gaps[0].kind, "unorderable");
  assert.throws(() => makeRule({ rel: "born", kind: "precedes", giver: G }), /other/);
  assert.equal(v([F("died", "Ann", "1850")]).gaps[0].kind, "no_facts", "a rule over a relation the facts never use is still a gap");
});
test("precedes with no declared order is a typed gap and checks nothing: the order is given, never guessed here", () => {
  const r = run([F("born", "Ann", "1900"), F("died", "Ann", "1850")], [{ rel: "born", kind: "precedes", other: "died" }]); assert.equal(r.violations.length, 0); assert.equal(r.gaps[0].kind, "no_order"); assert.equal(r.checked, 0);
});
test("grounded in the cube: a rule is a DEF at its grain and a violation is the EVA at the same grain, both from khora's cellOf", () => {
  const r = makeRule({ rel: "born", kind: "precedes", other: "died", giver: G }); assert.deepEqual([r.def.op, r.def.grain, r.def.terrain, r.def.stance], ["DEF", "Figure", "Lens", "Dissecting"]);
  const v = run([F("born", "Ann", "1900"), F("died", "Ann", "1850")], [{ rel: "born", kind: "precedes", other: "died" }], { order }).violations[0]; assert.deepEqual([v.eva.op, v.eva.grain, v.eva.terrain, v.eva.stance], ["EVA", "Figure", "Lens", "Binding"]);
  const p = run([F("capital", "K", "T"), F("capital", "K", "W")], [{ rel: "capital", kind: "single_value", grain: "Pattern" }]).violations[0]; assert.equal(p.eva.terrain, "Paradigm", "the grain is the rule's own");
  assert.throws(() => makeRule({ rel: "x", kind: "single_value", giver: G, grain: "Middle" }), /grain/);
});
