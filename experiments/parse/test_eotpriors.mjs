import assert from "node:assert/strict";
import { recordsOf, newTables, mineInto, weightsE, totalE, surfaceRecord } from "./eotpriors.mjs";
const R = (f, l, u, h, d) => ({ form: f, lemma: l, upos: u, head: h, deprel: d });
// "she ate pizza with a fork" (verb attach) and "she ate pizza with fork": the determiner is ABSORBED, the record does not change
const s1 = [R("She", "she", "PRON", 2, "nsubj"), R("ate", "eat", "VERB", 0, "root"), R("pizza", "pizza", "NOUN", 2, "obj"), R("with", "with", "ADP", 6, "case"), R("a", "a", "DET", 6, "det"), R("fork", "fork", "NOUN", 2, "obl")];
const s2 = [R("She", "she", "PRON", 2, "nsubj"), R("ate", "eat", "VERB", 0, "root"), R("pizza", "pizza", "NOUN", 2, "obj"), R("with", "with", "ADP", 5, "case"), R("fork", "fork", "NOUN", 2, "obl")];
const a = recordsOf(s1).get(6), b = recordsOf(s2).get(5); assert.equal(a.m, "a+with", "markers are absorbed, sorted, order-free"); assert.equal(b.m, "with"); assert.equal(a.h, "eat|VERB"); assert.equal(a.rel, "obl");
const mk = recordsOf(s1).get(4); assert.equal(mk.d, "with|ADP", "a marker's record is itself"); assert.equal(mk.h, "fork|NOUN", "...attached to its host");
// the surface twin sees only strings and the previous token
assert.equal(surfaceRecord(s1, 5, 2, "obl").m, "a"); assert.equal(surfaceRecord(s1, 5, 2, "obl").d, "fork");
// mining: train on verb-attached "ate ... with fork"; a candidate that attaches to the verb beats one that attaches to the noun, an unseen word abstains
const T = newTables(); for (let i = 0; i < 20; i++) { for (const r of recordsOf(s2).values()) mineInto(T, r); }
const good = { d: "fork|NOUN", m: "with", rel: "obl", h: "eat|VERB" }, bad = { d: "fork|NOUN", m: "with", rel: "nmod", h: "pizza|NOUN" };
assert.ok(totalE(weightsE([T], good)) > totalE(weightsE([T], bad)), "seen configuration outweighs the unseen one");
const u1 = { d: "gizmo|NOUN", m: "with", rel: "obl", h: "eat|VERB" }, u2 = { d: "gizmo|NOUN", m: "with", rel: "obl", h: "eat|VERB" }; assert.equal(totalE(weightsE([T], u1)), totalE(weightsE([T], u2)));
const Tw = newTables(); for (let i = 0; i < 20; i++) for (const r of recordsOf(s2).values()) mineInto(Tw, r, () => "nsubj"); assert.ok(totalE(weightsE([Tw], good)) < totalE(weightsE([T], good)), "the shuffled-label twin does not support the true relation");
console.log("test_eotpriors: ok");
