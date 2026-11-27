// edit-weave: the WHOLE path through the pharos, by kind, with real khora output replayed as khora (frozen fixture of weaveFramedReading on 'Please trim this clip. Then make the pacing better. Delete it.').
// khora -> [text, text-codec, text-reading] -> janus eot-weave -> [text-eot] -> janus edit-weave -> [edit-intent]. Janus imports nothing of khora. Needs $PHAROS_LIB, $ACT_PRIOR and the English grammar priors.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { openDoor } from "./pharos-door.mjs"; import { weaveEot } from "./eot-weave.mjs"; import { weaveEdits, INTENT_KIND, INTENT_CELL } from "./edit-weave.mjs"; import { PRIORS } from "./nl-eot.mjs";
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
  assert.equal(by[0].theme.bound, "clip-7"); assert.deepEqual(by[1].gaps.map((g) => g.gap), ["no_criterion"]); assert.deepEqual(by[2].gaps.map((g) => g.gap), ["referent_unresolved"]);
  assert.ok(!JSON.stringify(by).includes('"verdict"'), "nothing decided");
});
test("idempotent; a stated salient referent resolves 'delete it' but nothing else changes; a declared criterion resolves 'make the pacing better'; with no act prior every sentence is the typed gap no_act_prior", { skip }, async () => {
  const j = await replay(); weaveEot(j); weaveEdits(j, { act, selection: "c" }); assert.deepEqual([weaveEdits(j, { act, selection: "c" }).written, j.ask([INTENT_KIND]).length], [0, 3]);
  const k = await replay(); weaveEot(k); weaveEdits(k, { act, selection: "c", salient: "clip-3", criteria: { "pacing|good": { measure: "outlier_gaps", direction: "fewer" } } });
  assert.deepEqual(k.ask([INTENT_KIND]).map((e) => [e.body.verb, e.body.status, e.body.theme.bound]), [["trim", "needs_params", "c"], ["make", "ready", null], ["delete", "needs_params", "clip-3"]]);
  const n = await replay(); weaveEot(n); weaveEdits(n, { act: null, selection: "c" }); assert.ok(n.ask([INTENT_KIND]).every((e) => e.body.gaps.some((g) => g.gap === "no_act_prior")));
});
test("a text with no text-eot (no declared language, so eot-weave wrote a gap) yields no intent, never a guess; a door that is off writes nothing and says why", { skip }, async () => {
  const j = await replay(); assert.deepEqual([weaveEdits(j, { act }).written, j.ask([INTENT_KIND]).length], [0, 0]);
  const off = weaveEdits({ on: false, why: "no pointer" }); assert.deepEqual([off.written, off.refused, off.why], [0, 1, "no pointer"]);
});
