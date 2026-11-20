import test from "node:test"; import assert from "node:assert/strict"; import { nestOf, compose } from "./question-nest.mjs";
const R = (id, form, lemma, upos, head, deprel, at, feats = "") => ({ id, form, lemma, upos, head, deprel, at, end: at + form.length, feats });
// "Where does the person Maria hired live now?" as the reader parses it (captured): the relative clause survives, the outer clause does not
const text = "Where does the person Maria hired live now?";
const rows = [R(1,"Where","where","ADV",9,"acl",0,"PronType=Rel"),R(2,"does","do","AUX",9,"acl",6),R(3,"the","the","DET",4,"det",11),R(4,"person","person","NOUN",9,"compound",15),R(5,"Maria","Maria","PROPN",6,"nsubj",22),R(6,"hired","hire","VERB",4,"acl:relcl",28),R(7,"live","live","ADV",6,"advmod",34),R(8,"now","now","ADV",6,"advmod",39),R(9,"?","?","PUNCT",0,"root",42)];
test("a noun phrase with a relative clause is found by the tags and cut by offsets; what follows the relative verb stays with the outer clause", () => {
  const n = nestOf(rows, text); assert.equal(n.np, "the person Maria hired"); assert.deepEqual(n.inner, { lemma: "hire", rel: "hire", a: "Maria" }); assert.equal(n.outerText, "Where does Someone live now?");
  assert.equal(nestOf(rows.filter((r) => r.deprel !== "acl:relcl"), text), null, "no relative clause, no sub-question");
  assert.equal(nestOf(rows.map((r) => (r.id === 5 ? { ...r, deprel: "dep" } : r)), text), null, "a relative clause with no subject of its own is not cut");
});
const marks = [{ a: "Maria", rel: "hire", b: "Victor", at: "s0", polarity: "+" }, { a: "Maria", rel: "hire", b: "Oscar", at: "s5", polarity: "+" }, { a: "Anna", rel: "live_in", b: "Oxford", at: "s6", polarity: "+" }];
const outerRows = [R(1,"Where","where","ADV",4,"advmod",0,"PronType=Rel"),R(2,"does","do","AUX",4,"aux",6),R(3,"Someone","someone","PRON",4,"nsubj",11),R(4,"live","live","VERB",0,"root",19)];
test("compose: each value of the inner answer is substituted into the outer clause and judged; the basis names the composition prior and its giver", () => {
  const seen = []; const j = compose(nestOf(rows, text), { read: () => outerRows, marks, giver: "the asker", judge: (rs) => { seen.push(rs.find((r) => r.id === 3).form); return { standing: "stands", finding: "ok", basis: { material: ["turn 3"], priors: [] } }; } });
  assert.deepEqual(seen, ["Victor", "Oscar"]); assert.equal(j.standing, "stands");
  assert.deepEqual(j.basis.priors, [{ kind: "relative_clause_composition", rel: "hire", giver: "the asker" }]); assert.deepEqual(j.basis.material, ["turn 1", "turn 6", "turn 3"]);
});
test("compose: only when EVERY value stands does it stand, only when every value is contradicted is it contradicted, a mixture is a hole; no inner marks is a hole with NOMINATED, giverless candidates", () => {
  const mk = (sts) => { let i = 0; return compose(nestOf(rows, text), { read: () => outerRows, marks, judge: () => ({ standing: sts[i++] }) }).standing; };
  assert.equal(mk(["contradicted", "contradicted"]), "contradicted"); assert.equal(mk(["hole", "hole"]), "hole"); assert.equal(mk(["stands", "hole"]), "hole", "a partly answered set is a hole"); assert.equal(mk(["stands", "contradicted"]), "hole");
  const none = compose({ ...nestOf(rows, text), inner: { lemma: "hire", rel: "hire", a: "Anna" } }, { read: () => outerRows, marks, judge: () => ({}) });
  assert.equal(none.standing, "hole"); assert.deepEqual(none.candidate_priors.map((c) => [c.right, c.standing, c.giver]), [["live_in", "nominated", null]]);
});
test("the relative subject is the clause's own noun, never the relative pronoun; a relative clause headed by a non-verb is not cut", () => {
  const t2 = "Where does the person who Maria hired live now?";
  const r2 = [R(1,"Where","where","ADV",10,"acl",0,"PronType=Rel"),R(2,"does","do","AUX",10,"acl",6),R(3,"the","the","DET",4,"det",11),R(4,"person","person","NOUN",10,"compound",15),R(5,"who","who","PRON",7,"nsubj",22,"PronType=Rel"),R(6,"Maria","Maria","PROPN",7,"nsubj",26),R(7,"hired","hire","VERB",4,"acl:relcl",32)];
  assert.equal(nestOf(r2, t2).inner.a, "Maria");
  assert.equal(nestOf(r2.map((r) => (r.id === 7 ? { ...r, upos: "ADJ" } : r)), t2), null);
});
