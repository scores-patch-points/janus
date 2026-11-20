import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { attachmentEvidence, firingEvidence, effectEvidence, writeTokenizerEvidence, KINDS } from "./tokenizer-evidence.mjs"; import { openDoor } from "./pharos-door.mjs";
const row = (i, f, u, h, d) => [i, f, f, u, "_", "_", h, d, "_", "_"].join("\t");
const conllu = ["# text = Oscar's knot isn't tied.", row(1, "Oscar", "PROPN", 4, "nmod:poss"), row(2, "'s", "PART", 1, "case"), row(3, "knot", "NOUN", 6, "nsubj"), row(4, "is", "AUX", 6, "aux"), row(5, "n't", "PART", 6, "advmod"), row(6, "tied", "VERB", 0, "root"), row(7, ".", "PUNCT", 6, "punct"), ""].join("\n").replace("nmod:poss", "nmod:poss"), meta = { language: "eng", corpus: "T", sha256: "abc", licence: "x" };
// a tiny injected tokenizer: whitespace and a final period (the real one is khora's, handed in by the caller)
const tok = (s) => s.split(" ").flatMap((w) => (w.endsWith(".") ? [w.slice(0, -1), "."] : [w]));
test("attachment evidence is counts only: the forms the gold cut off an attached word, and how often the same suffix stayed inside a word", () => {
  const es = attachmentEvidence(conllu, meta), by = Object.fromEntries(es.map((e) => [e.body.form, e.body])); assert.equal(by["'s"].nSplit, 1); assert.equal(by["n't"].nSplit, 1); assert.equal(by["'s"].nGlued, 0);
  for (const e of es) { assert.equal(e.cell, "SEG·Pattern"); assert.equal(e.kind, "clitic-attachment"); assert.equal(e.body.corpus.sha256, "abc"); }
});
test("firing evidence: where a form WOULD cut and whether the gold has a boundary there; boundary counts with and without; the tokenizer is injected", () => {
  const es = firingEvidence({ conllu, tokenize: tok, forms: ["'s", "n't", "not"] }, meta), by = Object.fromEntries(es.map((e) => [e.body.form, e.body]));
  assert.equal(by["'s"].fired, 1); assert.equal(by["'s"].correct, 1); assert.equal(by["n't"].fired, 1); assert.equal(by["n't"].correct, 1); assert.equal(by["not"].fired, 1, "the unproven form WOULD cut knot"); assert.equal(by["not"].correct, 0, "and the gold has no boundary there: the falsifier sees the false cut"); for (const e of es) assert.equal(e.cell, "CON·Figure");
  assert.ok(es[0].body.boundaries.withAllForms.truePositive >= es[0].body.boundaries.base.truePositive); assert.throws(() => firingEvidence({ conllu, forms: ["'s"] }, meta), /injected/);
});
test("janus writes Structure only and NO verdict: no entry carries a rule, a standing, a status, kept, survived or refuted; every cell is Existence or Structure", () => {
  const es = [...attachmentEvidence(conllu, meta), ...firingEvidence({ conllu, tokenize: tok, forms: ["'s"] }, meta)]; assert.ok(es.length);
  for (const e of es) { assert.ok(["NUL", "SIG", "INS", "SEG", "CON", "SYN"].includes(e.cell.split("·")[0])); const txt = JSON.stringify(e.body); for (const w of ["kept", "survived", "refuted", "standing", "status", "verdict"]) assert.equal(txt.includes(`"${w}"`), false, `${w} in an evidence body`); }
  for (const c of Object.values(KINDS)) assert.ok(["SEG", "CON"].includes(c.split("·")[0]));
});
test("through the real door on a TEMP log: evidence is written and read back; a DEF rule written as janus is REFUSED by the writer audit; nothing is written to a file", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tokev-")), door = await openDoor({ log: "tokev-" + process.pid, dir }); if (!door.on) return t.skip(`door off: ${door.why}`);
  const r = writeTokenizerEvidence(door, attachmentEvidence(conllu, meta)); assert.ok(r.written > 0 && r.refused === 0, JSON.stringify(r)); const back = door.ask(["clitic-attachment"]); assert.equal(back.length, r.written);
  assert.equal(door.weave({ cell: "DEF·Pattern", kind: "tokenizer-rule", addr: "tokenizer-rule:x", body: { form: "'s" } }), null, "janus cannot write a DEF: a rule is Penelope's"); assert.equal(door.weave({ cell: "EVA·Pattern", kind: "rule-verdict", addr: "rule-verdict:x", body: {} }), null, "janus cannot write an EVA");
  assert.equal(writeTokenizerEvidence({ on: false, why: "off" }, attachmentEvidence(conllu, meta)).written, 0);
});

test("effect evidence: the observed downstream difference, the null's draws, how many reached it, and the seed; counts and numbers only, no verdict; a missing seed or null is refused", () => {
  const nulls = [-6, -5, -5.5, -4, 3, -7, -6.5, -5.2, -4.8, -5.9], e = effectEvidence({ form: "'s", sentences: 117, tokens: 1500, lasSplit: 81.4, lasGlued: 78.8, nulls, seed: 20261119, poss: { gold: 55, split: 49, glued: 1 }, wrong: { instances: 3, tokens: 40, delta: -4.5, examples: ["x"] } }, meta);
  assert.equal(e.cell, "CON·Figure"); assert.equal(e.kind, "clitic-effect"); assert.ok(Math.abs(e.body.effect - 2.6) < 1e-9); assert.equal(e.body.null.draws, 10); assert.equal(e.body.null.nullReaching, 1, "one draw (3) reaches the effect (2.6)"); assert.equal(e.body.null.seed, 20261119); assert.equal(e.body.null.min, -7); assert.equal(e.body.null.max, 3);
  const txt = JSON.stringify(e.body); for (const w of ["kept", "survived", "refuted", "standing", "status", "verdict"]) assert.equal(txt.includes(`"${w}"`), false, w);
  assert.ok(Math.abs(e.body.possessive.splitRate - 49 / 55) < 1e-9 && Math.abs(e.body.possessive.gluedRate - 1 / 55) < 1e-9, "the possessive recovery is its own number"); assert.ok(Math.abs(e.body.possessive.differencePoints - (100 * 48) / 55) < 1e-9);
  assert.equal(effectEvidence({ form: "'s", lasSplit: 1, lasGlued: 0, nulls: [1], seed: 1, bootstrap: { draws: 5, seed: 2, sd: 0.4, p025: 0.1, p975: 0.9 } }, meta).body.effectUncertainty.sd, 0.4);
  assert.throws(() => effectEvidence({ form: "'s", lasSplit: 1, lasGlued: 0, nulls: [], seed: 1 }, meta), /null draws/); assert.throws(() => effectEvidence({ form: "'s", lasSplit: 1, lasGlued: 0, nulls: [1] }, meta), /seed/);
  assert.equal(effectEvidence({ form: "'s", lasSplit: 1, lasGlued: 0, nulls: [1, 2], seed: 1 }, meta).addr, effectEvidence({ form: "'s", lasSplit: 1, lasGlued: 0, nulls: [1, 2], seed: 1 }, meta).addr, "content-derived address");
});
