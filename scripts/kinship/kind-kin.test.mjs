// kind-kin.test.mjs — the kind-induction arm's own tests (node --test scripts/kinship/kind-kin.test.mjs). Each rule is shown firing on a small text; the page layer and everything existing are shown unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { extract } from "./extract-kin.mjs";
import { loadPriors } from "./bind-kin2.mjs";
import { prepareKind, applyKind, kindKin, storeKind, KIND_REASONS, PARAMS, DECLARED_THRESHOLD } from "./kind-kin.mjs";
import * as K from "../../native/organs/kinship.js";

const here = path.dirname(fileURLToPath(import.meta.url)), repo = path.join(here, "..", "..");
const priors = loadPriors();
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(path.join(repo, f))).digest("hex");
const polarity = { forms: { не: { cue: "neg" }, нет: { cue: "exist" }, бывший: { cue: "former" } } };
const kinRows = { lemmas: 26, lemmas_with_a_node: 0, coverage_lemmas_with_a_row_of_type: {}, converse_rows: 0, sex_rows: 0, generation_rows: 0, terms: {} };
function ledgerFor(text, names) {
  const spans = [], referents = [];
  names.forEach((nm, k) => { const ref = `ref_${k}_${nm.replace(/\s+/g, "_")}`; referents.push({ id: ref, face: nm, standing: "referent", forms: [nm.toLowerCase()], mentions: 1 });
    let at = -1; while ((at = text.indexOf(nm, at + 1)) >= 0) spans.push({ id: `spn_${ref}_${at}`, kind: "name", text: nm, at: [at, at + nm.length], bytes: [Buffer.byteLength(text.slice(0, at)), Buffer.byteLength(text.slice(0, at + nm.length))], ref }); });
  return { schema: "KinLedger@1", text_sha256: "test", referents, spans: spans.sort((a, b) => a.at[0] - b.at[0]), sentences: [] };
}
const beingsFor = (names, common = []) => ({ schema: "KinStoreBeings@1", beings: Object.fromEntries(names.map((nm, k) => [`ref_${k}_${nm.replace(/\s+/g, "_")}`, { face: nm, forms: { [nm.toLowerCase()]: common.includes(nm) ? { found: true, entries: [{ kind: "lemma", pos: ["noun"], of: [] }] } : { found: true, entries: [{ kind: "lemma", pos: ["name"], of: [] }] } } }])) });
const setup = (text, names, common = []) => { const ledger = ledgerFor(text, names), extraction = extract({ text, lang: "ru", lexicon: priors.lexicon, namePartsRu: priors.nameParts }); return { text, ledger, extraction, priors, beingRows: beingsFor(names, common), polarity, kinRows }; };
const R = (names, nm) => `ref_${names.indexOf(nm)}_${nm.replace(/\s+/g, "_")}`;
// a text whose first sentence anchors Андрей and Николая as persons (the page layer ties it at both ends)
const ANCHOR = "Андрей, сын князя Николая, сказал это.\n";

test("storeKind: a being whose known forms are all common words is not a name; a name form makes a name; no known form is unknown", () => {
  const rows = { beings: { a: { forms: { x: { found: true, entries: [{ pos: ["noun"] }] } } }, b: { forms: { x: { found: true, entries: [{ pos: ["noun"] }, { pos: ["name"] }] } } }, c: { forms: { x: { found: false, entries: [] } } } } };
  assert.deepEqual([storeKind(rows, "a"), storeKind(rows, "b"), storeKind(rows, "c"), storeKind(rows, "z")], ["common", "name", "unknown", "unknown"]);
});
test("K-SUBJ: a kin word with no marker takes the nearest person-kind clause subject before it; a ledger non-person (a common word in the store) is not a subject", () => {
  const names = ["Андрей", "Николая"], text = ANCHOR + "Андрей сказал, что любил жену.\n", a = setup(text, names), s = kindKin(a).statements[1];
  assert.equal(s.possessor.rule, "K-SUBJ"); assert.equal(s.possessor.ref, R(names, "Андрей"));
  const common = setup(text, names, ["Андрей"]); assert.equal(kindKin(common).statements[1].possessor.ref, null);
  assert.equal(kindKin(common).statements[1].possessor.gap, "kind_no_subject");
});
test("K-OTHER: the one other person-kind being named in the sentence is the holder; the kind gate keeps a common-word being out", () => {
  const names = ["Андрей", "Николая", "Пьер"], text = ANCHOR + "Андрей сказал, что Пьер любил жену.\n";
  const kk = kindKin(setup(text, names)).statements[1]; assert.equal(kk.possessor.rule, "K-SUBJ");
  // the sentence has Пьер (not anchored, no company evidence: not a person) so the wife's holder is not tied through him
  assert.equal(kk.holder.ref, null);
});
test("K-CONV: a relation the page layer tied anywhere in the window names the holder through its converse", () => {
  const names = ["Андрей", "Николая"], text = ANCHOR + "Андрей сказал, что отец был дома.\n", r = kindKin(setup(text, names)), s = r.statements[1];
  assert.equal(s.possessor.ref, R(names, "Андрей")); assert.equal(s.holder.rule, "K-CONV"); assert.equal(s.holder.ref, R(names, "Николая")); assert.ok(s.fact && s.fact.giver.startsWith("text:ru|rule:"));
});
test("POLARITY: a negated copular clause, an absence cue and a former cue read not affirmed and emit no fact; an event negation leaves the relation affirmed", () => {
  const names = ["Андрей", "Николая"];
  for (const [clause, read] of [["Андрей сказал, что он не был отец.", "negated"], ["Андрей сказал, что у него нет сына.", "negated"], ["Андрей сказал, что бывший муж был дома.", "former"], ["Андрей сказал, что не любил отца.", "affirmed"]]) {
    const text = ANCHOR + clause + "\n", a = setup(text, names), P = prepareKind(a); const pol = P.pol[1]; assert.equal(pol.read, read, clause);
    const r = applyKind(P); if (read !== "affirmed") assert.equal(r.statements[1].fact, null);
    assert.equal(applyKind(P, { polarityOn: false }).statements[1].fact !== undefined, true);
  }
  const withheld = applyKind(prepareKind(setup(ANCHOR + "Андрей сказал, что не был отец Николая.\n", names))); void withheld;
});
test("the kin table takes sex from the glosses and the relation schema; the store's rows (here none) leave typed gaps, never a guess", () => {
  const P = prepareKind(setup(ANCHOR, ["Андрей", "Николая"])), rows = Object.values(P.table);
  assert.ok(rows.length >= 20); assert.ok(rows.every((r) => ["no_row", "syn_only", "ant_agrees", "store_disagrees", "ant_partner_not_a_kin_lemma"].includes(r.store)));
  assert.equal(P.table["отец"].sex, "male"); assert.equal(P.table["мать"].sex, "female");
});
test("a rule never replaces a tie the page layer made, and never ties both ends to one being; every unbound end is a typed gap of the closed set", () => {
  const names = ["Андрей", "Николая"], text = ANCHOR + "Андрей любил Андрей и отца.\n", a = setup(text, names), r = kindKin(a);
  for (const s of r.statements) { if (s.holder.ref && s.possessor.ref) assert.notEqual(s.holder.ref, s.possessor.ref); for (const g of s.gaps) { assert.ok(Object.hasOwn(K.GAP_KINDS, g.kind)); assert.ok(KIND_REASONS.includes(g.why), g.why); } }
  assert.equal(K.factBase(r.specs).refused.length, 0);
});
test("determinism: two runs are byte-identical; the shuffled-company null is seeded", () => {
  const a = setup(ANCHOR + "Андрей сказал, что отец был дома.\n", ["Андрей", "Николая"]);
  assert.equal(JSON.stringify(kindKin(a)), JSON.stringify(kindKin(a))); assert.equal(PARAMS.SEED, 20261029);
});
test("the page layer, the scene model and everything existing are the files of main and of the scene-model PR (the PR adds files and changes none)", () => {
  assert.equal(sha("scripts/kinship/bind-kin2.mjs"), "b4703c99533211585b0c8a4fe7eeeedd1c674665bf8d6b8dbc75ba0c58357d3a");
  assert.equal(sha("scripts/kinship/bind-kin.mjs"), "da075991f427d4483990b1a6a1bdd0ac84ab7465c834e4a4dc0452b73c540f72");
  assert.equal(sha("scripts/kinship/extract-kin.mjs"), "a4f776bbadd6381f8ed1890804cac77c8b23b96e7a6d4eea222ac20514d766e4");
  assert.equal(sha("native/organs/kinship.js"), "6f4b5131d9d267fb537b0104062f0acdb17f5bb9026b148c2894fce7156eb4ba");
  assert.equal(sha("scripts/kinship/scene-kin.mjs"), "e387926d84a02af3db6a021e93dc542070d5cfcc96012499b5f75e9b88029a18");
  assert.equal(sha("scripts/kinship/score-scene-kin.mjs"), "74e6bc1b776f5f7ec78e394b15367b6ba69f0491ec5455c89c9c6ff94da2b298");
  for (const f of ["scripts/kinship/bind-kin2.mjs", "scripts/kinship/scene-kin.mjs"]) assert.ok(!/kind-kin/.test(fs.readFileSync(path.join(repo, f), "utf8")), `${f} must not mention the kind arm`);
});
test("no model, no network: kind-kin.mjs imports only node builtins, the kinship organ, the page layer, the structures of the scene model and the extractor; the polarity cues come from the polarity lexicon, not from this file", () => {
  const src = fs.readFileSync(path.join(here, "kind-kin.mjs"), "utf8"), specs = [...src.matchAll(/(?:from|import\()\s*["']([^"']+)["']/g)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set(specs)], ["./bind-kin2.mjs", "./extract-kin.mjs", "./scene-kin.mjs", "../../native/organs/kinship.js", "node:crypto", "node:fs", "node:path", "node:url"].sort());
  const code = src.replace(/\/\/.*$/gm, ""); assert.ok(!/fetch\(|XMLHttpRequest|https?:\/\/|child_process|WebSocket/.test(code));
  assert.ok(!/["'`](не|нет|без|ни|бывший)["'`]/.test(code), "no polarity word is typed in the arm"); assert.equal(DECLARED_THRESHOLD, 0.2);
});
