// janus-rules.test.mjs: the rules of REFERENT-FIRST.md that can be checked mechanically, so they stay true. Janus is the researcher: it structures, and never convicts.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path";
import { EOT_CELL, EOT_GAP_CELL } from "./eot-weave.mjs"; import { KINDS as EVIDENCE_KINDS } from "./gate-evidence.mjs"; import { CELL as BINDING_CELL } from "./binding-evidence.mjs";
const HERE = path.dirname(new URL(import.meta.url).pathname), ROOT = path.join(HERE, "..", ".."), read = (f) => fs.readFileSync(path.join(HERE, f), "utf8");
const OWNED = ["tokenizer-evidence.mjs", "rule-entries.mjs", "clitic-split.mjs", "codec-for.mjs", "gate-evidence.mjs", "binding-evidence.mjs", "merge-gate.mjs", "claim-assertions.mjs", "constraints.js", "pharos-door.mjs", "eot-weave.mjs"];   // the files this session owns; the 44 older khora re-export shims are known and untouched
const EXISTENCE_AND_STRUCTURE = ["NUL", "SIG", "INS", "SEG", "CON", "SYN"];

test("rule 7: janus's own code imports no other repo (a relative path out of native/, or a sibling checkout); the cube and the organs arrive by door and by injection", () => {
  for (const f of OWNED) for (const line of read(f).split("\n")) {
    if (!line.startsWith("import")) continue;
    assert.equal(line.includes("../../../"), false, `${f}: a cross-repo import: ${line.slice(0, 90)}`); assert.equal(line.includes("khora-cast"), false, `${f}: ${line.slice(0, 90)}`);
  }
});

test("rule 6: every cell janus writes is Existence or Structure: never a DEF, an EVA or a REC (observing is not defining)", () => {
  const cells = [...Object.values(EVIDENCE_KINDS), BINDING_CELL, EOT_CELL, EOT_GAP_CELL];
  assert.ok(cells.length >= 6); for (const c of cells) assert.ok(EXISTENCE_AND_STRUCTURE.includes(c.split("·")[0]), `janus writes ${c}`);
  assert.equal(cells.includes("SYN·Ground"), false, "SYN at Ground is the empty desert cell");
});

test("rule 6: the sources of janus's evidence say they never convict, and carry no verdict-writing API", () => {
  for (const f of ["gate-evidence.mjs", "binding-evidence.mjs"]) { const s = read(f); assert.equal(/export (async )?function (judge|convict|verdict)/.test(s), false, `${f} exports a judging function`); }
  const mg = read("merge-gate.mjs"), final = mg.slice(mg.lastIndexOf("return Object.freeze({"));   // the LAST return is the gate's public surface (inducePrecedes has its own returns)
  assert.ok(final.includes("evidence") && final.includes("world"), "the gate surface is evidence() and world()"); assert.equal(final.includes("judge"), false, "merge-gate exposes judge() again");
});

test("REFERENT-FIRST.md names its guards, and every guard it names exists", () => {
  const doc = fs.readFileSync(path.join(ROOT, "REFERENT-FIRST.md"), "utf8");
  for (const g of ["native/organs/janus-rules.test.mjs", "experiments/context-nomination/ctxnom.py", "native/organs/gate-evidence.mjs"]) { assert.ok(doc.includes(g), `the doc does not name ${g}`); assert.ok(fs.existsSync(path.join(ROOT, g)), `${g} does not exist`); }
  for (const rule of ["The unit is the being", "stopping rule, not a constant", "strings-only twin", "Observing is not defining", "Stamp before scoring"]) assert.ok(doc.includes(rule), `rule missing: ${rule}`);
});

// rule 11 (the owner, 2026-11-20): all language passes through its codec to EOT; matching and reasoning happen in EOT, never on the surface. nl-eot.mjs is the codec door.
const RAW_READERS = ["ud-parser", "ud-tokenizer", "pharos-reading", "readingRows", "grammarFor"];
const walk = (dir, out = []) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { if (e.name === "node_modules" || e.name === ".git") continue; const f = path.join(dir, e.name); if (e.isDirectory()) walk(f, out); else if (/\.(mjs|js|py)$/.test(e.name)) out.push(f); } return out; };
test("rule 11: no organ of janus reads raw text except through nl-eot.mjs (the codec door); the older khora re-exports are named, not extended", () => {
  const ALLOWED = ["nl-eot.mjs", "nl-eot.test.mjs", "eot-read.mjs", "eot-read.test.mjs"];   // eot-read.mjs is the layered codec reader beside nl-eot.mjs: it applies rules READ FROM THE LOG   // add a file here ONLY with the owner's word; a new raw text reader in native/organs is a regression
  const found = walk(path.join(ROOT, "native", "organs")).filter((f) => !ALLOWED.includes(path.basename(f))).filter((f) => { const src = fs.readFileSync(f, "utf8"); return src.split("\n").some((l) => l.startsWith("import") && RAW_READERS.some((r) => l.includes(r))) || /await import\([^)]*(ud-parser|ud-tokenizer|pharos-reading)/.test(src); });
  assert.deepEqual(found.map((f) => path.relative(ROOT, f)), [], "an organ imports a raw text reader: route it through nl-eot.mjs (rule 11)");
});
test("rule 11: every experiment script that reads raw text is declared in eot_law.py (its level), and the EOT extractor goes through nl-eot.mjs and fails on a language with no codec", () => {
  const law = fs.readFileSync(path.join(ROOT, "experiments", "context-nomination", "eot_law.py"), "utf8");
  const readers = walk(path.join(ROOT, "experiments")).filter((f) => !f.endsWith("eot_law.py") && !f.endsWith("test_guard_alias.py")).filter((f) => RAW_READERS.some((r) => fs.readFileSync(f, "utf8").includes(r)));
  for (const f of readers) { const b = path.basename(f), src = fs.readFileSync(f, "utf8"); assert.ok(law.includes(b) || src.includes("nl-eot"), `${b} reads raw text and is not declared in eot_law.py (a new reader is a regression of rule 11)`); }
  const eg = fs.readFileSync(path.join(ROOT, "experiments", "context-nomination", "eotgraph.mjs"), "utf8");
  assert.ok(eg.includes("nl-eot.mjs") && eg.includes("loadGrammar") && eg.includes("if (G.gap) throw"), "eotgraph.mjs must go through the codec door and refuse a language with no codec");
});
test("rule 11 is named in REFERENT-FIRST.md with its guards, and the project's CLAUDE.md carries the law", () => {
  const doc = fs.readFileSync(path.join(ROOT, "REFERENT-FIRST.md"), "utf8"); assert.ok(doc.includes("codec to EOT") && doc.includes("eot_law.py") && doc.includes("test_guard_alias.py"));
  const cl = fs.readFileSync(path.join(ROOT, "CLAUDE.md"), "utf8"); assert.ok(cl.includes("codec to EOT"), "CLAUDE.md must carry rule 11 so every session starts with it");
});

test("rule 12: codec-for.mjs imports only the codec door and node builtins, never falls back to another language, and the rule names its guards", () => {
  const src = read("codec-for.mjs"); for (const line of src.split("\n")) if (line.startsWith("import")) assert.ok(line.includes("node:") || line.includes("./nl-eot.mjs") || line.includes("../../scripts/vendor-ud-codec.mjs"), `codec-for imports something else: ${line.slice(0, 80)}`);
  assert.equal(/'eng'|"eng"/.test(src), false, "codec-for.mjs must not hard-code English: no hub, no default language");
  const doc = fs.readFileSync(path.join(ROOT, "REFERENT-FIRST.md"), "utf8"); assert.ok(doc.includes("codec is computed") && doc.includes("codec-for.test.mjs") && doc.includes("no_codec_source"));
  const t = fs.readFileSync(path.join(HERE, "codec-for.test.mjs"), "utf8"); assert.ok(t.includes("never English") && t.includes("requireDerivation"));
});

// rule 14 (the owner, 2026-11-20): all work is done on the pharos; no system writes to itself or to another repo. Janus's tokenizer and codec organs and their script write NO FILE, and write to the log only Structure counts; the rules they apply are read from the log.
test("rule 14: the tokenizer and codec organs write no file; evidence goes through the door as Structure; rules are read from entries, never from a prior a system wrote for itself", () => {
  const files = ["tokenizer-evidence.mjs", "rule-entries.mjs", "clitic-split.mjs", "eot-read.mjs", "codec-for.mjs"].map((f) => [f, read(f)]); files.push(["scripts/tokenizer-evidence.mjs", fs.readFileSync(path.join(ROOT, "scripts", "tokenizer-evidence.mjs"), "utf8")]);
  for (const [f, src] of files) for (const w of ["writeFileSync", "appendFileSync", "mkdirSync", "createWriteStream", "renameSync"]) assert.equal(src.includes(w), false, `${f} writes a file (${w})`);
  const ev = read("tokenizer-evidence.mjs"); for (const w of ["DEF·", "EVA·", "REC·"]) assert.equal(ev.includes(w), false, `tokenizer-evidence.mjs names an Interpretation cell (${w})`);
  assert.equal(fs.existsSync(path.join(ROOT, "priors", "tokenizer-clitics-eng.json")), false, "a self-written tokenizer prior must not exist: rules are log entries"); assert.equal(fs.existsSync(path.join(ROOT, "priors", "eot-derivations.json")), false);
  const doc = fs.readFileSync(path.join(ROOT, "REFERENT-FIRST.md"), "utf8"); assert.ok(doc.toLowerCase().includes("all work is done on the pharos") && doc.includes("rule-entries.test.mjs") && doc.includes("tokenizer-evidence.test.mjs"));
});
