// janus-rules.test.mjs: the rules of REFERENT-FIRST.md that can be checked mechanically, so they stay true. Janus is the researcher: it structures, and never convicts.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path";
import { KINDS as EVIDENCE_KINDS } from "./gate-evidence.mjs"; import { CELL as BINDING_CELL } from "./binding-evidence.mjs";
const HERE = path.dirname(new URL(import.meta.url).pathname), ROOT = path.join(HERE, "..", ".."), read = (f) => fs.readFileSync(path.join(HERE, f), "utf8");
const OWNED = ["gate-evidence.mjs", "binding-evidence.mjs", "merge-gate.mjs", "claim-assertions.mjs", "constraints.js", "pharos-door.mjs"];   // the files this session owns; the 44 older khora re-export shims are known and untouched
const EXISTENCE_AND_STRUCTURE = ["NUL", "SIG", "INS", "SEG", "CON", "SYN"];

test("rule 7: janus's own code imports no other repo (a relative path out of native/, or a sibling checkout); the cube and the organs arrive by door and by injection", () => {
  for (const f of OWNED) for (const line of read(f).split("\n")) {
    if (!line.startsWith("import")) continue;
    assert.equal(line.includes("../../../"), false, `${f}: a cross-repo import: ${line.slice(0, 90)}`); assert.equal(line.includes("khora-cast"), false, `${f}: ${line.slice(0, 90)}`);
  }
});

test("rule 6: every cell janus writes is Existence or Structure: never a DEF, an EVA or a REC (observing is not defining)", () => {
  const cells = [...Object.values(EVIDENCE_KINDS), BINDING_CELL];
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
