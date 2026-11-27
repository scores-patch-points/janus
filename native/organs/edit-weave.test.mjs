// edit-weave: the WHOLE path through the pharos, by kind, with real khora output replayed as khora (frozen fixture of weaveFramedReading on 'Please trim this clip. Then make the pacing better. Delete it.').
// khora -> [text, text-codec, text-reading] -> janus eot-weave -> [text-eot] -> janus edit-weave -> [edit-intent]. Janus imports nothing of khora. Needs $PHAROS_LIB, $ACT_PRIOR and the English grammar priors.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { openDoor } from "./pharos-door.mjs"; import { weaveEot } from "./eot-weave.mjs"; import { weaveEdits, weaveProposals, INTENT_KIND, INTENT_CELL, PROPOSAL_KIND, PROPOSAL_CELL } from "./edit-weave.mjs"; import { PRIORS } from "./nl-eot.mjs";
const FIX = JSON.parse(fs.readFileSync(new URL("./fixtures/khora-command.fixture.json", import.meta.url), "utf8")), LIB = process.env.PHAROS_LIB ?? "", ACT = process.env.ACT_PRIOR ?? "/home/user/Zenodotus/derived-priors/act-priors/act-prior-en.json";
const haveEng = fs.readdirSync(PRIORS).some((f) => f.startsWith("ud-parser-eng-")) && fs.existsSync(path.join(PRIORS, "ud-grammar-eng.json.gz"));
const skip = !LIB || !fs.existsSync(LIB) ? "pharos library not found (set PHAROS_LIB)" : !fs.existsSync(ACT) ? "no act prior (set ACT_PRIOR)" : !haveEng ? "no English grammar priors" : false;
const act = skip ? null : JSON.parse(fs.readFileSync(ACT, "utf8")).forms, sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
async function replay() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "jedit-")), p = path.join(d, "pharos.json"); fs.writeFileSync(p, JSON.stringify({ lib: LIB, sha256: sha(LIB) }));
  const khora = await openDoor({ pointer: p, dir: path.join(d, "log"), log: "fold", writer: "khora" }), janus = await openDoor({ pointer: p, dir: path.join(d, "log"), log: "fold" }); let textId = null;
  for (const e of FIX) { if (e.kind === "kind") { khora.declare(e.body.name, e.body.cell, e.body.why); continue; } const w = khora.weave({ cell: e.cell, kind: e.kind, addr: e.addr, body: e.body, of: e.kind === "text" ? [] : [textId] }); assert.ok(w, khora.counts.lastReason); if (e.kind === "text") textId = w.id; }
  return janus;
}
test("the whole path by kind: khora's entries -> text-eot -> one edit-intent per sentence at CON·Figure, of the text-eot, with the verbs, primitives and gaps the sentences carry", { skip }, async () => {
  const j = await replay(); assert.equal(weaveEot(j).written, 1); const r = weaveEdits(j, { act, selection: "clip-7" }); assert.deepEqual([r.written, r.refused], [3, 0], r.why);
  const got = j.ask([INTENT_KIND]); assert.equal(got.length, 3); assert.ok(got.every((e) => e.cell === INTENT_CELL && e.of.length === 1 && e.addr.includes("#")));
  const by = got.map((e) => e.body); assert.deepEqual(by.map((b) => [b.verb, b.status]), [["trim", "needs_params"], ["make", "gap"], ["delete", "gap"]]);
  assert.equal(by[0].theme.bound, "clip-7"); assert.deepEqual(by[1].gaps.map((g) => g.gap), ["unconsumed_structure", "no_criterion"], "'Then' (advmod) is not read, so even the criterion gap is not the only gap"); assert.deepEqual(by[2].gaps.map((g) => g.gap), ["referent_unresolved"]);
  assert.ok(!JSON.stringify(by).includes('"verdict"'), "nothing decided");
});
test("idempotent; a stated salient referent resolves 'delete it' but nothing else changes; a declared criterion removes ONLY the no_criterion gap (the sentence Then-make-the-pacing-better still carries an unread advmod); with no act prior every sentence is the typed gap no_act_prior", { skip }, async () => {
  const j = await replay(); weaveEot(j); weaveEdits(j, { act, selection: "c" }); assert.deepEqual([weaveEdits(j, { act, selection: "c" }).written, j.ask([INTENT_KIND]).length], [0, 3]);
  const k = await replay(); weaveEot(k); weaveEdits(k, { act, selection: "c", salient: "clip-3", criteria: { "pacing|good": { measure: "outlier_gaps", direction: "fewer" } } });
  assert.deepEqual(k.ask([INTENT_KIND]).map((e) => [e.body.verb, e.body.status, e.body.theme.bound]), [["trim", "needs_params", "c"], ["make", "gap", null], ["delete", "needs_params", "clip-3"]]);
  const n = await replay(); weaveEot(n); weaveEdits(n, { act: null, selection: "c" }); assert.ok(n.ask([INTENT_KIND]).every((e) => e.body.gaps.some((g) => g.gap === "no_act_prior")));
});
test("a text with no text-eot (no declared language, so eot-weave wrote a gap) yields no intent, never a guess; a door that is off writes nothing and says why", { skip }, async () => {
  const j = await replay(); assert.deepEqual([weaveEdits(j, { act }).written, j.ask([INTENT_KIND]).length], [0, 0]);
  const off = weaveEdits({ on: false, why: "no pointer" }); assert.deepEqual([off.written, off.refused, off.why], [0, 1, "no pointer"]);
});

// SYNTHETIC word timings (seconds): 16 words from 1.2 s, each 0.3 long with 0.2 gaps, then one 2.0 s hole, then 16 more
const talk = (t0, n) => Array.from({ length: n }, (_, i) => ({ start: +(t0 + i * 0.5).toFixed(3), end: +(t0 + i * 0.5 + 0.3).toFixed(3) }));
test("proposals are NOMINATIONS at SEG·Figure, of the intent: 'trim this clip' (bound) gets trim_to_speech spans from the clip's own gaps; 'make the pacing better' with a declared criterion gets one proposal per outlier gap; nothing without word timing; idempotent; no verdict word", { skip }, async () => {
  const a = talk(1.2, 16), b = talk(a.at(-1).end + 2.0, 16), words = [...a, ...b], j = await replay(); weaveEot(j);
  weaveEdits(j, { act, selection: "clip-7", criteria: { "pacing|good": { measure: "outlier_gaps", direction: "fewer" } } });
  assert.match(weaveProposals(j, { clips: {} }).why, /no_words/); assert.equal(j.ask([PROPOSAL_KIND]).length, 0);
  const r = weaveProposals(j, { clips: { "clip-7": { start: 0, end: 12 } }, words }); assert.equal(r.refused, 0, r.why); const ps = j.ask([PROPOSAL_KIND]); assert.ok(ps.every((e) => e.cell === PROPOSAL_CELL && e.of.length === 1 && e.addr.startsWith("proposal:")));
  const trim = ps.find((e) => e.body.method === "trim_to_speech"), gap = ps.filter((e) => e.body.method === "outlier_gaps"); assert.equal(trim.body.clip, "clip-7"); assert.deepEqual(trim.body.spans[0], { from: 0, to: 1 }); assert.equal(gap.length, 1); assert.ok(gap[0].body.saves > 1.5);
  assert.deepEqual([weaveProposals(j, { clips: { "clip-7": { start: 0, end: 12 } }, words }).written, j.ask([PROPOSAL_KIND]).length], [0, ps.length]); assert.ok(!JSON.stringify(ps.map((e) => e.body)).includes("verdict"));
});
