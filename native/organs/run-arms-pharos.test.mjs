// Janus reads runs from the shared log and weaves its arms back (2026-11-14).
// Needs the pharos library at $PHAROS_LIB. The "other writer" below is this
// repo's own door opened under another writer name: no other repo is imported.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { openDoor } from "./pharos-door.mjs";
import { recordsFromEntries, weaveArms, ARM_KIND, ARMS_KIND } from "./run-arms-pharos.mjs";

const LIB = process.env.PHAROS_LIB ?? "";
const skip = LIB && fs.existsSync(LIB) ? false : "pharos library not found (set PHAROS_LIB to pharos/lib/pharos.mjs)";
const setup = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "ja-"));
  const pointer = path.join(d, "pharos.json");
  fs.writeFileSync(pointer, JSON.stringify({ lib: LIB, sha256: crypto.createHash("sha256").update(fs.readFileSync(LIB)).digest("hex") }));
  return { pointer, dir: path.join(d, "log") };
};
const unit = (g, a, b) => JSON.stringify([g, "+", "discover", [["ARG0", a], ["ARG1", b]]]);
// one run with its claims, as another writer would have woven it
function otherRun(w, at, claims) {
  w.declare("reasoning-run", "INS·Figure", "t"); w.declare("reasoning-claim", "INS·Figure", "t");
  const run = w.weave({ cell: "INS·Figure", kind: "reasoning-run", addr: `run:${at}`, body: { at } });
  claims.forEach(([g, a, b, ref], i) => w.weave({ cell: "INS·Figure", kind: "reasoning-claim", addr: `unit:${at}-${i}`, of: [run.id], body: { unit: unit(g, a, b), run: run.id, ground: g, rel: "discover", roles: { ARG0: a, ARG1: b }, polarity: "+", ref: ref ?? null } }));
  return run;
}

test("recordsFromEntries: a claim keeps its run, its unit and its ref", () => {
  const rs = recordsFromEntries([{ kind: "reasoning-run", id: "R", addr: "run:x" }, { kind: "reasoning-claim", id: "C", body: { run: "R", unit: "U", ground: "/p1", rel: "r", roles: { ARG0: "a" }, ref: "c1.0" } }, { kind: "kind", id: "K" }]);
  assert.deepEqual(rs.map((r) => r.kind), ["reasoning-run", "reasoning-claim"]);
  assert.deepEqual([rs[1].runId, rs[1].unit, rs[1].ref], ["R", "U", "c1.0"]);
});

test("a door that is off weaves nothing and says why", () => {
  const w = weaveArms({ on: false, why: "no pharos pointer" });
  assert.deepEqual([w.on, w.woven, w.why], [false, 0, "no pharos pointer"]);
});

test("janus reads another writer's runs from the log and weaves its arms, by writer janus", { skip }, async () => {
  const s = setup();
  const other = await openDoor({ ...s, writer: "other" });
  const r1 = otherRun(other, "t1", [["/p1", "b1", "b2", "c1.0"], ["/p1", "b3", "b4", "s1.0"]]);
  const r2 = otherRun(other, "t2", [["/p1", "b1", "b2", "c1.0"], ["/p1", "b3", "b4", "s1.0"]]);
  const r3 = otherRun(other, "t3", [["/p1", "b9", "b2", "c1.0"]]);
  const door = await openDoor(s);
  const w = weaveArms(door);
  assert.equal(w.refused, 0);
  assert.equal(w.report.runs, 3);
  const arms = door.fold({ kind: ARM_KIND }), cut = door.fold({ kind: ARMS_KIND });
  assert.equal(arms.length, 2);
  assert.ok([...arms, ...cut].every((e) => e.by === "janus"));
  assert.deepEqual(arms.map((a) => [...a.of].sort()), [[r1.id, r2.id].sort(), [r3.id]]);
  assert.deepEqual(cut[0].body.edges, { compatible: 0, conflict: 1 });
  assert.deepEqual(cut[0].body.totals, { changes: 1, returns: 0 });
  assert.equal(cut[0].body.readings.sidesApart, 2);
  assert.deepEqual([...cut[0].of].sort(), arms.map((a) => a.id).sort());
  for (const k of ["ok", "verdict", "settled", "standing"]) assert.equal(k in cut[0].body, false);
});

test("weaving twice over an unchanged log adds nothing", { skip }, async () => {
  const s = setup();
  otherRun(await openDoor({ ...s, writer: "other" }), "t1", [["/p1", "b1", "b2"]]);
  const door = await openDoor(s);
  weaveArms(door);
  const n = door.fold({}).length;
  weaveArms(door);
  assert.equal(door.fold({}).length, n);
});
