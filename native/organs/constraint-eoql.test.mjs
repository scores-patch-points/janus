// constraint-eoql.test.mjs: the EOQL form (operators over claim-links) must give what constraints.js gives on the same claims (the oracle), and it must be exact on the cases that matter.
// Needs the pharos library at $PHAROS_LIB (pharos/lib/pharos.mjs); the EOQL evaluator is read from ../eoql/src beside it.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { pathToFileURL } from "node:url";
import { check, makeRule } from "./constraints.js"; import { weaveClaims } from "./claim-links.mjs"; import { evaluate } from "./constraint-eoql.mjs";
const LIB = process.env.PHAROS_LIB ?? "", EOQL = LIB ? path.join(path.dirname(LIB), "..", "eoql", "src", "index.mjs") : "";
const skip = LIB && fs.existsSync(LIB) && fs.existsSync(EOQL) ? false : "pharos library or its eoql not found (set PHAROS_LIB to pharos/lib/pharos.mjs)";
const P = skip ? null : await import(pathToFileURL(LIB).href), E = skip ? null : await import(pathToFileURL(EOQL).href);
const C = (rel, a, b, polarity = "+", g = {}) => ({ rel, a, b, polarity, ...g }), G = "test";
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

function eo(claims, rules, containers = {}, grounds = {}, opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ceoql-")), h = P.open("t", { dir, writer: "w" }), w = weaveClaims(P, h, claims, containers, grounds);
  return { out: evaluate(E, E.open(`jsonl:${dir}/w.jsonl`), rules, opts), w, keys: (o) => norm(o.violations) };
}
test("time is a ground: sibling times never meet, equal or nested times do (single value)", { skip }, () => {
  const rules = [rule("single_value", "capital")], T = (a, b, t, g) => [C("capital", "Kansas", a, "+", { when: t }), C("capital", "Kansas", b, "+", { when: g })];
  assert.deepEqual(eo(T("Topeka", "Wichita", "1861", "1900"), rules).out.violations, [], "two sibling times: Topeka then Wichita is a change over time, not a conflict");
  assert.deepEqual(eo(T("Topeka", "Wichita", "1900", "1900"), rules).keys(eo(T("Topeka", "Wichita", "1900", "1900"), rules).out), ["single_value|capital|Conflict|Kansas"]);
  const nested = eo(T("Topeka", "Wichita", "era", "1900"), rules, {}, { when: { 1900: "era" } }); assert.deepEqual(nested.keys(nested.out), ["single_value|capital|Conflict|Kansas"], "1900 is inside the era: they meet");
  const root = eo([C("capital", "Kansas", "Topeka"), C("capital", "Kansas", "Wichita", "+", { when: "1900" })], rules); assert.equal(root.out.violations.length, 1, "a claim with no time holds always, so it meets every time");
});
test("place is a ground: sibling places never meet, and a place inside another does (distinct values, conflicts)", { skip }, () => {
  const ids = (g1, g2) => [C("id", "A", "7", "+", { where: g1 }), C("id", "B", "7", "+", { where: g2 })];
  assert.deepEqual(eo(ids("p1", "p2"), [rule("distinct_values", "id")]).out.violations, [], "the same id in two sibling places is not a clash");
  const x = eo(ids("p1", "p1"), [rule("distinct_values", "id")]); assert.deepEqual(x.keys(x.out), ["distinct_values|id|Conflict|7"]);
  const n = eo(ids("p1", "p12"), [rule("distinct_values", "id")], {}, { where: { p12: "p1" } }); assert.equal(n.out.violations.length, 1, "p12 is inside p1");
  const c = [C("alive", "Ann", "y", "+", { when: "1900" }), C("dead", "Ann", "y", "+", { when: "1950" })];
  assert.deepEqual(eo(c, [rule("conflicts_with", "alive", "dead")]).out.violations, [], "alive in 1900, dead in 1950: no conflict");
  assert.equal(eo([C("alive", "Ann", "y", "+", { when: "1950" }), C("dead", "Ann", "y", "+", { when: "1950" })], [rule("conflicts_with", "alive", "dead")]).out.violations.length, 1);
});
test("overlap is symmetric in which side holds the other (conflicts_with, one orientation each way)", { skip }, () => {
  const r = [rule("conflicts_with", "alive", "dead")];
  assert.equal(eo([C("alive", "Ann", "y", "+", { when: "era" }), C("dead", "Ann", "y", "+", { when: "1900" })], r, {}, { when: { 1900: "era" } }).out.violations.length, 1, "alive in the whole era, dead in a year inside it");
  assert.equal(eo([C("alive", "Ann", "y", "+", { when: "1900" }), C("dead", "Ann", "y", "+", { when: "era" })], r, {}, { when: { 1900: "era" } }).out.violations.length, 1, "alive in a year, dead in the era around it");
  assert.equal(eo([C("alive", "Ann", "y", "+", { where: "p1" }), C("dead", "Ann", "y", "+", { where: "p12" })], r, {}, { where: { p12: "p1" } }).out.violations.length, 1);
  assert.equal(eo([C("alive", "Ann", "y", "+", { where: "p12" }), C("dead", "Ann", "y", "+", { where: "p1" })], r, {}, { where: { p12: "p1" } }).out.violations.length, 1);
});
test("a converse in another time does not answer a symmetric claim", { skip }, () => {
  const claims = [C("sibling", "Ann", "Bo", "+", { when: "1900" }), C("sibling", "Bo", "Ann", "+", { when: "1950" })], r = [rule("symmetric", "sibling")];
  assert.equal(eo(claims, r).out.violations.length, 2, "each is stated, the converse is stated only at a time it cannot meet");
  assert.equal(eo([C("sibling", "Ann", "Bo", "+", { when: "1900" }), C("sibling", "Bo", "Ann", "+", { when: "1900" })], r).out.violations.length, 0);
  assert.equal(eo(claims, [rule("inverse", "sibling", "sibling")]).out.violations.length, 2);
  assert.equal(eo([C("parent", "Ann", "Bo"), C("child", "Bo", "Cy")], [rule("inverse", "parent", "child")]).out.violations.length, 1, "a child link out of Bo to someone else is not the inverse of Ann parent Bo");
});
test("asof: the same check at an earlier causal position sees only the claims woven by then", { skip }, () => {
  const claims = [C("capital", "Kansas", "Topeka"), C("capital", "Kansas", "Wichita")], rules = [rule("single_value", "capital")], full = eo(claims, rules);
  assert.equal(full.out.violations.length, 1);
  const early = eo(claims, rules, {}, {}, { asof: { pos: full.w.positions[0] }}); assert.equal(early.out.violations.length, 0, "at the position after the first claim there is one value");
  assert.equal(early.out.gaps.length, 0);
  const late = eo(claims, rules, {}, {}, { asof: { pos: full.w.positions[1] } }); assert.equal(late.out.violations.length, 1);
});
test("item_requires: the required claim must hold at a ground that meets the requiring claim", { skip }, () => {
  const r = [rule("item_requires", "spouse", "birth")], sp = (g) => C("spouse", "Ann", "Bo", "+", g);
  assert.equal(eo([sp({ when: "1900" }), C("birth", "Ann", "1870", "+", { when: "1950" })], r).out.violations.length, 1, "the birth is stated only at a time that cannot meet 1900");
  assert.equal(eo([sp({ when: "1900" }), C("birth", "Ann", "1870", "+", { when: "1900" })], r).out.violations.length, 0);
  assert.equal(eo([sp({ when: "1900" }), C("birth", "Ann", "1870", "+", { when: "era" })], r, {}, { when: { 1900: "era" } }).out.violations.length, 0, "the era holds 1900");
  assert.equal(eo([sp({ when: "era" }), C("birth", "Ann", "1870", "+", { when: "1900" })], r, {}, { when: { 1900: "era" } }).out.violations.length, 0, "and the other way round");
  assert.equal(eo([sp({ where: "p1" }), C("birth", "Ann", "1870", "+", { where: "p2" })], r).out.violations.length, 1, "sibling places do not meet");
  assert.equal(eo([sp({ when: "1900" }), sp({ when: "1950" }), C("birth", "Ann", "1870", "+", { when: "1900" })], r).out.violations.length, 1, "the 1950 claim has no birth at its time: the subject is still silent");
});
test("acyclic: a cycle counts only if every link holds at one place and time", { skip }, () => {
  const d = (a, b, g) => C("defeat", a, b, "+", g), r = [rule("acyclic", "defeat")];
  assert.equal(eo([d("A", "B", { when: "1900" }), d("B", "C", { when: "1900" }), d("C", "A", { when: "1900" })], r).out.violations.length, 1, "a cycle at one time");
  assert.equal(eo([d("A", "B", { when: "1900" }), d("B", "C", { when: "1900" }), d("C", "A", { when: "1950" })], r).out.violations.length, 0, "the closing link holds only in 1950: no cycle at any one time");
  assert.equal(eo([d("A", "B", { when: "1900" }), d("B", "C", { when: "1900" }), d("C", "A", { when: "era" })], r, {}, { when: { 1900: "era" } }).out.violations.length, 1, "the closing link holds through the era, including 1900");
  const g = { when: { 1900: "era", 1950: "era" } };
  assert.equal(eo([d("A", "B", { when: "era" }), d("B", "C", { when: "1900" }), d("C", "A", { when: "1950" })], r, {}, g).out.violations.length, 0, "era meets both years pairwise but the years do not meet: the path region narrows to 1900 and 1950 is blocked");
  assert.equal(eo([d("A", "B"), d("B", "C", { when: "1900" }), d("C", "A", { when: "1900" })], r).out.violations.length, 1, "an always-link meets any time");
  assert.equal(eo([d("A", "B", { where: "p1" }), d("B", "A", { where: "p2" })], r).out.violations.length, 0, "A to B in one place, B back to A in a sibling place");
  assert.ok(!eo([d("A", "B", { when: "1900" })], r).out.gaps.some((x) => x.kind === "ground_blind"), "no ground-blind gap remains");
});

test("every entry claim-links writes is Existence or Structure: observing, never defining (pharos writers audit, when it is beside the library)", { skip }, async () => {
  const W = path.join(path.dirname(LIB), "writers.mjs"); if (!fs.existsSync(W)) return;
  const { audit } = await import(pathToFileURL(W).href), dir = fs.mkdtempSync(path.join(os.tmpdir(), "cw-")), h = P.open("t", { dir, writer: "janus", frame: true });
  weaveClaims(P, h, [C("capital", "Kansas", "Topeka", "+", { where: "s0", when: "1861" }), C("capital", "Kansas", "Wichita", "-")], { Topeka: "Kansas" }, { where: { s0: "docA" }, when: { 1861: "era" } });
  const r = audit(P.entries(h)); assert.equal(r.ok, true, JSON.stringify(r.violations)); assert.ok(r.checked > 5);
  assert.equal(P.fold(h, { kind: "claim" }).entries[0].cell, "SEG·Pattern");
});
// the Janus session's report (2026-11-19): two values for one being in DIFFERENT SENTENCES of ONE document were silently missed, because the sentence was the ground and sibling grounds never meet. The document is the ground; the sentence is provenance (`at`).
test("the shape claims-from-rows emits (where = document, at = sentence): a contradiction between two sentences of one document is a violation; a different document does not meet it", { skip }, () => {
  const mk = (a, b, doc, at) => ({ rel: "born", a, b, polarity: "+", where: doc, at });
  const inOne = run([mk("Ann", "1850", "docA", "s0"), mk("Ann", "1860", "docA", "s1")], [rule("single_value", "born")]);
  assert.equal(inOne.eo.violations.length, 1, "two sentences of one document meet");
  const across = run([mk("Ann", "1850", "docA", "s0"), mk("Ann", "1860", "docB", "s0")], [rule("single_value", "born")]);
  assert.equal(across.eo.violations.length, 0, "two sibling documents are two places: they do not meet");
});
