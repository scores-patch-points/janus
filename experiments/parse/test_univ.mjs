import assert from "node:assert/strict";
import { validTree, universes, marginalB, family } from "./univlib.mjs";
assert.equal(validTree([2, 0, 2]), true); assert.equal(validTree([2, 1]), false, "no root"); assert.equal(validTree([0, 0, 2]), false, "two roots"); assert.equal(validTree([2, 3, 2, 0]), false, "cycle 2<->3");
assert.equal(validTree([0, 1, 2]), true); assert.equal(validTree([3, 1, 2]), false, "pure cycle");
// two independent forks over a 4-token sentence; one combination makes a cycle and is pruned
const forks = [{ i: 1, A: { head: 1, rel: "x" }, B: { head: 3, rel: "x" }, pA: 0.5 }, { i: 2, A: { head: 1, rel: "y" }, B: { head: 2, rel: "y" }, pA: 0.5 }];
const us = universes([0, 0, 0, 1], forks); assert.equal(us.length, 4);
// base token 1 root(0); token2->? token3->? : B,B gives 2<-3 and 3<-2: cycle
assert.equal(us.filter((u) => u.valid).length, 3, "the cycle universe is pruned"); assert.ok(Math.abs(us.reduce((a, u) => a + u.p, 0) - 1) < 1e-12, "weights normalise over valid universes");
assert.equal(us.find((u) => u.mask === 3).valid, false);
assert.ok(Math.abs(marginalB(us, 0) - 1 / 3) < 1e-9, "marginal of a fork after pruning"); assert.equal(family("nsubj:pass"), "CORE"); assert.equal(family("obl:tmod"), "MOD"); assert.equal(family("punct"), "OTHER");
console.log("test_univ: ok");
