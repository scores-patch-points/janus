// needs $PHAROS_LIB (pharos/lib/pharos.mjs) with eoql beside it
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { pathToFileURL } from "node:url";
import { weaveClaims } from "./claim-links.mjs"; import { probeAnswers } from "./probe-answers.mjs"; import { claimsFromRows } from "./claims-from-rows.mjs";
const LIB = process.env.PHAROS_LIB ?? "", EOQL = LIB ? path.join(path.dirname(LIB), "..", "eoql", "src", "index.mjs") : "";
const skip = LIB && fs.existsSync(LIB) && fs.existsSync(EOQL) ? false : "pharos library or its eoql not found (set PHAROS_LIB)";
const P = skip ? null : await import(pathToFileURL(LIB).href), E = skip ? null : await import(pathToFileURL(EOQL).href);
const C = (rel, a, b, g = {}) => ({ rel, a, b, polarity: "+", ...g }), PAIR = "pair:abcd1234abcd1234";
const log = (claims, grounds = {}) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-")), h = P.open("t", { dir, writer: "w" }); weaveClaims(P, h, claims, {}, grounds); return E.open(`jsonl:${dir}/w.jsonl`); };
const ans = (hh, sides, probes) => probeAnswers(E, hh, { pair: PAIR, sides, probes });
const by = (rows) => Object.fromEntries(rows.map((r) => [`${r.body.side}:${r.body.probe}`, r]));
const G = { where: { s0: "docA", s1: "docA", t0: "docB" } };
test("a side reads only the claims inside its ground; the entry has the contract's shape", { skip }, () => {
  const hh = log([C("defeat", "Bell", "Greene", { where: "s0" }), C("defeat", "Jack", "Moore", { where: "t0" }), C("defeat", "Bell", "Hall", { where: "t0" })], G);
  const r = ans(hh, { a: { about: "Bell", where: "docA" }, b: { about: "Bell", where: "docB" } }, ["defeat"]), x = by(r);
  assert.equal(x["a:defeat"].body.value, "Greene", "docA says Bell defeated Greene"); assert.equal(x["b:defeat"].body.value, "Hall", "docB says Bell defeated Hall, and nothing from docA leaks in");
  const e = x["a:defeat"]; assert.equal(e.cell, "INS·Figure"); assert.equal(e.kind, "probe-answer"); assert.equal(e.addr, "answer:abcd1234abcd1234:a:defeat"); assert.equal(e.body.pair, PAIR); assert.equal(e.of.length, 1); assert.match(e.body.addr, /^claim:/);
});
test("silence is an entry with a reason and no value; a negated claim is not a value", { skip }, () => {
  const hh = log([C("defeat", "Bell", "Greene", { where: "s0" }), { rel: "defeat", a: "Bell", b: "Moore", polarity: "-", where: "s0" }], G);
  const x = by(ans(hh, { a: { about: "Bell", where: "docA" }, b: { about: "Bell", where: "docB" } }, ["defeat", "capture"]));
  assert.equal(x["a:defeat"].body.value, "Greene", "the denied claim is not a second value"); assert.equal(x["b:defeat"].body.value, null); assert.match(x["b:defeat"].body.why, /silent/); assert.deepEqual(x["b:defeat"].of, []);
  assert.equal(x["a:capture"].body.value, null);
});
test("several values are shown, never merged; a literal is not flagged as a referent, a referent is", { skip }, () => {
  const hh = log([C("defeat", "Bell", "Greene", { where: "s0" }), C("defeat", "Bell", "Hall", { where: "s1" }), C("age", "Bell", "30", { where: "s0", object: "literal" })], G);
  const x = by(ans(hh, { a: { about: "Bell", where: "docA" }, b: { about: "Bell", where: "docB" } }, ["defeat", "age"]));
  assert.equal(x["a:defeat"].body.value, JSON.stringify(["Greene", "Hall"])); assert.equal(x["a:defeat"].body.referent, true); assert.equal(x["a:age"].body.value, "30"); assert.equal(x["a:age"].body.referent, undefined);
});
test("the whole chain from the reader's rows: rows -> claims -> claim-links -> probe-answers, oblique role included", { skip }, () => {
  const rows = (spec, s0) => spec.trim().split("\n").map((l) => { const [id, form, lemma, upos, head, deprel, feats] = l.trim().split(/\s+/); return { s: s0, id: +id, form, lemma, upos, head: +head, deprel, feats: feats ?? "" }; });
  const A = claimsFromRows(rows(`1 Members member NOUN 2 nsubj\n2 began begin VERB 0 root\n3 a a DET 4 det\n4 campaign campaign NOUN 2 obj\n5 against against ADP 6 case\n6 Serbs Serbs PROPN 4 nmod`, 0), { doc: "docA" });
  const hh = log(A.claims, A.grounds);
  const x = by(ans(hh, { a: { about: "campaign", where: "docA" }, b: { about: "Members", where: "docA" } }, ["against", "begin"]));
  assert.equal(x["a:against"].body.value, "Serbs", "the referent in the oblique 'against Serbs' is an answer"); assert.equal(x["b:begin"].body.value, "campaign");
});
test("answers do not depend on the order the claims were woven", { skip }, () => {
  const cl = [C("defeat", "Bell", "Greene", { where: "s0" }), C("defeat", "Bell", "Hall", { where: "s1" }), C("capture", "Bell", "Fort", { where: "s0" })], s = { a: { about: "Bell", where: "docA" }, b: { about: "Bell", where: "docB" } };
  const f = (c) => JSON.stringify(ans(log(c, G), s, ["defeat", "capture"]).map((r) => [r.addr, r.body.value, r.body.referent]));
  assert.equal(f(cl), f([...cl].reverse()));
});
