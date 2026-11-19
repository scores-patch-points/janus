import test from "node:test"; import assert from "node:assert/strict";
import { claimsFromRows } from "./claims-from-rows.mjs";
// rows from a compact spec: "id form lemma upos head deprel [feats]" per word, sentences separated by a blank line
const rowsOf = (spec) => spec.trim().split(/\n\s*\n/).flatMap((sent, s) => sent.trim().split("\n").map((l) => { const [id, form, lemma, upos, head, deprel, feats] = l.trim().split(/\s+/); return { s, id: +id, form, lemma, upos, head: +head, deprel, feats: feats ?? "" }; }));
const out = (spec) => claimsFromRows(rowsOf(spec), { doc: "docA" });
const flat = (r) => r.claims.map((c) => `${c.polarity === "-" ? "not " : ""}${c.a} ${c.rel} ${c.b}${c.when ? " @" + c.when : ""}`).sort();
test("verb with subject and object, and a year as the claim's time", () => {
  const r = out(`1 Bell Bell PROPN 2 nsubj\n2 defeated defeat VERB 0 root\n3 Greene Greene PROPN 2 obj\n4 in in ADP 5 case\n5 1912 1912 NUM 2 obl`);
  assert.deepEqual(flat(r), ["Bell defeat Greene @1912"]); assert.equal(r.claims[0].where, "s0"); assert.deepEqual(r.grounds.where, { s0: "docA" });
});
test("an oblique role with a preposition is a claim about the referent: 'campaign against Serbs'", () => {
  const r = out(`1 Members member NOUN 2 nsubj\n2 began begin VERB 0 root\n3 a a DET 4 det\n4 campaign campaign NOUN 2 obj\n5 against against ADP 6 case\n6 Serbs Serbs PROPN 4 nmod`);
  assert.deepEqual(flat(r), ["Members begin campaign", "campaign against Serbs"]);
  const o = out(`1 Bell Bell PROPN 2 nsubj\n2 fought fight VERB 0 root\n3 against against ADP 4 case\n4 Greene Greene PROPN 2 obl`); assert.deepEqual(flat(o), ["Bell fight_against Greene"]);
});
test("negation is the parser's feature, not a word; the passive agent is the subject", () => {
  assert.deepEqual(flat(out(`1 Bell Bell PROPN 4 nsubj\n2 did do AUX 4 aux\n3 not not PART 4 advmod Polarity=Neg\n4 defeat defeat VERB 0 root\n5 Greene Greene PROPN 4 obj`)), ["not Bell defeat Greene"]);
  assert.deepEqual(flat(out(`1 Greene Greene PROPN 3 nsubj:pass\n2 was be AUX 3 aux:pass\n3 defeated defeat VERB 0 root\n4 by by ADP 5 case\n5 Bell Bell PROPN 3 obl:agent`)), ["Bell defeat Greene"]);
});
test("copula, compound names, and a noun phrase without determiners", () => {
  assert.deepEqual(flat(out(`1 Jack Jack PROPN 5 nsubj\n2 is be AUX 5 cop\n3 a a DET 5 det\n4 dollar dollar NOUN 5 compound\n5 coin coin NOUN 0 root`)), ["Jack is dollar coin"]);
  assert.deepEqual(flat(out(`1 Jack Jack PROPN 3 nsubj\n2 is be AUX 3 cop\n3 tall tall ADJ 0 root`)), ["Jack is tall"]);
  assert.deepEqual(flat(out(`1 Black Black PROPN 2 compound\n2 Jack Jack PROPN 3 nsubj\n3 won win VERB 0 root\n4 Marshall Marshall PROPN 5 flat:name\n5 Bell Bell PROPN 3 obj`)), ["Black Jack win Marshall Bell"]);
});
test("a pronoun is a typed gap and makes no claim; a verb with no subject is a typed gap", () => {
  const r = out(`1 He he PRON 2 nsubj\n2 defeated defeat VERB 0 root\n3 Greene Greene PROPN 2 obj`); assert.deepEqual(r.claims, []); assert.equal(r.gaps[0].kind, "unbound_pronoun");
  const q = out(`1 defeated defeat VERB 0 root\n2 Greene Greene PROPN 1 obj`); assert.equal(q.gaps[0].kind, "no_subject"); assert.deepEqual(q.claims, []);
  const v = out(`1 Bell Bell PROPN 2 nsubj\n2 defeated defeat VERB 0 root\n3 him he PRON 2 obj`); assert.deepEqual(v.claims, []); assert.equal(v.gaps[0].kind, "unbound_pronoun");
});
test("a coordination under a verb is reported, not silently dropped", () => {
  const r = out(`1 Bell Bell PROPN 2 nsubj\n2 defeated defeat VERB 0 root\n3 Greene Greene PROPN 2 obj\n4 and and CCONJ 5 cc\n5 Moore Moore PROPN 3 conj`); assert.ok(r.gaps.some((g) => g.kind === "conj_not_expanded"));
});
test("literal values: a number or an adjective is not a referent", () => {
  const r = out(`1 Ann Ann PROPN 2 nsubj\n2 has have VERB 0 root\n3 3 3 NUM 4 nummod\n4 sons son NOUN 2 obj`); assert.equal(r.claims[0].object, "referent");
  assert.equal(out(`1 Jack Jack PROPN 3 nsubj\n2 is be AUX 3 cop\n3 tall tall ADJ 0 root`).claims[0].object, "literal");
  const n = out(`1 Ann Ann PROPN 3 nsubj\n2 is be AUX 3 cop\n3 30 30 NUM 0 root`).claims[0]; assert.equal(n.object, "literal"); assert.equal(n.b, "30");
});
