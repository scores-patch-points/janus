import test from "node:test"; import assert from "node:assert/strict";
import { claimsFromRows } from "./claims-from-rows.mjs";
// rows from a compact spec: "id form lemma upos head deprel [feats]" per word, sentences separated by a blank line
const rowsOf = (spec) => spec.trim().split(/\n\s*\n/).flatMap((sent, s) => sent.trim().split("\n").map((l) => { const [id, form, lemma, upos, head, deprel, feats] = l.trim().split(/\s+/); return { s, id: +id, form, lemma, upos, head: +head, deprel, feats: feats ?? "" }; }));
const out = (spec) => claimsFromRows(rowsOf(spec), { doc: "docA" });
const flat = (r) => r.claims.map((c) => `${c.polarity === "-" ? "not " : ""}${c.a} ${c.rel} ${c.b}${c.when ? " @" + c.when : ""}`).sort();
test("verb with subject and object, and a year as the claim's time", () => {
  const r = out(`1 Bell Bell PROPN 2 nsubj\n2 defeated defeat VERB 0 root\n3 Greene Greene PROPN 2 obj\n4 in in ADP 5 case\n5 1912 1912 NUM 2 obl`);
  assert.deepEqual(flat(r), ["Bell defeat Greene @1912"]); assert.equal(r.claims[0].where, "docA"); assert.equal(r.claims[0].at, "s0"); assert.deepEqual(r.grounds.where, {});
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
test("a coordination is expanded: each coordinated subject, object or oblique makes its own claim", () => {
  assert.deepEqual(flat(out(`1 Bell Bell PROPN 2 nsubj\n2 defeated defeat VERB 0 root\n3 Greene Greene PROPN 2 obj\n4 and and CCONJ 5 cc\n5 Moore Moore PROPN 3 conj`)), ["Bell defeat Greene", "Bell defeat Moore"]);
  assert.deepEqual(flat(out(`1 Bell Bell PROPN 4 nsubj\n2 and and CCONJ 3 cc\n3 Hall Hall PROPN 1 conj\n4 defeated defeat VERB 0 root\n5 Greene Greene PROPN 4 obj`)), ["Bell defeat Greene", "Hall defeat Greene"]);
  assert.deepEqual(flat(out(`1 Bell Bell PROPN 2 nsubj\n2 fought fight VERB 0 root\n3 against against ADP 4 case\n4 Greene Greene PROPN 2 obl\n5 and and CCONJ 6 cc\n6 Moore Moore PROPN 4 conj`)), ["Bell fight_against Greene", "Bell fight_against Moore"]);
});
test("a chained coordination (a parser may attach each conjunct to the previous one) is followed to its end", () => {
  assert.deepEqual(flat(out(`1 Bell Bell PROPN 6 nsubj\n2 Hall Hall PROPN 1 conj\n3 and and CCONJ 4 cc\n4 Moore Moore PROPN 2 conj\n5 Fort Fort PROPN 6 obj\n6 took take VERB 0 root`)), ["Bell take Fort", "Hall take Fort", "Moore take Fort"]);
});
test("a relative clause takes its head noun as the subject; a controlled clause is a typed gap, not a no-subject error", () => {
  const r = out(`1 men man NOUN 0 root\n2 who who PRON 3 nsubj PronType=Rel\n3 fought fight VERB 1 acl:relcl\n4 Bell Bell PROPN 3 obj`); assert.ok(r.gaps.every((g) => g.kind !== "no_subject")); assert.deepEqual(flat(r), ["men fight Bell"], "the relative pronoun stands for its head noun");
  assert.deepEqual(flat(out(`1 men man NOUN 0 root\n2 fought fight VERB 1 acl:relcl\n3 Bell Bell PROPN 2 obj`)), ["men fight Bell"], "the head noun is the subject of a relative clause that has none of its own");
  const c = out(`1 Bell Bell PROPN 2 nsubj\n2 tried try VERB 0 root\n3 to to PART 4 mark\n4 flee flee VERB 2 xcomp`); assert.ok(c.gaps.some((g) => g.kind === "controlled_subject")); assert.ok(!c.gaps.some((g) => g.kind === "no_subject"));
  assert.equal(out(`1 defeated defeat VERB 0 root\n2 Greene Greene PROPN 1 obj`).gaps[0].kind, "no_subject");
});
test("literal values: a number or an adjective is not a referent", () => {
  const r = out(`1 Ann Ann PROPN 2 nsubj\n2 has have VERB 0 root\n3 3 3 NUM 4 nummod\n4 sons son NOUN 2 obj`); assert.equal(r.claims[0].object, "referent");
  assert.equal(out(`1 Jack Jack PROPN 3 nsubj\n2 is be AUX 3 cop\n3 tall tall ADJ 0 root`).claims[0].object, "literal");
  const n = out(`1 Ann Ann PROPN 3 nsubj\n2 is be AUX 3 cop\n3 30 30 NUM 0 root`).claims[0]; assert.equal(n.object, "literal"); assert.equal(n.b, "30");
});
test("the reader's referents bind a pronoun and a description to the named referent; a token with no referent stays a gap", () => {
  const rs = rowsOf(`1 He he PRON 2 nsubj\n2 defeated defeat VERB 0 root\n3 Greene Greene PROPN 2 obj`).map((r, i) => ({ ...r, at: [0, 3, 12][i], end: [2, 11, 18][i] }));
  const bind = (a, b) => (a === 0 ? "Bell" : null);
  assert.deepEqual(flat(claimsFromRows(rs, { bind })), ["Bell defeat Greene"], "he is Bell by the reader's binding");
  assert.deepEqual(claimsFromRows(rs, {}).claims, [], "without a binding a pronoun makes no claim"); assert.equal(claimsFromRows(rs, {}).gaps[0].kind, "unbound_pronoun");
  assert.deepEqual(claimsFromRows(rs.map(({ at, end, ...r }) => r), { bind }).claims, [], "no offsets: no binding");
  const num = rowsOf(`1 Ann Ann PROPN 3 nsubj\n2 is be AUX 3 cop\n3 30 30 NUM 0 root`).map((r) => ({ ...r, at: 0, end: 1 })), nc = claimsFromRows(num, { bind: () => "X" }).claims[0]; assert.equal(nc.b, "X" === nc.b ? "never" : "30"); assert.equal(nc.object, "literal", "a number is never bound to a referent");
});
test("tag values are matched exactly, never by containing a pattern: Polarity=Neg2, PronType=Rel2, a deprel conjX or acl:relclx do not match", () => {
  assert.deepEqual(flat(out(`1 Bell Bell PROPN 4 nsubj\n2 did do AUX 4 aux\n3 not not PART 4 advmod Polarity=Neg2\n4 defeat defeat VERB 0 root\n5 Greene Greene PROPN 4 obj`)), ["Bell defeat Greene"], "Neg2 is not Neg");
  assert.deepEqual(flat(out(`1 Bell Bell PROPN 4 nsubj\n2 did do AUX 4 aux\n3 not not PART 4 advmod XPolarity=Neg|Case=Nom\n4 defeat defeat VERB 0 root\n5 Greene Greene PROPN 4 obj`)), ["Bell defeat Greene"], "another key ending in Polarity is not Polarity");
  assert.deepEqual(flat(out(`1 Bell Bell PROPN 4 nsubj\n2 did do AUX 4 aux\n3 not not PART 4 advmod Case=Nom|Polarity=Neg|Tense=Past\n4 defeat defeat VERB 0 root\n5 Greene Greene PROPN 4 obj`)), ["not Bell defeat Greene"], "Polarity=Neg among other features is read");
  assert.equal(out(`1 men man NOUN 0 root\n2 who who PRON 3 nsubj PronType=Rel2\n3 fought fight VERB 1 acl:relcl\n4 Bell Bell PROPN 3 obj`).claims.length, 0, "PronType=Rel2 is not a relative pronoun: no claim, the pronoun is a gap");
  assert.equal(out(`1 men man NOUN 0 root\n2 fought fight VERB 1 acl:relclx\n3 Bell Bell PROPN 2 obj`).claims.length, 0, "acl:relclx is not a relative clause: no head-noun subject");
  assert.equal(out(`1 defeated defeat VERB 0 conjX\n2 Greene Greene PROPN 1 obj`).gaps[0].kind, "controlled_subject", "a deprel conjX is not conj");
  assert.equal(out(`1 defeated defeat VERB 0 conj:extra\n2 Greene Greene PROPN 1 obj`).gaps[0].kind, "no_subject", "conj:extra has the base conj");
});

test("a sentence with no verb the reader can see is a typed gap, not a silent wrong claim (a measured reader defect: `Anna works at Acme` tagged all-noun)", () => {
  const R = (id, form, upos, head, deprel) => ({ s: 0, id, form, lemma: form.toLowerCase(), upos, head, deprel, feats: "" });
  const r = claimsFromRows([R(1, "Anna", "PROPN", 2, "compound"), R(2, "works", "NOUN", 5, "compound"), R(3, "at", "ADP", 4, "case"), R(4, "Acme", "PROPN", 2, "nmod"), R(5, ".", "PUNCT", 0, "root")], { doc: "d" });
  assert.ok(r.gaps.some((g) => g.kind === "no_verb_in_sentence"));
});

test("a claim carries the parser's own tag for each end, so a claim about a name can be told from talk about the discourse", () => {
  const R = (id, form, lemma, upos, head, deprel) => ({ s: 0, id, form, lemma, upos, head, deprel, feats: "" });
  const c = claimsFromRows([R(1, "Tom", "Tom", "PROPN", 2, "nsubj"), R(2, "lives", "live", "VERB", 0, "root"), R(3, "in", "in", "ADP", 4, "case"), R(4, "Leeds", "Leeds", "PROPN", 2, "obl")], { doc: "d" }).claims[0];
  assert.equal(c.aUpos, "PROPN"); assert.equal(c.bUpos, "PROPN");
  const d = claimsFromRows([R(1, "answer", "answer", "NOUN", 2, "nsubj"), R(2, "confirms", "confirm", "VERB", 0, "root"), R(3, "statement", "statement", "NOUN", 2, "obj")], { doc: "d" }).claims[0];
  assert.equal(d.aUpos, "NOUN"); assert.equal(d.bUpos, "NOUN");
});
