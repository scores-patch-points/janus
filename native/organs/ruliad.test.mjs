import test from "node:test";
import assert from "node:assert/strict";
import { fieldFromWeft, giveRule, licenseRows, reopen } from "./ruliad.js";
import { licenseStanding } from "../../../khora/native/kernel/hyperlexicon.js";

const pass = (seq, address, cast, relations) => ({ schema: "WeftEntry@1", seq, address, category: "x", cast, relations });

test("the weft folds into candidate affordances: giver the weft, witnesses are addresses, keys are (left, right)", () => {
  const weft = [
    pass(0, "d1.txt", [{ ref: "ref:a", surface: "A", mentionsAt: [10, 90] }], [
      { relation: "wrote", scope: { byteOffset: 10 }, participants: [{ ref: "ref:a", surface: "A", standing: "referent" }, { ref: "ref:b", surface: "B", standing: "referent" }] },
    ]),
    pass(1, "d2.txt", [], [
      { relation: "wrote", scope: { byteOffset: 40 }, participants: [{ ref: "ref:a", surface: "A", standing: "referent" }, { ref: "ref:b", surface: "B", standing: "referent" }] },
    ]),
  ];
  const { hyperlexicon, stats } = fieldFromWeft(weft);
  const rows = Object.values(hyperlexicon.composition);
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.left, "A");
  assert.equal(row.right, "B");
  assert.equal(row.standing, "candidate");
  assert.equal(row.giver, "the weft");
  assert.deepEqual(row.witnesses, ["d1.txt#10", "d2.txt#40"]);
  assert.deepEqual(row.meta.labels, { wrote: 2 });
  assert.equal(row.provenance.giver, "the weft");
  assert.equal(stats.attestations, 2);
  assert.equal(stats.pairs, 1);
});

test("kindFor keys the field by the induced kind where given (the ruliad owns kinds; the weft stays kind-free)", () => {
  const weft = [pass(0, "d1.txt", [], [
    { relation: "wrote", scope: { byteOffset: 10 }, participants: [{ ref: "r1", surface: "A", standing: "referent" }, { ref: "r2", surface: "B", standing: "referent" }] },
  ])];
  const { hyperlexicon } = fieldFromWeft(weft, { kindFor: (s) => (s === "A" ? "kind:writer" : null) });
  const rows = Object.values(hyperlexicon.composition);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].left, "kind:writer");
  assert.equal(rows[0].right, "B");
});

test("GIVEN requires a named giver: giveRule throws without one (no revealed laws with no givers)", () => {
  assert.throws(() => giveRule(null, { left: "A", right: "C", giver: null }), /giver is required/);
  assert.throws(() => giveRule(null, { left: "A", right: "C" }), /giver is required/);
});

test("LICENSE WALL: a candidate row licences nothing; a charter-bound given row licences; a bare giver with no ground is refused", () => {
  const weft = [pass(0, "d1.txt", [], [
    { relation: "wrote", scope: { byteOffset: 10 }, participants: [{ ref: "a", surface: "A", standing: "referent" }, { ref: "b", surface: "B", standing: "referent" }] },
  ])];
  const { hyperlexicon } = fieldFromWeft(weft);
  const charter = { sha256: "a".repeat(32) };
  const licensed = giveRule(
    { hyperlexicon },
    { left: "A", right: "C", giver: "the constitution", binding: charter.sha256 },
  );
  const bare = giveRule(licensed, { left: "X", right: "Y", giver: "whoever" });

  const verdicts = Object.fromEntries(licenseRows(bare, charter).map((r) => [String(r.license.standing) + (r.left + r.right), r.license]));
  const cand = Object.values(hyperlexicon.composition)[0];
  assert.equal(licenseStanding(cand, charter).licensed, false);
  assert.match(licenseStanding(cand, charter).why, /not a given affordance/);
  assert.equal(verdicts["given" + "AC"].licensed, true);
  assert.equal(verdicts["given" + "AC"].tier, "license");
  assert.equal(verdicts["given" + "XY"].licensed, false);
  assert.equal(verdicts["given" + "XY"].tier, "ungrounded");
});

test("reopen re-expands a witness address into the source bytes (the holograph property: every part points at the whole)", () => {
  const src = "Once upon a time, Alice wrote a letter.";
  const at = src.indexOf("wrote");
  const out = reopen(`story.txt#${at}`, { read: (s) => (s === "story.txt" ? src : null), span: 40 });
  assert.equal(out.text, src.slice(at, at + 40));
  assert.equal(out.source, "story.txt");
  assert.equal(reopen("no-address", { read: () => null }).gap, "not_an_address");
  assert.equal(reopen("story.txt#0", {}).gap, "no_reader_injected");
});

test("asOf folds only the past: a later pass is not attested (the weft is always growing; the fold is at a cursor)", () => {
  const weft = [
    pass(0, "d1.txt", [], [{ relation: "wrote", scope: { byteOffset: 10 }, participants: [{ ref: "a", surface: "A", standing: "referent" }, { ref: "b", surface: "B", standing: "referent" }] }]),
    pass(1, "d2.txt", [], [{ relation: "wrote", scope: { byteOffset: 20 }, participants: [{ ref: "a", surface: "A", standing: "referent" }, { ref: "b", surface: "B", standing: "referent" }] }]),
  ];
  const { stats } = fieldFromWeft(weft, { asOf: 0 });
  assert.equal(stats.attestations, 1);
});