import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import { pathToFileURL } from "node:url";
import { toHyperedges } from "./claims-to-hyperedges.mjs";
const K = process.env.KHORA_KERNEL ?? "/Users/mlacy/Documents/khora/native/kernel", skip = fs.existsSync(`${K}/relation-composition.js`) ? false : "khora kernel not found (set KHORA_KERNEL to khora/native/kernel)";
const RC = skip ? null : await import(pathToFileURL(`${K}/relation-composition.js`).href), HL = skip ? null : await import(pathToFileURL(`${K}/hyperlexicon.js`).href);
const C = (a, rel, b, at, extra = {}) => ({ a, rel, b, at, polarity: "+", ...extra });
test("material becomes witnessed edges; a literal, a negation and an incomplete claim make none and are counted", () => {
  const { edges, skipped } = toHyperedges([C("Maria", "hire", "Victor", "s0"), C("Tom", "is", "tall", "s1", { object: "literal" }), C("Ann", "work_at", "Acme", "s2", { polarity: "-" }), { a: "x", rel: "r" }]);
  assert.equal(edges.length, 1); assert.deepEqual(skipped, { literal: 1, negative: 1, incomplete: 1 }); assert.equal(edges[0].witness, "doc#s0"); assert.equal(edges[0].scope.sequencePosition, 0);
});
test("a chain present in the material is WITHHELD without a given affordance and LICENSED with one, citing the giver and both witnesses", { skip }, () => {
  const { edges } = toHyperedges([C("Maria", "hire", "Victor", "s0"), C("Victor", "live_in", "York", "s1")]);
  const none = RC.evaluateRelationCompositions(edges, HL.createHyperlexicon()); assert.equal(none.licensed.length, 0); assert.equal(none.withheld.length, 1);
  const given = RC.evaluateRelationCompositions(edges, HL.createHyperlexicon({ composition: [{ left: "hire", right: "live_in", standing: "given", giver: "asker", witnesses: [] }] }));
  assert.equal(given.licensed.length, 1); assert.equal(given.licensed[0].provenance.giver, "asker"); assert.deepEqual([...given.licensed[0].witnessRefs], ["doc#s0", "doc#s1"]);
});
test("the ledger composes in narrative order only: a later hire does not chain to an earlier residence (a finding, not a feature of the question)", { skip }, () => {
  const { edges } = toHyperedges([C("Oscar", "live_in", "Bath", "s0"), C("Maria", "hire", "Oscar", "s1")]);
  const r = RC.evaluateRelationCompositions(edges, HL.createHyperlexicon({ composition: [{ left: "hire", right: "live_in", standing: "given", giver: "asker", witnesses: [] }] }));
  assert.equal(r.licensed.length + r.withheld.length, 0, "no chain site at all, with the affordance given: order, not a prior, is what blocks it");
});
