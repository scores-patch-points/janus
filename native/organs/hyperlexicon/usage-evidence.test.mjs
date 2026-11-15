import test from "node:test";
import assert from "node:assert/strict";
import { makeUsage, NeedCompany } from "./usage-evidence.mjs";
import { treeOf, walk } from "../identity/tree-walk.mjs";

const co = (o, usesRead = 300) => ({ company: Object.entries(o).map(([surface, n]) => ({ surface, n })), usesRead });
// every word keeps "the"; buy and purchase keep shop and price; sell keeps market; the nulls keep other things
const world = { buy: co({ the: 90, shop: 40, price: 30 }), purchase: co({ the: 80, shop: 35, price: 25 }), sell: co({ the: 85, market: 40 }),
  n1: co({ the: 70, sky: 30 }), n2: co({ the: 60, river: 20 }), n3: co({ the: 75, song: 25 }) };

test("a missing word raises NeedCompany naming exactly what is lacking", () => {
  const U = makeUsage({ nullWords: ["n1", "n2"] });
  assert.throws(() => U.near("buy", "purchase"), (e) => e instanceof NeedCompany && e.words.sort().join() === "buy,n1,n2,purchase");
});

test("words that keep the same company are near once the common background is taken away; cosines only, no licence", () => {
  const U = makeUsage({ nullWords: ["n1", "n2", "n3"], nulls: 3 });
  for (const [w, a] of Object.entries(world)) U.give(w, a);
  const same = U.near("buy", "purchase"), apart = U.near("buy", "sell");
  assert.ok(same.cos > 0.8, String(same.cos));
  assert.ok(same.cos > same.null.p95);
  assert.ok(apart.cos < same.cos);
  assert.equal(same.null.n, 3);
  assert.deepEqual(same.uses, [300, 300]);
  for (const k of ["licensed", "same", "above"]) assert.equal(k in same, false);
});

test("an unheard word is empty, never near", () => {
  const U = makeUsage({ nullWords: ["n1"] });
  U.give("n1", world.n1); U.give("buy", world.buy); U.give("zzz", { gap: "unheard" });
  const e = U.near("buy", "zzz");
  assert.deepEqual([e.empty, e.cos, e.null.n], [true, 0, 0]);
});

const parse = (rows) => ({ rows: rows.map(([id, lemma, upos, head, deprel]) => ({ id, lemma, form: lemma, upos, head, deprel, feats: "", start: id })) });
const T = (...rows) => treeOf([parse(rows)]);
const leafA = () => T([1, "keep", "VERB", 0, "root"], [2, "provision", "NOUN", 1, "obj"]), leafB = () => T([1, "keep", "VERB", 0, "root"], [2, "section", "NOUN", 1, "obj"]);
const none = () => ({ shared: 0, null: { p95: 1, n: 50 }, sizes: [9, 9] });
const smell = (a, b) => ({ a, b, cos: 0.9, null: { n: 50, p95: 0.5 } }), admits = (e) => e.cos > e.null.p95;
const use = (cos) => () => ({ cos, null: { p95: 0.3, n: 50 }, uses: [300, 300] }), licenses = (u) => u.cos > u.null.p95;

test("the walk: a proposed leaf pair falls without use, stands with a licence from use, and use is refused for opposites", () => {
  assert.deepEqual(walk(leafA(), leafB(), { evidence: none, smell, admits }).differences.map((d) => d.kind), ["unanchored"]);
  const on = walk(leafA(), leafB(), { evidence: none, smell, admits, usage: use(0.8), licenses });
  assert.equal(on.counts.hard, 0);
  assert.deepEqual([on.proposals.byUse, on.counts.usageLicensed], [1, 1]);
  assert.equal(on.pairs.find((p) => p.how === "proposed").licence, "usage");
  assert.deepEqual(walk(leafA(), leafB(), { evidence: none, smell, admits, usage: use(0.1), licenses }).differences.map((d) => d.kind), ["unanchored"]);
  const opp = walk(leafA(), leafB(), { evidence: none, smell, admits, usage: use(0.8), licenses, opposed: () => true });
  assert.deepEqual(opp.differences.map((d) => d.kind).sort(), ["opposed", "unanchored"]);
  assert.equal(opp.counts.usageAsked, 0);
});

test("a licence from use never anchors a proposal above it", () => {
  // tops proposed (obey ~ follow); beneath them only provision ~ section, licensed by use: the top proposal must still fall
  const A = T([1, "obey", "VERB", 0, "root"], [2, "provision", "NOUN", 1, "obj"]), B = T([1, "follow", "VERB", 0, "root"], [2, "section", "NOUN", 1, "obj"]);
  const c = walk(A, B, { evidence: none, smell, admits, usage: (x) => (x === "provision" ? use(0.8)() : use(0.1)()), licenses });
  assert.deepEqual(c.differences.map((d) => [d.kind, d.a]), [["unanchored", "obey"]]);
});
