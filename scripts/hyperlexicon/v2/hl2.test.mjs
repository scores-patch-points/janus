// hl2.test.mjs — the v2 door answers `names` as the givers write them, `context` from the names, counters and record, and a typed gap for
// what needs postings. A fixture directory in v2's file layout (a few rows), built here.
//   node --test scripts/hyperlexicon/v2/hl2.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { openHyperlexicon2, answer2 } from "./hl2.mjs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hl2-"));
for (const d of ["givers", "counters", "record"]) fs.mkdirSync(path.join(dir, d));
const gz = (f, rows) => fs.writeFileSync(path.join(dir, f), zlib.gzipSync(rows.map((r) => r.join("\t")).join("\n") + "\n"));
// folded, surface, lang, node, kind, of, pos, tags, giver (sorted by folded, then the row)
gz("givers/names.tsv.gz", [
  ["etc.", "etc.", "en", "n_etc", "lemma", "", "adv", "", "wiktionary-en"],
  ["messrs.", "Messrs.", "en", "n_mr", "form-of", "Mr.", "noun", "", "wiktionary-en"],
  ["polish", "Polish", "en", "n_Polish", "lemma", "", "adj", "", "wiktionary-en"],
  ["polish", "polish", "en", "n_polish", "lemma", "", "verb", "", "wiktionary-en"],
  ["polish", "polish", "es", "n_pulir", "form-of", "pulir", "verb", "", "wiktionary-es"],
]);
gz("givers/nodes.tsv.gz", [["n_Polish", "en", "Polish", "adj", "", "wiktionary-en"], ["n_polish", "en", "polish", "noun,verb", "", "wiktionary-en"]]);
gz("counters/types.tsv.gz", [["polish", "40", "12", "30", "1850", "1990"]]);
gz("record/record.tsv.gz", [["s", "polish|to make|end1", "d_a#10", "d_b#20", "2", "5", "1850", "1900"]]);
fs.writeFileSync(path.join(dir, "head.sha256"), "h2head  manifest.sha256\n");
const hl = openHyperlexicon2(dir);

test("names: a form is kept as the givers write it, case included", () => {
  const a = answer2(hl, { op: "names", surfaces: ["Messrs.", "Etc.", "etc."], lang: "en" });
  assert.equal(a.head, "h2head");
  assert.deepEqual(a.surfaces["Messrs."].written, [{ node: "n_mr", kind: "form-of", of: ["Mr."], pos: ["noun"] }]);
  assert.deepEqual(a.surfaces["Etc."].written, [], "the index folds case; as written, 'Etc.' is not 'etc.'");
  assert.equal(a.surfaces["etc."].written[0].node, "n_etc");
});

test("context: the givers' candidates in the caller's language, the counters, and the record's slots", () => {
  const c = answer2(hl, { op: "context", words: ["Polish", "qqq"], lang: "en" }).words;
  assert.equal(c.Polish.candidatesTotal, 2, "both casings fold to the type; each is a candidate with its own node");
  assert.deepEqual(c.Polish.candidates.map((x) => x.node).sort(), ["n_Polish", "n_polish"]);
  assert.deepEqual([c.Polish.uses, c.Polish.documents, c.Polish.dated], [40, 12, { uses: 30, earliest: 1850, latest: 1990 }]);
  assert.equal(c.Polish.recordTotal, 1);
  assert.equal(c.Polish.record[0].birth, "d_a#10");
  assert.equal(c.qqq.candidatesTotal, 0);
  assert.equal(c.qqq.gap, "not_counted");
  assert.equal(answer2(hl, { op: "context", words: ["polish"], lang: "es" }).words.polish.candidates[0].node, "n_pulir", "the caller's language, not the ground's");
});

test("what needs postings is a typed gap that names v1", () => {
  const g = answer2(hl, { op: "uses", word: "polish" });
  assert.equal(g.gap, "not_in_v2");
  assert.match(g.scope, /v1/);
  assert.equal(answer2(hl, { op: "nope" }).gap, "unknown_op");
});
