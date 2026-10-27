// bin.test.mjs — the binary store answers names/context/relations from its tables and a typed gap for every ask that needs postings,
// and holds for non-English lexicons: Unicode normalization, Turkish and German folding, right-to-left and no-space scripts,
// counters keyed by document language, and a giver on every row.
// Runs against a built HyperlexiconBin@2 store: HL_BIN=<dir> (default ~/hyperlexicon/v2); skipped when none is there.
//   node --test native/organs/hyperlexicon/bin.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openHyperlexiconBin, skeleton, foldFor } from "./bin.mjs";
import { answer } from "./door.mjs";

const dir = process.env.HL_BIN || path.join(os.homedir(), "hyperlexicon", "v2");
const skip = !fs.existsSync(path.join(dir, "manifest.json")) && "no HyperlexiconBin@2 store (set HL_BIN)";
const hl = skip ? null : openHyperlexiconBin(dir);
const names = (surfaces, lang) => answer(hl, { op: "names", surfaces, lang }).surfaces;

test("names: a written form returns its node, kind, part of speech, lemma and giver", { skip }, () => {
  const a = answer(hl, { op: "names", surfaces: ["Dr.", "zzqxqzz"], lang: "en" });
  assert.equal(a.standing, "given · ungrounded · undecided");
  assert.deepEqual(a.surfaces["zzqxqzz"].written, []);
  for (const w of a.surfaces["Dr."].written) { assert.match(w.node, /^n_[0-9a-f]{16}$/); assert.ok(w.giver.length >= 1); }
});

test("context: counters for a stored type, unknown (not never-set) for a word the store does not hold, candidates beside", { skip }, () => {
  const a = answer(hl, { op: "context", words: ["port", "zzqxqzz"], lang: "en" });
  assert.ok(a.words.port.uses > 0 && a.words.port.documents >= 2 && a.words.port.corroborated);
  assert.equal(a.words.port.dated.gap, "no_postings");
  assert.equal(a.words.zzqxqzz.null, "unknown");           // heard at most once is unknown, never "never-set"
  assert.equal(a.words.zzqxqzz.gap, "unseen_or_single_sighting");
});

test("counters are keyed by document language: 'die' in German documents is not 'die' in English documents", { skip }, () => {
  const de = answer(hl, { op: "context", words: ["die"], ground: { language: "de" } }).words.die;
  const en = answer(hl, { op: "context", words: ["die"], ground: { language: "en" } }).words.die;
  const all = answer(hl, { op: "context", words: ["die"] }).words.die;
  assert.ok(de.uses > en.uses, "German documents use the article far more");
  assert.ok(all.uses >= de.uses + en.uses);
  assert.equal(answer(hl, { op: "context", words: ["die"], ground: { language: "xx-none" } }).words.die.null, "never-set");   // a kept type, no document in that language
});

test("asks that read postings answer a typed gap, never an empty answer", { skip }, () => {
  for (const op of ["uses", "company", "along", "absence", "nodes", "reopen", "after", "dotted"]) assert.equal(answer(hl, { op, word: "port" }).gap, "no_postings", op);
  assert.equal(answer(hl, { op: "nope" }).refused, true);
});

test("relations: an unknown id is a typed gap; a missing id is refused", { skip }, () => {
  assert.equal(answer(hl, { op: "relations", id: "n_0000000000000000" }).gap, "not_a_giver_node");
  assert.equal(answer(hl, { op: "relations" }).refused, true);
});

test("Unicode normalization: a decomposed (NFD) query finds what the composed (NFC) one does", { skip }, () => {
  for (const [s, lang] of [["ёлка", "ru"], ["café", "fr"]]) {
    const nfc = names([s.normalize("NFC")], lang)[s.normalize("NFC")], nfd = names([s.normalize("NFD")], lang)[s.normalize("NFD")];
    assert.ok(nfc.written.length > 0, `${s} is in the store`);
    assert.deepEqual(nfd.written, nfc.written, `${s} NFD = NFC`);
    assert.equal(nfd.here.length, nfc.here.length);
  }
});

test("Turkish folds İ->i and I->ı: IŞIK finds ışık, ISIK does not, KİTAP finds kitap, KITAP does not", { skip }, () => {
  assert.ok(names(["IŞIK"], "tr")["IŞIK"].here.length > 0);
  assert.equal(names(["ISIK"], "tr")["ISIK"].here.length, 0);
  assert.ok(names(["KİTAP"], "tr")["KİTAP"].here.length > 0);
  assert.equal(names(["KITAP"], "tr")["KITAP"].here.length, 0);
  assert.equal(foldFor("tr")("I"), "ı"); assert.equal(foldFor("tr")("İ"), "i"); assert.equal(foldFor("en")("I"), "i");
});

test("German folds sharp s: STRASSE finds Straße; the default fold does not conflate them", { skip }, () => {
  assert.ok(names(["STRASSE"], "de")["STRASSE"].here.length > 0);
  assert.equal(foldFor("de")("Straße"), foldFor("de")("STRASSE"));
  assert.notEqual(foldFor("en")("Straße"), foldFor("en")("STRASSE"));
  assert.equal(skeleton("Straße"), skeleton("STRASSE"));
});

test("right-to-left and no-space scripts are looked up as plain strings: Arabic, Hebrew, Japanese, Chinese, Korean", { skip }, () => {
  for (const [s, lang] of [["كتاب", "ar"], ["ספר", "he"], ["日本語", "ja"], ["中文", "zh"], ["한국어", "ko"]]) assert.ok(names([s], lang)[s].written.length > 0, `${lang} ${s}`);
});

test("every name, relation and link row names its giver", { skip }, () => {
  const w = names(["port"], "en")["port"].written;
  assert.ok(w.length > 0 && w.every((x) => Array.isArray(x.giver) && x.giver.every((g) => /^wiktionary-/.test(g))));
  assert.ok(hl.manifest.givers.length >= 2);
});
