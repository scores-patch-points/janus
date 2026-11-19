import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { openDoor } from "./pharos-door.mjs";
// the real pointer's pins, rewritten with ABSOLUTE paths into a scratch pointer so each case can change only the cells entry
const real = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..", "pharos.json");
const have = fs.existsSync(real), base = have ? JSON.parse(fs.readFileSync(real, "utf8")) : null, at = (rel) => path.resolve(path.dirname(real), rel);
const withPointer = async (edit, f) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "janus-cells-")); const ptr = JSON.parse(JSON.stringify(base)); ptr.lib = at(base.lib); if (ptr.sig) ptr.sig.lib = at(base.sig.lib); if (ptr.cells) ptr.cells.lib = at(base.cells.lib); edit(ptr); const p = path.join(dir, "pharos.json"); fs.writeFileSync(p, JSON.stringify(ptr)); try { return await f(await openDoor({ pointer: p, log: "cellstest", dir })); } finally { fs.rmSync(dir, { recursive: true, force: true }); } };
const skip = have && base.cells ? false : "no pointer with a cells pin on this machine";

test("a pinned cells.mjs is loaded through the door: cellOf answers, and an unknown operator is a typed gap", { skip }, async () => {
  await withPointer(() => {}, (d) => { assert.equal(d.on, true); assert.equal(d.cellsWhy, null); assert.equal(d.cellOf("EVA", "Figure").terrain, "Lens"); assert.equal(d.cellOf("NOPE", "Figure").gap, "unknown_spec"); });
});
test("a cells pin whose bytes do not match leaves the door on but cellOf null, and says why", { skip }, async () => {
  await withPointer((p) => { p.cells.sha256 = "0".repeat(64); }, (d) => { assert.equal(d.on, true); assert.equal(d.cellOf, null); assert.match(d.cellsWhy, /not the pinned one/); });
});
test("no cells pin: the door is on, cellOf is null, and the pointer is not asked to guess one", { skip }, async () => {
  await withPointer((p) => { delete p.cells; }, (d) => { assert.equal(d.on, true); assert.equal(d.cellOf, null); assert.match(d.cellsWhy, /no cells pin/); });
});
test("a pin of the wrong lib bytes cannot turn the door's other pins off or on: pharos and sig stay as pinned", { skip }, async () => {
  await withPointer((p) => { p.cells.sha256 = "1".repeat(64); }, (d) => { assert.equal(d.sig, true); assert.equal(d.on, true); });
});
