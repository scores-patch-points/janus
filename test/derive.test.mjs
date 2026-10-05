// derive.test.mjs — the derive seam's contract, over the REAL ledger and the
// REAL licensed closure (khora's notes-text ledger, janus's derivation).
// Ground truth by construction: a relay a→b→c→d→e recorded by two sources read
// by two instruments; `a after c` is TRUE and never stated; `e after a` is not
// derivable (and a planted one-witness `z replaces a` must stop at the floor).
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createJanusHandlers, DERIVE_REFUSALS } from "../native/handlers.js";
import * as TL from "../native/kernel/task-log.js";
import { createDeclarationLog, proposeCandidate, promote } from "../native/interpretation/declarations.js";
import { cellOf } from "../../khora/native/kernel/cube.js";
import { sourceOfWitness, recipeOfWitness } from "../../khora/native/kernel/notes.js";
import * as NT from "../../khora/native/organs/notes-text.js";
import { classifyTurn } from "../../khora/native/organs/reason-gate.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const taskLog = { ...TL, cellOf };
const hl = NT.makeNotesText(taskLog);
const GIVER = "derive.test.mjs — a stand-in giver, disclosed: the relay's handover semantics are declared by this test";
const FLOOR = { sources: 2, instruments: 2 };
const POLICY = { floor: FLOOR, carry: false, maxSteps: 6 };

function relayLedger() {
  let log = hl.createNotes(), i = 0;
  const chain = ["a", "b", "c", "d", "e"];
  for (const s of ["log-1", "log-2"]) for (const r of ["read-v1", "read-v2"]) {
    for (let k = 0; k + 1 < chain.length; k++) log = hl.hear(log, { subject: chain[k], verb: "replaces", object: chain[k + 1], witness: `${s}~${r}`, spans: [{ at: `${s}#${i * 10}-${i * 10 + 7}`, ref: s, text: "handover" }] }), i++;
  }
  return hl.hear(log, { subject: "z", verb: "replaces", object: "a", witness: "log-1~read-v1", spans: [{ at: "log-1#990-997", ref: "log-1", text: "handover" }] });
}
function licensed() {
  const p = proposeCandidate(createDeclarationLog(), { kind: "composes", rel: "replaces", yields: "after", acquisition: { note: "declared by the test" }, source: "relay ledger" });
  return promote(p.log, p.id, { giver: GIVER }).log;
}
const ctx = (over = {}) => ({ notes: relayLedger(), taskLog, hyperlexicon: hl, declarations: licensed(), ...POLICY, ...over });
const J = (opts = {}) => createJanusHandlers({ notesRead: { sourceOfWitness, recipeOfWitness }, runReason: async () => ({ status: 200, type: "text/plain", body: "" }), ...opts });

test("settled: a claim the licensed closure derives returns settled:true with the real derivation", async () => {
  const { derive } = J();
  const r = await derive({ end1: "a", label: "after", end2: "c" }, ctx());
  assert.equal(r.settled, true);
  assert.match(r.reason, /derived from \d+ premise\(s\) at depth \d+ under licence of derive\.test\.mjs/);
  const d = r.derivation;
  assert.equal(d.id, "derived:a|after|c");
  assert.deepEqual([d.subject, d.verb, d.object], ["a", "after", "c"]);
  assert.ok(d.depth >= 1 && d.paths >= 1);
  assert.equal(d.giver, GIVER);
  assert.equal(d.premises.length, 2, "a replaces b, b replaces c");
  assert.deepEqual(d.premises.map((p) => `${p.end1}|${p.label}|${p.end2}`).sort(), ["a|replaces|b", "b|replaces|c"]);
  assert.ok(d.provenance.length > 0, "provenance reaches bytes through the premises");
  assert.deepEqual({ sources: d.restsOn.sources, instruments: d.restsOn.instruments }, { sources: 2, instruments: 2 });
  assert.equal(d.licences[0].rel, "replaces");
});

test("settled via {subject, verb, object}, and via an injected claimOf reader for a free-text task", async () => {
  const { derive } = J({ claimOf: (t) => (/does a come after c/i.test(t) ? { subject: "a", verb: "after", object: "c" } : null) });
  assert.equal((await derive({ subject: "a", verb: "after", object: "c" }, ctx())).settled, true);
  assert.equal((await derive("Does a come after c?", ctx())).settled, true);
  const none = await derive("what is the weather", ctx());
  assert.equal(none.settled, false);
  assert.equal(none.reason, DERIVE_REFUSALS.no_claim);
});

test("unsettled: a claim the closure does NOT derive says so with counts — and the planted one-witness note stopped at the floor", async () => {
  const { derive } = J();
  const r = await derive({ end1: "e", label: "after", end2: "a" }, ctx());
  assert.equal(r.settled, false);
  assert.ok(r.reason.startsWith(DERIVE_REFUSALS.not_derived), r.reason);
  assert.match(r.reason, /1 premise\(s\) stopped at the floor/);
  assert.equal(r.derivation, undefined);
  // a stated (heard) note is not a derivation either
  assert.equal((await derive({ end1: "a", label: "replaces", end2: "b" }, ctx())).settled, false);
});

test("control built to fail: with no licence declared, the same claim is unsettled (derivation needs a giver)", async () => {
  const { derive } = J();
  const r = await derive({ end1: "a", label: "after", end2: "c" }, ctx({ declarations: createDeclarationLog() }));
  assert.equal(r.settled, false);
  assert.match(r.reason, /0 derived/);
});

test("typed gaps: no ledger, no declared policy, and a floor/carry/maxSteps each missing", async () => {
  const { derive } = J();
  const claim = { end1: "a", label: "after", end2: "c" };
  assert.equal((await derive(claim)).reason, DERIVE_REFUSALS.no_ledger);
  assert.equal((await derive(claim, { notes: relayLedger(), taskLog, hyperlexicon: hl })).reason, DERIVE_REFUSALS.no_policy);
  for (const drop of ["declarations", "floor", "carry", "maxSteps"]) {
    const c = ctx(); delete c[drop];
    const r = await derive(claim, c);
    assert.equal(r.settled, false, drop);
    assert.equal(r.reason, DERIVE_REFUSALS.no_policy, drop);
  }
});

test("a malformed floor is a typed gap, never a throw (classifyTurn awaits derive bare)", async () => {
  const { derive } = J();
  const r = await derive({ end1: "a", label: "after", end2: "c" }, ctx({ floor: { sources: 0, instruments: 0 } }));
  assert.equal(r.settled, false);
  assert.match(r.reason, /^derivation could not run: /);
});

test("derive never writes the caller's ledger", async () => {
  const { derive } = J();
  const c = ctx();
  const before = JSON.stringify(c.notes);
  await derive({ end1: "a", label: "after", end2: "c" }, c);
  assert.equal(JSON.stringify(c.notes), before);
});

test("deriveContext supplies the defaults, so classifyTurn's ONE-argument derive(task) call works; the 2nd argument overrides", async () => {
  const base = ctx();
  let reads = 0;
  const { derive } = J({ deriveContext: () => { reads++; return base; } });
  const claim = { end1: "a", label: "after", end2: "c" };
  assert.equal((await derive(claim)).settled, true);
  assert.equal(reads, 1, "a live context is read per call");
  assert.equal((await derive(claim, { declarations: createDeclarationLog() })).settled, false, "override wins");
});

test("end to end through khora's real classifyTurn: the reasoning lane goes live, and an underivable turn stays off it", async () => {
  const j = J({
    deriveContext: ctx(),
    claimOf: (t) => (t === "does a come after c" ? { end1: "a", label: "after", end2: "c" } : t === "does e come after a" ? { end1: "e", label: "after", end2: "a" } : null),
  });
  const yes = await classifyTurn({ task: "does a come after c", derive: j.derive, records: [] });
  assert.equal(yes.lane, "reasoning");
  assert.equal(yes.derivation.derivation.id, "derived:a|after|c");
  const no = await classifyTurn({ task: "does e come after a", derive: j.derive, records: [] });
  assert.notEqual(no.lane, "reasoning");
});

test("unwired corroboration (no notesRead, ever) is a typed gap in derive, not a TypeError", () => {
  const code = `
    import { createJanusHandlers, DERIVE_REFUSALS } from ${JSON.stringify(pathToFileURL(path.join(HERE, "..", "native", "handlers.js")).href)};
    const logs = [];
    const j = createJanusHandlers({ log: (l) => logs.push(l) });
    const r = await j.derive({ end1: "a", label: "after", end2: "c" }, { notes: {}, taskLog: {}, hyperlexicon: {} });
    console.log(JSON.stringify({ r, ok: r.reason === DERIVE_REFUSALS.no_witness_read, logged: logs.length }));`;
  const out = spawnSync(process.execPath, ["--input-type=module", "-e", code], { encoding: "utf8", timeout: 30000 });
  assert.equal(out.status, 0, out.stderr);
  const j = JSON.parse(out.stdout);
  assert.equal(j.ok, true);
  assert.equal(j.r.settled, false);
  assert.equal(j.logged, 1, "the missing wiring is logged once at boot");
});
