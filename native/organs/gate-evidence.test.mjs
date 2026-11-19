import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { evidenceOf, synthesisOf, entriesOf, writeEvidence, KINDS } from "./gate-evidence.mjs";
import { makeMergeGate } from "./merge-gate.mjs";
import { assertionsFromClaims } from "./claim-assertions.mjs";
import { openDoor } from "./pharos-door.mjs";
// the two khora organs are the test harness's injection (a sibling checkout), the one place a test reaches khora
import { induceKindsAndFunctions } from "../../../khora/native/kernel/kind-functional-induction.js"; import { makeIdentityExclusion } from "../../../khora/native/kernel/identity-exclusion.js";
const organs = { induceKindsAndFunctions, makeIdentityExclusion };
const diff = (u, v) => (typeof u === "number" && typeof v === "number" ? u - v : null);
const C = (rel, a, b, extra = {}) => ({ rel, a, b, polarity: "+", ...extra });
const world = (claims, o = {}) => { const A = assertionsFromClaims(claims, { difference: diff, ...o.adapter }); const g = makeMergeGate({ organs, referents: A.referents, declaredKinds: [{ kindKey: "k", memberRefs: A.referents }], assertionsOf: A.assertionsOf, sameValue: A.sameValue, difference: A.difference, witnessed: (a) => a.ref === true, exposureFloor: 3, ...o.gate }); return { A, g }; };
const GIVEN = { given: { ranges: [{ kind: "k", rel: "died", base: "born", min: 0, max: 150, giver: "asker" }] } };
const ann = [C("born", "x", 1850), C("died", "y", 1820)];
// no verdict anywhere in what janus leaves: no key and no string value that is a conclusion
const CONCLUSIONS = new Set(["same", "different", "contradicted", "unbound", "beyond-reach", "bound", "other", "hold", "equivalent"]);
const concluded = (v) => { if (typeof v === "string") return CONCLUSIONS.has(v.toLowerCase()); if (Array.isArray(v)) return v.some(concluded); if (v && typeof v === "object") return Object.entries(v).some(([k, x]) => k === "verdict" || concluded(x)); return false; };

test("a conflict on a GIVEN rule is left as a difference with its standing and its two witnesses, and no verdict", () => {
  const { g } = world(ann, { gate: GIVEN }), e = g.evidence("x", "y");
  assert.equal(e.counts.differences, 1); assert.equal(e.counts.givenRule, 1); const d = e.findings.find((f) => f.type === "difference");
  assert.deepEqual([d.rel, d.base, d.via, d.rule.kind, d.rule.standing, d.rule.giver], ["died", "born", "witnessed", "range", "given", "asker"]);
  assert.deepEqual([d.witness.a.value, d.witness.b.value], [1820, 1850], "the died value and the born value that cannot both stand: died is the rel side"); assert.ok(d.witness.a.id && d.witness.b.id);
  assert.equal(concluded(e), false, "nothing in the evidence is a conclusion"); assert.ok(!("verdict" in e) && !("reason" in e));
});

test("the same conflict on a LEARNED rule keeps its standing as a candidate: janus does not decide whether it counts", () => {
  const people = Object.fromEntries(["m1", "m2", "m3", "m4"].flatMap((m, i) => [[m, [C("born", m, 1800 + i), C("died", m, 1850 + i)]]]));
  const claims = [...Object.values(people).flat(), ...ann], { g } = world(claims, { gate: { order: [{ rel: "died", base: "born", kind: "k" }] } }), e = g.evidence("x", "y");
  assert.equal(e.counts.candidateRule, 1); assert.equal(e.counts.givenRule, 0); const d = e.findings.find((f) => f.type === "difference"); assert.equal(d.rule.standing, "candidate"); assert.equal(d.rule.evidence.exposed, 4);
});

test("an unwitnessed side makes the difference unwitnessed; agreement, incomparable, unasserted and change are findings of their own kind", () => {
  const un = world([C("born", "x", 1850, { ref: false }), C("died", "y", 1820)], { gate: GIVEN }), e1 = un.g.evidence("x", "y");
  assert.equal(e1.findings.find((f) => f.type === "difference").via, "unwitnessed"); assert.equal(e1.counts.unwitnessed, 1);
  const ag = world([C("born", "x", 1850), C("born", "y", 1850)], { gate: { given: { functional: [{ kind: "k", rel: "born", giver: "asker" }] } } }), e2 = ag.g.evidence("x", "y");
  assert.equal(e2.counts.agreements, 1); assert.equal(e2.counts.differences, 0);
  const inc = world([C("born", "x", "long ago"), C("died", "y", 1820)], { gate: GIVEN }), e3 = inc.g.evidence("x", "y"); assert.equal(e3.findings.some((f) => f.type === "hole" && f.why === "incomparable"), true);
  const un2 = world([C("born", "x", 1850), C("shoe", "y", 9)], { gate: { given: { functional: [{ kind: "k", rel: "born", giver: "asker" }] } } }), e4 = un2.g.evidence("x", "y"); assert.equal(e4.findings.some((f) => f.type === "hole" && f.why === "unasserted" && f.rel === "born"), true);
  const noRule = world([C("born", "x", 1850), C("born", "y", 1860)]), e5 = noRule.g.evidence("x", "y"); assert.equal(e5.findings.some((f) => f.type === "hole" && f.why === "no_functional_relation_declared"), true, "a frame that cannot ask is a hole, said as one");
  for (const e of [e1, e2, e3, e4, e5]) assert.equal(concluded(e), false);
});

test("the synthesis is the merged world: both sides' assertions, each labelled by side, none re-id'd, independent of the order asked", () => {
  const { A } = world([C("born", "x", 1850), C("born", "y", 1860), C("died", "y", 1900)]), w = synthesisOf({ a: "x", b: "y" }, A.assertionsOf), w2 = synthesisOf({ a: "x", b: "y" }, (r) => [...A.assertionsOf(r)].reverse());
  assert.deepEqual([w.counts.a, w.counts.b, w.counts.relations, w.counts.sharedRelations], [1, 2, 2, 1]); assert.deepEqual(w.assertions.map((x) => x.id).sort(), ["c0", "c1", "c2"]); assert.equal(JSON.stringify(w), JSON.stringify(w2)); assert.equal(concluded(w), false);
  assert.throws(() => synthesisOf({ a: "x" }, () => []), /two referents/); assert.throws(() => synthesisOf({ a: "x", b: "y" }), /assertionsOf/);
});

test("entries: a Structure cell per finding (a bond is CON, a hole or change is SEG), no verdict, an address derived from the finding, so the same finding is one address", () => {
  const { g } = world(ann, { gate: GIVEN }), e = g.evidence("x", "y"), a1 = entriesOf(e);
  assert.ok(a1.length >= 1 && a1.every((x) => x.cell === ({ difference: "CON·Figure", agreement: "CON·Figure", hole: "SEG·Figure", change: "SEG·Figure" })[x.kind] && x.addr.startsWith(`${x.kind}:`)) && !a1.some(concluded)); assert.equal(a1[0].addr, entriesOf(e)[0].addr);
  assert.equal(KINDS["merged-world"], "SYN·Pattern", "the world is SYN at Pattern, never the empty SYN at Ground");
});

// ---- the log: a real pharos log through janus's own door, never a mock
const real = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..", "pharos.json"), have = fs.existsSync(real), skip = have ? false : "no pharos pointer on this machine";
const withDoor = async (f) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "janus-ev-")), base = JSON.parse(fs.readFileSync(real, "utf8")), at = (r) => path.resolve(path.dirname(real), r); const ptr = { ...base, lib: at(base.lib), ...(base.sig ? { sig: { ...base.sig, lib: at(base.sig.lib) } } : {}), ...(base.cells ? { cells: { ...base.cells, lib: at(base.cells.lib) } } : {}) }; const p = path.join(dir, "pharos.json"); fs.writeFileSync(p, JSON.stringify(ptr)); try { return await f(await openDoor({ pointer: p, log: "evidence", dir })); } finally { fs.rmSync(dir, { recursive: true, force: true }); } };

// the operators in helix order; janus writes only the first six
const OPS = ["NUL", "SIG", "INS", "SEG", "CON", "SYN", "DEF", "EVA", "REC"], op = (cell) => OPS.indexOf(cell.split("·")[0]);
test("through the door: the cuts and bonds are woven first, the world is COMPOSED FROM them and cites them, janus writes no DEF, EVA or REC, and nothing in the log is a verdict", { skip }, async () => {
  await withDoor((door) => {
    const { g } = world([...ann, C("died", "z", 1900)], { gate: GIVEN }), ev = g.evidence("x", "y"), w = g.world("x", "y"), r = writeEvidence(door, ev, w);
    assert.equal(r.refused, 0, r.why); assert.equal(r.written, 1 + ev.findings.length); assert.ok(r.worldId); assert.equal(r.findingIds.length, ev.findings.length);
    const worlds = door.ask(["merged-world"]), diffs = door.ask(["difference"]); assert.equal(worlds.length, 1); assert.equal(worlds[0].cell, "SYN·Pattern"); assert.equal(diffs.length, 1); assert.equal(diffs[0].cell, "CON·Figure");
    assert.deepEqual(worlds[0].of.slice().sort(), r.findingIds.slice().sort(), "the world cites every finding it was composed from"); assert.equal(worlds[0].body.composedFrom, ev.findings.length); assert.deepEqual(diffs[0].of, [], "a finding cites no world: the world comes after it");
    const all = (door.fold({}) ?? []).filter((x) => x.kind !== "kind"), byId = new Map(all.map((x) => [x.id, x]));
    assert.equal(all.some((x) => concluded(x.body)), false, "no entry janus left carries a conclusion");
    assert.equal(all.every((x) => op(x.cell) >= 0 && op(x.cell) <= 5), true, "janus writes Existence and Structure only: never DEF, EVA or REC");
    for (const x of all) for (const id of x.of ?? []) assert.ok(op(byId.get(id).cell) <= op(x.cell), `${x.kind} cites only things born at or before its own operator`);
    assert.equal(writeEvidence(door, ev, w).refused, 0, "writing the same evidence again does not fail");
  });
});

test("holes are cut (SEG) before bonds (CON) are woven, and the world follows both: the order in the log is the helix", { skip }, async () => {
  await withDoor((door) => {
    const { g } = world([C("born", "x", 1850), C("died", "y", 1820), C("capital", "x", "Paris")], { gate: { given: { ranges: GIVEN.given.ranges, functional: [{ kind: "k", rel: "capital", giver: "asker" }] } } }), ev = g.evidence("x", "y"); assert.ok(ev.findings.some((f) => f.type === "hole") && ev.findings.some((f) => f.type === "difference"), "the fixture has both a cut and a bond");
    const r = writeEvidence(door, ev, g.world("x", "y")); assert.equal(r.refused, 0, r.why);
    const order = (door.fold({}) ?? []).filter((x) => x.kind !== "kind").map((x) => op(x.cell)); assert.deepEqual(order, [...order].sort((p, q) => p - q), "weaving order never goes back to an earlier operator"); assert.equal(order.at(-1), 5, "the world is last");
  });
});

test("a LEARNED order rule has no upper bound (Infinity in the gate); it is written as null, and the real log accepts it", { skip }, async () => {
  const people = Object.fromEntries(["m1", "m2", "m3", "m4"].map((m, i) => [m, [C("born", m, 1800 + i), C("died", m, 1850 + i)]]));
  await withDoor((door) => {
    const { g } = world([...Object.values(people).flat(), ...ann], { gate: { order: [{ rel: "died", base: "born", kind: "k" }] } }), ev = g.evidence("x", "y"), d = ev.findings.find((f) => f.type === "difference");
    assert.equal(d.rule.standing, "candidate"); assert.equal(d.rule.max, null, "no upper bound is null, never Infinity"); assert.equal(d.rule.min, 0);
    const r = writeEvidence(door, ev, g.world("x", "y")); assert.equal(r.refused, 0, r.why); assert.equal(door.ask(["difference"])[0].body.rule.max, null);
  });
});

test("a raw result that carries a conviction (khora's organ with a real witness test) is still left as a witnessed difference, never as a conclusion", () => {
  const A = assertionsFromClaims(ann, { difference: diff }), refs = A.referents, ex = makeIdentityExclusion({ kindsOf: () => new Set(["k"]), assertionsOf: A.assertionsOf, functional: new Map(), sameValue: A.sameValue, differences: new Map([["k", [{ rel: "died", base: "born", min: 0, max: 150, giver: "asker" }]]]), difference: A.difference, witnessed: (a) => a.ref === true });
  const raw = ex.judge("x", "y"); assert.equal(raw.verdict, "contradicted", "the raw organ convicts when it is allowed to"); const e = evidenceOf(raw, { a: "x", b: "y" });
  assert.equal(e.counts.givenRule, 1); assert.equal(e.findings[0].via, "witnessed"); assert.equal(concluded(e), false); assert.equal(refs.length, 2);
});
