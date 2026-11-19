// constraint-eoql.test.mjs: the EOQL form (operators over claim-links) must give what constraints.js gives on the same claims (the oracle), and it must be exact on the cases that matter.
// Needs the pharos library at $PHAROS_LIB (pharos/lib/pharos.mjs); the EOQL evaluator is read from ../eoql/src beside it.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { pathToFileURL } from "node:url";
import { check, makeRule } from "./constraints.js"; import { weaveClaims } from "./claim-links.mjs"; import { evaluate } from "./constraint-eoql.mjs";
const LIB = process.env.PHAROS_LIB ?? "", EOQL = LIB ? path.join(path.dirname(LIB), "..", "eoql", "src", "index.mjs") : "";
const skip = LIB && fs.existsSync(LIB) && fs.existsSync(EOQL) ? false : "pharos library or its eoql not found (set PHAROS_LIB to pharos/lib/pharos.mjs)";
const P = skip ? null : await import(pathToFileURL(LIB).href), E = skip ? null : await import(pathToFileURL(EOQL).href);
const C = (rel, a, b, polarity = "+") => ({ rel, a, b, polarity }), G = "test";
const rule = (kind, rel, other = null) => makeRule({ rel, kind, giver: G, other });
const KEY = { single_value: (v) => v.facts[0].a, distinct_values: (v) => v.facts[0].b, item_requires: (v) => v.facts[0].a, acyclic: () => "cycle" };
const norm = (rows) => rows.map((x) => `${x.kind}|${x.rel}|${x.difference}|${x.key}`).sort();
function run(claims, rules, containers = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ceoql-")), h = P.open("t", { dir, writer: "w" }); weaveClaims(P, h, claims, containers);
  const eo = evaluate(E, E.open(`jsonl:${dir}/w.jsonl`), rules), or = check(claims, rules, { containers });
  const oracle = or.violations.map((v) => ({ kind: v.rule.kind, rel: v.rule.rel, difference: v.difference, key: (KEY[v.rule.kind] ?? ((x) => `${x.facts[0].a}|${x.facts[0].b}`))(v) }));
  return { eo, or, a: norm(eo.violations), b: norm(oracle) };
}
const same = (claims, rules, containers) => { const r = run(claims, rules, containers); assert.deepEqual(r.a, r.b); assert.deepEqual(r.eo.gaps.map((g) => `${g.kind}|${g.rel}`).sort(), r.or.gaps.filter((g) => g.kind === "no_facts").map((g) => `${g.kind}|${g.rel}`).sort()); return r; };
test("single value: Conflict for two values, Resolution when every value is inside another (transitively), Conflict when one is unrelated; a negated claim is not a value", { skip }, () => {
  const r = same([C("capital", "Kansas", "Topeka"), C("capital", "Kansas", "Wichita"), C("capital", "Ohio", "Columbus"), C("capital", "Ohio", "Dayton", "-")], [rule("single_value", "capital")]);
  assert.deepEqual(r.a, ["single_value|capital|Conflict|being:Kansas".replace("being:", "")], "Ohio has ONE positive value: the negated claim is not a second value");
  const n = same([C("born_in", "Ann", "Topeka"), C("born_in", "Ann", "Kansas"), C("born_in", "Ann", "USA")], [rule("single_value", "born_in")], { Topeka: "Kansas", Kansas: "USA" }); assert.deepEqual(n.a, ["single_value|born_in|Resolution|Ann"]);
  const m = same([C("born_in", "Ann", "Topeka"), C("born_in", "Ann", "Kansas"), C("born_in", "Ann", "Paris")], [rule("single_value", "born_in")], { Topeka: "Kansas" }); assert.deepEqual(m.a, ["single_value|born_in|Conflict|Ann"], "Paris is inside nothing: one unrelated value makes it a Conflict");
});
test("symmetric and inverse: the absent converse is Silence", { skip }, () => {
  const s = same([C("sibling", "Ann", "Bo"), C("sibling", "Bo", "Ann"), C("sibling", "Ann", "Cy")], [rule("symmetric", "sibling")]); assert.deepEqual(s.a, ["symmetric|sibling|Silence|Ann|Cy"]);
  const chain = same([C("sibling", "Ann", "Bo"), C("sibling", "Bo", "Cy")], [rule("symmetric", "sibling")]); assert.deepEqual(chain.a, ["symmetric|sibling|Silence|Ann|Bo", "symmetric|sibling|Silence|Bo|Cy"], "a link out of Bo is not the converse of a link into Bo");
  const i = same([C("parent", "Ann", "Bo"), C("child", "Bo", "Ann"), C("parent", "Cy", "Di")], [rule("inverse", "parent", "child")]); assert.deepEqual(i.a, ["inverse|parent|Silence|Cy|Di"]);
});
test("requires, conflicts, distinct values and acyclic", { skip }, () => {
  assert.deepEqual(same([C("spouse", "Ann", "Bo"), C("spouse", "Cy", "Di"), C("birth", "Ann", "1900")], [rule("item_requires", "spouse", "birth")]).a, ["item_requires|spouse|Silence|Cy"]);
  assert.deepEqual(same([C("alive", "Ann", "yes"), C("dead", "Ann", "yes"), C("alive", "Bo", "yes")], [rule("conflicts_with", "alive", "dead")]).a, ["conflicts_with|alive|Conflict|Ann|yes"]);
  assert.deepEqual(same([C("id", "A", "7"), C("id", "B", "7"), C("id", "C", "8")], [rule("distinct_values", "id")]).a, ["distinct_values|id|Conflict|7"]);
  assert.deepEqual(same([C("defeat", "A", "B"), C("defeat", "B", "C"), C("defeat", "C", "A")], [rule("acyclic", "defeat")]).a, ["acyclic|defeat|Conflict|cycle"]);
  assert.deepEqual(same([C("defeat", "A", "B"), C("defeat", "B", "C")], [rule("acyclic", "defeat")]).a, []);
});
test("a relation the claims never use is a typed gap, a negated-only relation is also nothing checked, and precedes is reported as a gap here", { skip }, () => {
  const r = same([C("x", "a", "b")], [rule("single_value", "capital")]); assert.deepEqual(r.a, []); assert.equal(r.eo.gaps[0].kind, "no_facts");
  const n = run([C("capital", "K", "T", "-")], [rule("single_value", "capital")]); assert.equal(n.eo.gaps[0].kind, "no_facts", "only a negated claim: nothing positive was checked");
  const p = evaluate(E, E.open(`jsonl:${(() => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "ceoql-")), h = P.open("t", { dir: d, writer: "w" }); weaveClaims(P, h, [C("b", "a", "1")], {}); return d; })()}/w.jsonl`), [rule("precedes", "b", "d")]); assert.equal(p.gaps[0].kind, "declared_order");
});
test("the verdicts do not depend on the order the claims were woven", { skip }, () => {
  const claims = [C("capital", "Kansas", "Topeka"), C("capital", "Kansas", "Wichita"), C("sibling", "Ann", "Cy"), C("sibling", "Ann", "Bo"), C("sibling", "Bo", "Ann")], rules = [rule("single_value", "capital"), rule("symmetric", "sibling")];
  assert.deepEqual(run(claims, rules).a, run([...claims].reverse(), rules).a);
});
