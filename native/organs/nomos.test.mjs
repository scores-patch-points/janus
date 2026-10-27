import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nomosFromPriors, standingOf, licenseNomos, DECLARED_STANDING, languageOf, giverOf, NOMOS_SCHEMA, CONVENTIONS_SCHEMA, conventionStandingOf } from "./nomos.js";

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

// ── Conventions@1: one prior, several rules of different standing, each a row of its own ─────────────────────────────────────────────────
const PRIORS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "priors");
const priorFile = (name) => JSON.parse(fs.readFileSync(path.join(PRIORS, name), "utf8"));

test("the conventions prior folds into one row per convention, each with its OWN standing, giver and binding", () => {
  const conv = priorFile("conventions-eng.json"), pos = priorFile("pos-eng.json");
  assert.equal(conv.schema, CONVENTIONS_SCHEMA);
  const { ledger, stats } = nomosFromPriors([prior("conventions-eng.json")], { read: (a) => (a === "conventions-eng.json" ? conv : null) });
  assert.equal(ledger.rows.length, conv.conventions.length);
  assert.equal(stats.priors, 1, "one prior file folded");
  assert.equal(stats.rules, conv.conventions.length, "into one rule per convention");
  assert.deepEqual(stats.byStanding, { candidate: 3, given: 1 });
  for (const row of ledger.rows) {
    assert.equal(row.schema, "NomosRule@1");
    assert.equal(row.kind, "convention");
    assert.match(row.rule, /^Convention@1:eng:/);
    assert.equal(row.witnesses[0], "conventions-eng.json", "the witnesses start at the prior's own address");
    assert.ok(row.site && row.says && row.scope && row.departs.length, "where the reader stands on it, what it says, where it holds and departs");
  }
  const marks = ledger.rows.find((r) => r.stem === "capital-marks-a-name");
  assert.equal(marks.standing, DECLARED_STANDING.CANDIDATE);
  assert.equal(marks.giver, null);
  assert.equal(marks.binding, conv.provenance.source.split("sha256:")[1], "bound to the pinned ground it was measured on");
  assert.ok(marks.witnesses.some((w) => /nameIsCapitalMidSentence=0\.\d+ \(\d+ of \d+\)/.test(w)), "a measured figure, not a typed one");
  const use = ledger.rows.find((r) => r.stem === "treebank-attests-a-forms-use");
  assert.equal(use.standing, DECLARED_STANDING.GIVEN);
  assert.equal(use.giver, pos.provenance.giver, "the giver is read from pos-eng.json's provenance, not retyped");
});

test("a convention is given, extracted, or from no-where: the standing a prior writes about itself is not believed", () => {
  const p = { schema: CONVENTIONS_SCHEMA, language: "eng", provenance: {}, conventions: [
    { stem: "claims-given", standing: "given", says: "x", witnesses: ["w"] },
    { stem: "builder-no-ground", builder: "b.mjs", says: "x" },
    { stem: "no-builder", says: "x", witnesses: ["w"] },
    { stem: "has-giver", giver: "a received ground", says: "x" },
    { stem: "has-builder-and-ground", builder: "b.mjs", says: "x", witnesses: ["w"] },
  ] };
  const standing = Object.fromEntries(p.conventions.map((c) => [c.stem, conventionStandingOf(c, p)]));
  assert.deepEqual(standing, { "claims-given": "ungrounded", "builder-no-ground": "ungrounded", "no-builder": "ungrounded", "has-giver": "given", "has-builder-and-ground": "candidate" });
  const prior2 = { ...p, provenance: { builder: "b.mjs", source: "g.conllu sha256:" + "ab".repeat(32) } };
  assert.equal(conventionStandingOf({ stem: "x", says: "y" }, prior2), "candidate", "a convention inherits the prior's builder and source pin");
  const { ledger } = nomosFromPriors([prior("conv.json")], { read: () => p });
  const verdicts = Object.fromEntries(licenseNomos({ ledger }).map((r) => [r.stem, r.license]));
  assert.equal(verdicts["claims-given"].licensed, false, "a REVEALED convention is not licensed");
  assert.equal(verdicts["has-giver"].licensed, false, "a giver string with no binding is a reputation label");
  assert.equal(ledger.rows.find((r) => r.stem === "has-builder-and-ground").standing, DECLARED_STANDING.CANDIDATE);
});

test("the treebank convention is bound to the ground its giver counted: it licenses against that sha256, and nothing else does", () => {
  const conv = priorFile("conventions-eng.json");
  const witness = conv.conventions.find((c) => c.stem === "treebank-attests-a-forms-use").witnesses.find((w) => w?.sha256);
  assert.ok(witness, "the prior records the sha256 of the file pos-eng.json was counted from");
  assert.match(witness.reproduces, /recounted from .*, 0 differ, 0 missing/, "pinned only because it reproduces the prior's tag counts exactly");
  const { ledger } = nomosFromPriors([prior("conventions-eng.json")], { read: () => conv });
  const use = ledger.rows.find((r) => r.stem === "treebank-attests-a-forms-use");
  assert.equal(use.binding, witness.sha256);
  const verdicts = Object.fromEntries(licenseNomos({ ledger }, { sha256: witness.sha256 }).map((r) => [r.stem, r.license]));
  assert.equal(verdicts["treebank-attests-a-forms-use"].licensed, true, "a given row bound to its source licenses against that ground");
  for (const stem of ["capital-marks-a-name", "capital-opens-a-sentence", "sentence-end-is-marked"]) assert.equal(verdicts[stem].licensed, false, `${stem}: extracted, a nomination, not a licence`);
  assert.equal(licenseNomos({ ledger }, { sha256: "00".repeat(32) }).find((r) => r.stem === use.stem).license.licensed, false, "another ground licenses nothing");
});
