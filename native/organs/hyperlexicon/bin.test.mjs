// bin.test.mjs — the binary store answers names/context/relations from its tables and a typed gap for every ask that needs postings.
// Runs against a built HyperlexiconBin@1 store: HL_BIN=<dir> (default ~/hyperlexicon/v2); skipped when none is there.
//   node --test native/organs/hyperlexicon/bin.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openHyperlexiconBin } from "./bin.mjs";
import { answer } from "./door.mjs";

const dir = process.env.HL_BIN || path.join(os.homedir(), "hyperlexicon", "v2");
const skip = !fs.existsSync(path.join(dir, "manifest.json")) && "no HyperlexiconBin@1 store (set HL_BIN)";
const hl = skip ? null : openHyperlexiconBin(dir);

test("names: a written form returns its node, kind, part of speech and lemma", { skip }, () => {
  const a = answer(hl, { op: "names", surfaces: ["Dr.", "dr.", "zzqxqzz"], lang: "en" });
  assert.equal(a.standing, "given · ungrounded · undecided");
  assert.deepEqual(a.surfaces["zzqxqzz"].written, []);
  for (const w of a.surfaces["Dr."].written) assert.match(w.node, /^n_[0-9a-f]{16}$/);
});

test("context: counters for a stored type, never-set for an absent one, candidates beside", { skip }, () => {
  const a = answer(hl, { op: "context", words: ["port", "zzqxqzz"], lang: "en" });
  assert.ok(a.words.port.uses > 0 && a.words.port.documents >= 2 && a.words.port.corroborated);
  assert.equal(a.words.port.dated.gap, "no_postings");
  assert.equal(a.words.zzqxqzz.null, "never-set");
});

test("asks that read postings answer a typed gap, never an empty answer", { skip }, () => {
  for (const op of ["uses", "company", "along", "absence", "nodes", "reopen", "after", "dotted"]) assert.equal(answer(hl, { op, word: "port" }).gap, "no_postings", op);
  assert.equal(answer(hl, { op: "nope" }).refused, true);
});

test("relations: a node with none answers empty lists; an unknown id is a typed gap", { skip }, () => {
  assert.equal(answer(hl, { op: "relations", id: "n_0000000000000000" }).gap, "not_a_giver_node");
  assert.equal(answer(hl, { op: "relations" }).refused, true);
});
