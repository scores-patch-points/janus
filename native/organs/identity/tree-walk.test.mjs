import test from "node:test";
import assert from "node:assert/strict";
import { treeOf, walk } from "./tree-walk.mjs";
import { makeEvidence } from "../hyperlexicon/word-evidence.mjs";

// rows as the reader gives them: [id, lemma, upos, head, deprel, feats?]
const parse = (rows) => ({ rows: rows.map(([id, lemma, upos, head, deprel, feats = ""]) => ({ id, lemma, form: lemma, upos, head, deprel, feats })) });
const T = (...rows) => treeOf([parse(rows)]);
const buys = (verb, obj, extra = []) => T([1, "she", "PRON", 2, "nsubj"], [2, verb, "VERB", 0, "root"], [3, "the", "DET", 4, "det"], [4, obj, "NOUN", 2, "obj"], ...extra);
// evidence: a fixed table of shared counts, null p95 always 1
const table = { "buy|purchase": 40, "car|automobile": 7, "buy|sell": 0, "car|boat": 1 };
const ev = (calls) => (x, y) => { calls.push(`${x}|${y}`); const n = table[`${x}|${y}`] ?? table[`${y}|${x}`] ?? 0; return { shared: n, null: { p95: 1, n: 50 }, sizes: [10, 10] }; };
const covered = (e) => e.shared > e.null.p95;

test("treeOf: punctuation is dropped and every sentence hangs under one empty root", () => {
  const t = treeOf([parse([[1, "it", "PRON", 2, "nsubj"], [2, "rain", "VERB", 0, "root"], [3, ".", "PUNCT", 2, "punct"]]), parse([[1, "stop", "VERB", 0, "root"]])]);
  assert.deepEqual(t.children.map((c) => c.lemma), ["rain", "stop"]);
  assert.deepEqual(t.children[0].children.map((c) => c.lemma), ["it"]);
});

test("identical texts: no difference, and no evidence is ever asked for", () => {
  const calls = [];
  const c = walk(buys("buy", "car"), buys("buy", "car"), { evidence: ev(calls), covered });
  assert.deepEqual([c.counts.hard, c.counts.role, calls.length], [0, 0, 0]);
});

test("words that fold alike are paired and covered; only the pairs the walk reaches are asked", () => {
  const calls = [];
  const c = walk(buys("buy", "car"), buys("purchase", "automobile"), { evidence: ev(calls), covered });
  assert.equal(c.counts.hard, 0);
  assert.deepEqual(calls, ["buy|purchase", "car|automobile"]);
  assert.deepEqual(c.pairs.filter((p) => p.how === "evidence").map((p) => [p.a, p.b, p.covered]), [["buy", "purchase", true], ["car", "automobile", true]]);
});

test("a paired pair under the bound is a difference; an unpairable top is a leftover on both sides", () => {
  const weak = walk(buys("buy", "car"), buys("buy", "boat"), { evidence: ev([]), covered });
  assert.deepEqual(weak.differences.map((d) => d.kind), ["uncovered"]);
  const apart = walk(buys("buy", "car"), buys("sell", "car"), { evidence: ev([]), covered });
  assert.deepEqual(apart.differences.map((d) => [d.kind, d.lemma]), [["leftover", "buy"], ["leftover", "sell"]]);
});

test("negation is read from the parser's feature, and a leftover pronoun is not a difference", () => {
  const neg = walk(buys("buy", "car"), buys("buy", "car", [[5, "not", "PART", 2, "advmod", "Polarity=Neg"]]), { evidence: ev([]), covered });
  assert.deepEqual(neg.differences.map((d) => [d.kind, d.lemma]), [["leftover", "not"]]);
  const pro = walk(T([1, "rain", "VERB", 0, "root"]), T([1, "it", "PRON", 2, "nsubj"], [2, "rain", "VERB", 0, "root"]), { evidence: ev([]), covered });
  assert.equal(pro.counts.hard, 0);
  assert.equal(pro.leftovers.b[0].matters, false);
});

test("the same words in other roles: a role difference, never silently the same", () => {
  const a = T([1, "service", "NOUN", 2, "nsubj"], [2, "threaten", "VERB", 0, "root"], [3, "user", "NOUN", 2, "obj"]);
  const b = T([1, "user", "NOUN", 2, "nsubj"], [2, "threaten", "VERB", 0, "root"], [3, "service", "NOUN", 2, "obj"]);
  const c = walk(a, b, { evidence: ev([]), covered });
  assert.deepEqual([c.counts.hard, c.counts.role], [0, 2]);
});

test("stop mode ends at the first hard difference and agrees with full mode on same or not", () => {
  const A = buys("buy", "car", [[5, "quickly", "ADV", 2, "advmod"]]), B = buys("sell", "boat");
  const full = walk(A, B, { evidence: ev([]), covered }), stopped = walk(A, B, { evidence: ev([]), covered, stop: true });
  assert.ok(stopped.counts.hard >= 1 && full.counts.hard >= stopped.counts.hard);
  assert.equal(stopped.counts.hard > 0, full.counts.hard > 0);
  assert.ok(stopped.stopped);
  for (const k of ["verdict", "same", "standing"]) assert.equal(k in full, false);
});

test("word evidence: computed on demand, cached by address, nulls shared per (word, bucket)", () => {
  const balls = { buy: ["x1", "x2", "x3"], purchase: ["x1", "x2", "y"], n1: ["q1", "q2", "q3"], n2: ["x1", "r", "s"], n3: ["t", "u", "v"] };
  const fold = { ball: (w) => ({ nodes: new Set(balls[w] ?? []) }), shared: (a, b) => (balls[a] ?? []).filter((x) => (balls[b] ?? []).includes(x)).length };
  const E = makeEvidence(fold, { pool: ["n1", "n2", "n3"], seed: "t", nulls: 3 });
  const e = E.evidence("buy", "purchase");
  assert.deepEqual([e.shared, e.sizes, e.null.n, e.null.p95], [2, [3, 3], 3, 1]);
  E.evidence("buy", "purchase"); E.evidence("buy", "n3");
  const s = E.stats();
  assert.deepEqual([s.asked, s.computed, s.nullCounts], [3, 2, 3]);
  assert.equal(E.evidence("buy", "nothere").empty, true);
  assert.equal("above" in e, false);
});
