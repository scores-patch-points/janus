import test from "node:test";
import assert from "node:assert/strict";
import { makeSmell, NeedVectors } from "./smell.mjs";
import { treeOf, walk, spanOf } from "./tree-walk.mjs";
import { makeFold } from "../hyperlexicon/channel-fold.mjs";

const parse = (rows) => ({ rows: rows.map(([id, lemma, upos, head, deprel, feats = ""]) => ({ id, lemma, form: lemma, upos, head, deprel, feats, start: id })) });
const T = (...rows) => treeOf([parse(rows)]);

test("smell: a missing vector raises NeedVectors naming exactly what it lacks; nothing is embedded unasked", () => {
  const S = makeSmell({ nullSpans: [{ text: "n1", group: "x" }, { text: "n2", group: "y" }], nulls: 2 });
  assert.throws(() => S.near("a", "b"), (e) => e instanceof NeedVectors && e.texts.sort().join() === "a,b,n1,n2");
  S.give("a", [1, 0]); S.give("b", [1, 0]); S.give("n1", [0, 1]); S.give("n2", [1, 1]);
  const e = S.near("a", "b");
  assert.equal(e.cos, 1);
  assert.equal(e.null.n, 2);
  assert.ok(Math.abs(e.null.p95 - Math.SQRT1_2) < 1e-9);
  assert.equal(S.near("a", "b", { exclude: "y" }).null.n, 1);
  for (const k of ["same", "licensed", "above"]) assert.equal(k in e, false);
});

test("spanOf: a subtree's own words in text order", () => {
  const t = T([1, "have", "VERB", 0, "root"], [2, "to", "PART", 3, "mark"], [3, "comply", "VERB", 1, "xcomp"]);
  assert.equal(spanOf(t.children[0]), "have to comply");
});

// she must obey the rule  /  she has to follow the rule : tops differ, smell proposes them, "rule" anchors
const A = () => T([1, "she", "PRON", 2, "nsubj"], [2, "obey", "VERB", 0, "root"], [3, "the", "DET", 4, "det"], [4, "rule", "NOUN", 2, "obj"]);
const B = (obj = "rule") => T([1, "she", "PRON", 2, "nsubj"], [2, "follow", "VERB", 0, "root"], [3, "the", "DET", 4, "det"], [4, obj, "NOUN", 2, "obj"]);
const none = () => ({ shared: 0, null: { p95: 1, n: 50 }, sizes: [9, 9] });
const smell = (cos) => (a, b) => ({ a, b, cos, null: { n: 50, p95: 0.5 } });
const admits = (e) => e.cos > e.null.p95;

test("without a smell the tops are leftovers; with one, the proposal is made and stands because a content pair beneath it is identical", () => {
  const off = walk(A(), B(), { evidence: none });
  assert.deepEqual(off.differences.map((d) => d.kind), ["leftover", "leftover"]);
  const on = walk(A(), B(), { evidence: none, smell: smell(0.9), admits });
  assert.equal(on.counts.hard, 0);
  assert.deepEqual(on.proposals, { made: 1, anchored: 1, unanchored: 0 });
  assert.deepEqual(on.pairs.filter((p) => p.how === "proposed").map((p) => [p.a, p.b, p.covered]), [["obey", "follow", true]]);
});

test("a proposal with nothing beneath it to stand on is a hard difference: nearness alone never makes two things the same", () => {
  const leafA = T([1, "approve", "VERB", 0, "root"]), leafB = T([1, "reject", "VERB", 0, "root"]);
  const c = walk(leafA, leafB, { evidence: none, smell: smell(0.99), admits });
  assert.deepEqual(c.differences.map((d) => d.kind), ["unanchored"]);
  assert.deepEqual(c.proposals, { made: 1, anchored: 0, unanchored: 1 });
});

test("a proposal whose consequences do not close fails by them; a nearness under the bound proposes nothing", () => {
  const c = walk(A(), B("boat"), { evidence: none, smell: (a, b) => (a.includes("obey") ? smell(0.9)(a, b) : null), admits });
  assert.ok(c.differences.some((d) => d.kind === "leftover" && d.lemma === "rule"));
  assert.ok(c.differences.some((d) => d.kind === "unanchored"));
  const low = walk(A(), B(), { evidence: none, smell: smell(0.2), admits });
  assert.equal(low.proposals.made, 0);
});

test("opposition named by a giver is a hard difference even when the proposal is anchored", () => {
  const c = walk(A(), B(), { evidence: none, smell: smell(0.9), admits, opposed: (x, y) => x === "obey" && y === "follow" });
  assert.deepEqual(c.differences.map((d) => d.kind), ["opposed"]);
});

test("related: a giver's relation between two words' lemma nodes, either direction", () => {
  const H = { answer(ask) {
    if (ask.op === "names") return { surfaces: Object.fromEntries(ask.surfaces.map((s) => [s, { written: [{ kind: "lemma", node: "n_" + s }] }])) };
    return { links: [], relations: ask.id === "n_hot" ? [{ rel: "ant", to: "n_cold" }] : [] };
  } };
  const F = makeFold(H);
  assert.equal(F.related("hot", "cold", "ant"), true);
  assert.equal(F.related("cold", "hot", "ant"), true);
  assert.equal(F.related("hot", "warm", "ant"), false);
});
