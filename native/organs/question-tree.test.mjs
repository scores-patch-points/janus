import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { pathToFileURL } from "node:url";
import { cut, judge, build, weave, CONNECTIVES } from "./question-tree.mjs";
const LIB = process.env.PHAROS_LIB ?? "", skip = LIB && fs.existsSync(LIB) ? false : "pharos library not found (set PHAROS_LIB to pharos/lib/pharos.mjs)";
const P = skip ? null : await import(pathToFileURL(LIB).href), W = skip ? null : await import(pathToFileURL(path.join(path.dirname(LIB), "writers.mjs")).href);
const R = (s, id, form, upos, head, deprel, at, feats = "") => ({ s, id, form, lemma: form.toLowerCase(), upos, head, deprel, at, end: at + form.length, feats });
// "If A, then B. But C" as tagged tokens (offsets are the text's)
const text = "If Tom runs, then Ann should go. But Ann sleeps";
const rows = [R(0,1,"If","SCONJ",3,"mark",0),R(0,2,"Tom","PROPN",3,"nsubj",3),R(0,3,"runs","VERB",0,"root",7),R(0,4,",","PUNCT",3,"punct",11),R(0,5,"then","ADV",8,"advmod",13),R(0,6,"Ann","PROPN",8,"nsubj",18),R(0,7,"should","AUX",8,"aux",22),R(0,8,"go","VERB",3,"advcl",29),R(0,9,".","PUNCT",3,"punct",31),R(1,1,"But","CCONJ",3,"cc",33),R(1,2,"Ann","PROPN",3,"nsubj",37),R(1,3,"sleeps","VERB",0,"root",41)];
test("cut: boundaries are parser tags, the role of a connective comes from the declared table, the span is the text's", () => {
  const f = cut(rows, text); assert.deepEqual(f.map((x) => [x.role, x.text]), [["antecedent", "Tom runs"], ["consequent", "Ann should go."], ["contrast", "Ann sleeps"]]);
  assert.equal(cut(rows, text, {})[0].role, "part", "a connective the table does not hold is typed part, not guessed");
});
const V = (id, form, lemma, upos, head, deprel, feats = "") => ({ id, form, lemma, upos, head, deprel, feats });
const marks = [{ a: "Tom", rel: "live_in", b: "Leeds", at: "s3", polarity: "+" }, { a: "Anna", rel: "work_at", b: "Acme", at: "s4", polarity: "+" }];
test("judge: a modal is a judgement; a false premise under a single-value prior is contradicted; silence is a hole; an unparsable fragment is a gap", () => {
  assert.equal(judge([V(1, "Maria", "maria", "PROPN", 3, "nsubj"), V(2, "should", "should", "AUX", 3, "aux"), V(3, "visit", "visit", "VERB", 0, "root")], marks).standing, "judgement");
  const zurich = [V(1, "Tom", "Tom", "PROPN", 2, "nsubj"), V(2, "lives", "live", "VERB", 0, "root"), V(3, "in", "in", "ADP", 4, "case"), V(4, "Zurich", "Zurich", "PROPN", 2, "obl")];
  assert.equal(judge(zurich, marks, { functional: ["live"] }).standing, "contradicted");
  assert.equal(judge(zurich, marks, { functional: [] }).standing, "hole", "without a single-value prior Zurich is not ruled out");
  assert.equal(judge(zurich, [], { functional: ["live"] }).standing, "hole", "silence is a hole, never a no");
  assert.equal(judge([V(1, "the", "the", "DET", 2, "det"), V(2, "city", "city", "NOUN", 0, "root")], marks).standing, "gap");
});
test("weave: the tree is marks (ask INS, goal SEG, part_of CON, standing EVA by the interpreter) and the writers audit passes for the interpreter and flags the standing if janus wrote it", { skip }, () => {
  const nodes = build(text, rows, { read: (t) => [V(1, t, t, "X", 0, "root")], marks, functional: [] });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qtree-")), h = P.open("t", { dir, writer: "penelope" }); weave(P, h, nodes);
  const es = P.entries(h).filter((e) => !["kind", "frame"].includes(e.kind)), by = (k) => es.filter((e) => e.kind === k);
  assert.equal(by("ask").length, 1); assert.equal(by("goal").length, nodes.length - 1); assert.equal(by("part_of").length, nodes.length - 1); assert.ok(by("standing").length >= 1);
  assert.ok(by("goal").every((e) => e.of.length === 1 && e.of[0] === by("ask")[0].id), "every goal cites the verbatim ask");
  assert.ok(by("standing").every((e) => e.cell === "EVA·Figure"));
  const asPenelope = P.entries(h).map((e) => ({ ...e, by: "penelope" })), asJanus = P.entries(h).map((e) => ({ ...e, by: "janus" }));
  assert.equal(W.audit(asPenelope).ok, true); assert.ok(W.audit(asJanus).violations.some((v) => v.kind === "standing"), "janus may not write a standing: judging is Penelope's");
});

test("a stated premise (a verb with an object) is judged against the marks: stands, contradicted only under a single-value prior, a hole otherwise", () => {
  const hired = (obj) => [V(1, "Maria", "Maria", "PROPN", 2, "nsubj"), V(2, "hired", "hire", "VERB", 0, "root"), V(3, obj, obj, "PROPN", 2, "obj")];
  const ms = [{ a: "Maria", rel: "hire", b: "Victor", at: "s0", polarity: "+" }];
  assert.equal(judge(hired("Victor"), ms).standing, "stands");
  assert.equal(judge(hired("Oscar"), ms, { functional: ["hire"] }).standing, "contradicted");
  assert.equal(judge(hired("Oscar"), ms, { functional: [] }).standing, "hole", "hire is not declared single-valued: Oscar is not ruled out");
  assert.equal(judge(hired("Oscar"), [], { functional: ["hire"] }).standing, "hole", "no mark: silence");
});

test("every standing carries its basis: the material it rests on kept apart from the priors it used, with the giver", () => {
  const zurich = [V(1, "Tom", "Tom", "PROPN", 2, "nsubj"), V(2, "lives", "live", "VERB", 0, "root"), V(3, "in", "in", "ADP", 4, "case"), V(4, "Zurich", "Zurich", "PROPN", 2, "obl")];
  const j = judge(zurich, marks, { functional: ["live"], giver: "the asker" });
  assert.deepEqual(j.basis, { material: ["turn 4"], priors: [{ kind: "single_value", rel: "live", giver: "the asker" }] }, "a contradiction rests on one mark AND on the single-value prior, and says so");
  const hired = [V(1, "Maria", "Maria", "PROPN", 2, "nsubj"), V(2, "hired", "hire", "VERB", 0, "root"), V(3, "Victor", "Victor", "PROPN", 2, "obj")];
  assert.deepEqual(judge(hired, [{ a: "Maria", rel: "hire", b: "Victor", at: "s0", polarity: "+" }]).basis, { material: ["turn 1"], priors: [] }, "a stated premise that is on record needs no prior");
  assert.deepEqual(judge(zurich, [], { functional: ["live"] }).basis, { material: [], priors: [] }, "a hole rests on nothing: silence");
});

test("a sentence's final punctuation stays inside its LAST fragment (without the question mark the parser reads the same words differently); an inner fragment does not take it", () => {
  const txt = "If Tom runs, Ann sleeps?", rs = [R(0,1,"If","SCONJ",3,"mark",0),R(0,2,"Tom","PROPN",3,"nsubj",3),R(0,3,"runs","VERB",0,"root",7),R(0,4,",","PUNCT",3,"punct",11),R(0,5,"Ann","PROPN",6,"nsubj",13),R(0,6,"sleeps","VERB",3,"advcl",17),R(0,7,"?","PUNCT",3,"punct",23)];
  assert.deepEqual(cut(rs, txt).map((x) => x.text), ["Tom runs", "Ann sleeps?"]);
});
