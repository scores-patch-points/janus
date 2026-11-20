import test from "node:test"; import assert from "node:assert/strict"; import { questionPattern, answer } from "./question-from-rows.mjs";
// rows captured from the reader (khora pharos-reading, eng) for each question
const R = (id, form, lemma, upos, head, deprel, feats = "") => ({ id, form, lemma, upos, head, deprel, feats });
const Q = {
  whereLive: [R(1,"Where","where","ADV",4,"advmod","PronType=Rel"),R(2,"does","do","AUX",4,"aux"),R(3,"Tom","Tom","PROPN",4,"nsubj"),R(4,"live","live","VERB",0,"root"),R(5,"now","now","ADV",4,"advmod","PronType=Dem")],
  whoLives: [R(1,"Who","who","PRON",2,"nsubj","PronType=Rel"),R(2,"lives","live","VERB",0,"root"),R(3,"in","in","ADP",4,"case"),R(4,"Leeds","Leeds","PROPN",2,"obl")],
  before: [R(1,"Where","where","ADV",4,"advmod","PronType=Rel"),R(2,"did","do","AUX",4,"aux"),R(3,"Tom","Tom","PROPN",4,"nsubj"),R(4,"live","live","VERB",0,"root"),R(5,"before","before","ADV",4,"advmod")],
  polar: [R(1,"Does","do","AUX",3,"aux"),R(2,"Anna","Anna","PROPN",3,"nsubj"),R(3,"work","work","VERB",0,"root"),R(4,"at","at","ADP",5,"case"),R(5,"Zebra","Zebra","PROPN",3,"obl")],
  broken: [R(1,"Where","where","ADV",9,"acl","PronType=Rel"),R(6,"hired","hire","VERB",4,"acl:relcl"),R(9,"?","?","PUNCT",0,"root")],
};
const C = (a, rel, b, at, polarity = "+") => ({ a, rel, b, at, polarity });
const claims = [C("Tom","live_in","Derby","s3"),C("Anna","live_in","Leeds","s5"),C("Tom","live_in","Leeds","s87"),C("Lena","live_in","Leeds","s60"),C("Lena","live_in","Derby","s90"),C("Anna","work_at","Acme","s7")];
const F = { functional: ["live"] };
test("a question is a pattern with a hole, read from the parse", () => {
  assert.deepEqual(questionPattern(Q.whereLive), { kind: "hole-b", lemma: "live", a: "Tom", order: "current", neg: false });
  assert.deepEqual(questionPattern(Q.whoLives), { kind: "hole-a", rel: "live_in", b: "Leeds", order: "current", neg: false });
  assert.equal(questionPattern(Q.before).order, "previous"); assert.equal(questionPattern(Q.polar).kind, "polar");
});
test("a broken or nested parse is a typed gap, never a guess", () => { assert.equal(questionPattern(Q.broken).gap, "no_verb_root"); });
test("answers: latest of a single-valued relation, previous, inverse over the LATEST of each being, polar", () => {
  assert.equal(answer(questionPattern(Q.whereLive), claims, F).value, "Leeds");
  assert.equal(answer(questionPattern(Q.before), claims, F).value, "Derby");
  assert.deepEqual(answer(questionPattern(Q.whoLives), claims, F).value, ["Anna", "Tom"], "Lena moved to Derby, so she no longer lives in Leeds");
  assert.equal(answer(questionPattern(Q.polar), claims, F).value, undefined, "work is not declared and Anna's Acme is on record: Zebra is not ruled out");
  assert.equal(answer(questionPattern(Q.polar), claims, F).gap, "no_single_value_prior");
  assert.equal(answer(questionPattern(Q.polar), claims, { functional: ["work"] }).value, false);
});
test("no single-value prior means no 'current': the marks are listed and the gap is typed", () => { const a = answer(questionPattern(Q.whereLive), claims, {}); assert.equal(a.gap, "no_single_value_prior"); assert.equal(a.marks.length, 2); });
test("silence is a hole, never a no", () => { assert.equal(answer(questionPattern(Q.polar), [], { functional: ["work"] }).gap, "not_on_record"); });
