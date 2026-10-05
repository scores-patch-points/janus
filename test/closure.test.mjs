// closure.test.mjs — the moved closure still stands: every native module
// imports (every sibling crossing resolves), and the files that differ from
// khora's copy differ ONLY as JANUS-EXTRACTION.md's audit says. Asserts that
// imports resolve and that the diffs are the audited rewrites — never hashes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NATIVE = path.resolve(HERE, "..", "native");
const KHORA_NATIVE = path.resolve(HERE, "..", "..", "khora", "native");
const haveKhora = fs.existsSync(KHORA_NATIVE);

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.m?js$/.test(e.name) ? [path.join(d, e.name)] : []));
const files = walk(NATIVE).map((f) => path.relative(NATIVE, f)).sort();

test("the closure is the 29 audited files plus handlers.js", () => {
  const closure = files.filter((f) => f !== "handlers.js");
  assert.equal(closure.length, 29, closure.join(", "));
});

test("every native module imports (a failure is reported by name)", async () => {
  const failures = [];
  for (const f of files) {
    try { await import(pathToFileURL(path.join(NATIVE, f)).href); } catch (e) { failures.push(`${f}: ${String(e?.message ?? e).split("\n")[0]}`); }
  }
  assert.deepEqual(failures, [], failures.join("\n"));
});

// Rewrite a janus import specifier back to khora's own relative form: the
// audited crossing `../../../khora/native/X` is `<khora-dir-of-file>`-relative there.
function toKhoraLocal(text, rel) {
  const khoraFileDir = path.dirname(path.join(KHORA_NATIVE, rel));
  return text.replace(/(["'])((?:\.\.\/)+khora\/native\/[^"']+)\1/g, (m, q, spec) => {
    const target = path.resolve(path.dirname(path.join(NATIVE, rel)), spec);
    let r = path.relative(khoraFileDir, target).split(path.sep).join("/");
    if (!r.startsWith(".")) r = "./" + r;
    return q + r + q;
  });
}

// The audit's seven, and the one reason each differs.
const SIX_IMPORT_ONLY = [
  "organs/reasoning-lint.js", "organs/reasoning-record.js", "organs/regime.js",   // D3: gfp-claim / cube are siblings
  "the-fold/canon-ground.mjs",                                                    // D2: quotes.js stays in khora
  "kernel/terrain-activation.js",                                                 // activation / terrain-state stay in khora
  "kernel/task-log.js",                                                           // D3: cube is a sibling
];

for (const rel of SIX_IMPORT_ONLY) {
  test(`${rel} differs from khora's copy only in its sibling-crossing import specifier(s)`, { skip: !haveKhora && "khora checkout not found" }, () => {
    const mine = fs.readFileSync(path.join(NATIVE, rel), "utf8");
    const theirs = fs.readFileSync(path.join(KHORA_NATIVE, rel), "utf8");
    assert.notEqual(mine, theirs, "the audit says this file differs; if it no longer does, the audit is stale");
    assert.equal(toKhoraLocal(mine, rel), theirs);
  });
}

test("organs/corroboration.js differs only by D1: the witness read is injected (wireWitnessRead) instead of imported from notes.js, plus the grounding sibling import", { skip: !haveKhora && "khora checkout not found" }, () => {
  const rel = "organs/corroboration.js";
  const mine = toKhoraLocal(fs.readFileSync(path.join(NATIVE, rel), "utf8"), rel);
  const theirs = fs.readFileSync(path.join(KHORA_NATIVE, rel), "utf8");
  // undo D1 on the janus copy, then it must equal khora's text exactly
  const undone = mine
    .replace('import { numberSet } from "./grounding.js";', 'import { sourceOfWitness as kernelSourceOfWitness, recipeOfWitness } from "../kernel/notes.js";\nimport { numberSet } from "./grounding.js";')
    .replace(/export let sourceOfWitness = null;[\s\S]*?\nfunction witnessRecipe\(w\) \{[\s\S]*?\n\}\n/, "export const sourceOfWitness = kernelSourceOfWitness;\n")
    .replaceAll("witnessSource(", "sourceOfWitness(")
    .replaceAll("witnessRecipe(", "recipeOfWitness(");
  assert.equal(undone, theirs);
});

test("the seam control: no moved organ/kernel/interpretation file imports the reader or the ledger (notes.js, adapters/text, source.js, a surface)", () => {
  const offenders = [];
  for (const f of files.filter((f) => /^(kernel|organs|interpretation)\//.test(f))) {
    const text = fs.readFileSync(path.join(NATIVE, f), "utf8");
    for (const m of text.matchAll(/^\s*(?:import|export)\b[^;\n]*?from\s+["']([^"']+)["']/gm)) {
      if (/adapters\/text|(^|\/)source\.js$|the-fold\/(?!canon-ground)|kernel\/notes\.js/.test(m[1])) offenders.push(`${f} -> ${m[1]}`);
    }
  }
  assert.deepEqual(offenders, []);
});
