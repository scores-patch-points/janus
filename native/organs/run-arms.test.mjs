import test from "node:test";
import assert from "node:assert/strict";
import { unitKeyOf, runsOf, armsOf, groundSequences, readingShape, runArms } from "./run-arms.js";

const run = (id) => ({ kind: "reasoning-run", id, title: `/reason/${id}` });
const cl = (ground, ARG0, ARG1, extra = {}) => ({ kind: "reasoning-claim", ground, rel: "discover", roles: { ARG0, ARG1 }, polarity: "+", ...extra });

test("unitKeyOf matches khora's form: role order and null polarity never split a unit", () => {
  const a = { ground: "/p1", rel: "r", roles: { ARG1: "y", ARG0: "x" }, polarity: null };
  const b = { ground: "/p1", rel: "r", roles: { ARG0: "x", ARG1: "y" }, polarity: "+" };
  assert.equal(unitKeyOf(a), unitKeyOf(b));
  assert.equal(unitKeyOf(b), JSON.stringify(["/p1", "+", "r", [["ARG0", "x"], ["ARG1", "y"]]]));
});

test("runsOf: old lines join the run line before them; new lines join their own runId", () => {
  const rs = runsOf([run("r1"), cl("/p1", "b1", "b2"), run("r2"), cl("/p1", "b1", "b2", { runId: "r1" })]);
  assert.deepEqual(rs.map((r) => [r.runId, r.claims.length]), [["r1", 2], ["r2", 0]]);
});

test("armsOf: identical readings are one arm; shared grounds read alike are compatible, read differently conflict", () => {
  const recs = [
    run("r1"), cl("/p1", "b1", "b2"),
    run("r2"), cl("/p1", "b1", "b2"),
    run("r3"), cl("/p1", "b3", "b2"),
    run("r4"), cl("/p1", "b1", "b2"), cl("/p2", "b1", "b2"),
  ];
  const { arms, edges } = armsOf(runsOf(recs));
  assert.deepEqual(arms.map((a) => a.runs), [["r1", "r2"], ["r3"], ["r4"]]);
  const rel = Object.fromEntries(edges.map((e) => [`${e.a}-${e.b}`, e.relation]));
  assert.deepEqual(rel, { "A1-A2": "conflict", "A1-A3": "compatible", "A2-A3": "conflict" });
});

test("groundSequences: a flip back to an earlier reading is a return, not progress", () => {
  const recs = [run("r1"), cl("/p1", "b1", "b2"), run("r2"), cl("/p1", "b3", "b2"), run("r3"), cl("/p1", "b1", "b2"), run("r4"), cl("/p1", "b1", "b2")];
  const [g] = groundSequences(runsOf(recs));
  assert.deepEqual(g.sequence, ["R1", "R2", "R1", "R1"]);
  assert.equal(g.changes, 2);
  assert.equal(g.returns, 1);
  assert.equal(g.readings, 2);
});

test("readingShape: components over role values; sides apart when claim and source never share a node", () => {
  const apart = readingShape([cl("/p1", "b1", "b2", { ref: "c1.0" }), cl("/p1", "b3", "b4", { ref: "s1.0" })]);
  assert.equal(apart.components, 2);
  assert.deepEqual(apart.sides, { claim: 1, source: 1, touch: false });
  const meet = readingShape([cl("/p1", "b1", "b2", { ref: "c1.0" }), cl("/p1", "b3", "b2", { ref: "s1.0" })]);
  assert.equal(meet.components, 1);
  assert.equal(meet.sides.touch, true);
});

test("readingShape: no refs means sides are not recorded (null), never guessed", () => {
  assert.equal(readingShape([cl("/p1", "b1", "b2")]).sides, null);
  assert.equal(readingShape([cl("/p1", "b1", "b2", { ref: "c1.0" }), cl("/p1", "b1", "b2")]).sides, null);
});

test("runArms: the report is geometry only, no verdict fields", () => {
  const r = runArms([run("r1"), cl("/p1", "b1", "b2", { ref: "c1.0" }), cl("/p1", "b3", "b4", { ref: "s1.0" })]);
  assert.equal(r.schema, "RunArms@1");
  assert.equal(r.readings.sidesApart, 1);
  for (const k of ["ok", "verdict", "settled", "standing", "supported"]) assert.equal(k in r, false);
});
