import test from "node:test";
import assert from "node:assert/strict";
import { nomosFromPriors, standingOf, licenseNomos, DECLARED_STANDING, languageOf, giverOf, NOMOS_SCHEMA } from "./nomos.js";

const prior = (address, body) => ({ address, stem: address.split("/").pop(), body });

const READ = new Map([
  ["pos-ell.json", { schema: "POSPrior@1", language: "ell", provenance: { giver: "Universal Dependencies — UD_Greek-GDT (train split), human-annotated gold treebank" } }],
  ["frame-eng.json", { schema: "FramePrior@1", language: "eng", provenance: { giver: "Universal Dependencies treebank (train split), human-annotated gold", builder: "khora native/scripts/build-frame-prior.mjs" } }],
  ["morph-cues-grc.json", { schema: "MorphCuesPrior@1", language: { iso: "grc", name: "Ancient Greek" }, provenance: { schema: "Provenance@1", source: "grc_proiel-ud-test.conllu sha256:ac5576c048c57e01a5a6d2e1b9067fb80b4da65cf8b66913e9a273d8b83ba3b8", giver: { value: "the PROIEL treebank", basis: "measured" } } }],
  ["code-kw-python.json", { schema: "CodeKeywordPrior@1", language: "python", provenance: { giver: "tree-sitter grammar arbitrated by CPython 3.14.7", builder: "python_kw_giver.py" } }],
  ["orphan.json", { schema: "What@1", forms: { "?" : {} } }],
]);
const read = (a) => READ.get(a) ?? null;

test("the nomos folds priors into rows: standing from the prior's OWN giver, witnesses = the address", () => {
  const { ledger, stats } = nomosFromPriors([prior("pos-ell.json"), prior("frame-eng.json"), prior("morph-cues-grc.json"), prior("orphan.json")], { read });
  assert.equal(ledger.schema, NOMOS_SCHEMA);
  assert.equal(ledger.rows.length, 4);
  const ell = ledger.rows.find((r) => r.rule.includes("POSPrior@1:ell"));
  assert.equal(ell.standing, DECLARED_STANDING.GIVEN);
  assert.match(ell.giver, /Universal Dependencies/);
  assert.deepEqual(ell.witnesses, ["pos-ell.json"]);
  const grc = ledger.rows.find((r) => r.rule.includes("MorphCuesPrior@1:grc"));
  assert.equal(grc.language, "grc");
  assert.equal(grc.binding, "ac5576c048c57e01a5a6d2e1b9067fb80b4da65cf8b66913e9a273d8b83ba3b8");
  const orphan = ledger.rows.find((r) => r.stem === "orphan.json");
  assert.equal(orphan.standing, DECLARED_STANDING.UNGROUNDED);
  assert.equal(stats.priors, 4);
  assert.equal(stats.byStanding.given, 3);
  assert.equal(stats.byStanding.ungrounded, 1);
});

test("A prior with a builder and source but no giver is EXTRACTED (candidate), never revealed", () => {
  READ.set("derived-only.json", { schema: "RoleConfig@1", language: "eng", provenance: { builder: "build-role-config.mjs", source: "/train/en_ewt.conllu" } });
  const { ledger } = nomosFromPriors([prior("derived-only.json")], { read });
  const row = ledger.rows[0];
  assert.equal(row.standing, DECLARED_STANDING.CANDIDATE);
  assert.equal(row.giver, null);
  assert.match(row.basis, /nomination, not yet licensed/);
});

test("an injected reader is REQUIRED (the module never reads disk, never imports the reader)", () => {
  assert.throws(() => nomosFromPriors([prior("pos-ell.json")], { read: null }), /reader must be injected/);
});

test("the license wall, in nomos terms: a given row bound to its source licenses against that ground; a giver string with no binding is a reputation label; candidates license nothing", () => {
  const { ledger } = nomosFromPriors([prior("morph-cues-grc.json"), prior("pos-ell.json"), prior("derived-only.json")], { read });
  const charter = { sha256: "ac5576c048c57e01a5a6d2e1b9067fb80b4da65cf8b66913e9a273d8b83ba3b8" };
  const verdicts = Object.fromEntries(licenseNomos({ ledger }, charter).map((r) => [r.stem, r.license]));
  assert.equal(verdicts["morph-cues-grc.json"].licensed, true);
  assert.equal(verdicts["morph-cues-grc.json"].tier, "license");
  assert.equal(verdicts["pos-ell.json"].licensed, false);
  assert.equal(verdicts["pos-ell.json"].tier, "ungrounded");
  assert.equal(verdicts["derived-only.json"].licensed, false);
  assert.equal(verdicts["derived-only.json"].standing, "candidate");
});

test("helper reads: language and giver in every declared shape", () => {
  assert.equal(languageOf({ language: "eng" }), "eng");
  assert.equal(languageOf({ language: { iso: "grc" } }), "grc");
  assert.equal(giverOf({ provenance: { giver: "a ground" } }), "a ground");
  assert.equal(giverOf({ provenance: { giver: { value: "the PROIEL treebank" } } }), "the PROIEL treebank");
  assert.equal(giverOf({ provenance: {} }), null);
  assert.equal(standingOf({ provenance: { giver: "x" } }), DECLARED_STANDING.GIVEN);
  assert.equal(standingOf({ provenance: { builder: "b" } }), DECLARED_STANDING.CANDIDATE);
  assert.equal(standingOf({}), DECLARED_STANDING.UNGROUNDED);
});