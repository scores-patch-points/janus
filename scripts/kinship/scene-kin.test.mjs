// scene-kin.test.mjs — the scene model's own tests (node --test scripts/kinship/scene-kin.test.mjs). Each rule is shown firing on a small text; the page layer is shown unchanged; nothing existing is touched.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { extract } from "./extract-kin.mjs";
import { bindKin as bind2, loadPriors } from "./bind-kin2.mjs";
import { prepare, apply, segment, sceneKin, paragraphsOf, PARAMS, SCENE_REASONS } from "./scene-kin.mjs";
import * as K from "../../native/organs/kinship.js";

const here = path.dirname(fileURLToPath(import.meta.url)), repo = path.join(here, "..", "..");
const priors = loadPriors();
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(path.join(repo, f))).digest("hex");
function ledgerFor(text, names) {
  const spans = [], referents = [];
  names.forEach((nm, k) => { const ref = `ref_${k}_${nm.replace(/\s+/g, "_")}`; referents.push({ id: ref, face: nm, standing: "referent", forms: [nm.toLowerCase()], mentions: 1 });
    let at = -1; while ((at = text.indexOf(nm, at + 1)) >= 0) spans.push({ id: `spn_${ref}_${at}`, kind: "name", text: nm, at: [at, at + nm.length], bytes: [Buffer.byteLength(text.slice(0, at)), Buffer.byteLength(text.slice(0, at + nm.length))], ref }); });
  return { schema: "KinLedger@1", text_sha256: "test", referents, spans: spans.sort((a, b) => a.at[0] - b.at[0]), sentences: [] };
}
const setup = (text, names) => { const ledger = ledgerFor(text, names), extraction = extract({ text, lang: "ru", lexicon: priors.lexicon, namePartsRu: priors.nameParts }); return { text, ledger, extraction, priors }; };
const R = (names, nm) => `ref_${names.indexOf(nm)}_${nm.replace(/\s+/g, "_")}`;

test("S-SUBJ: a kin word with no marker takes the clause's subject as possessor (the page layer leaves a typed gap)", () => {
  const names = ["Андрей"], text = "Князь Андрей сказал, что любил жену.\n", args = setup(text, names);
  const page = bind2({ ...args, tier: 2 }).statements[0]; assert.equal(page.possessor.ref, null); assert.equal(page.possessor.gap, "no_marker");
  const s = sceneKin({ ...args, tier: 2 }).statements[0]; assert.equal(s.possessor.rule, "S-SUBJ"); assert.equal(s.possessor.ref, R(names, "Андрей"));
});
test("S-TOPIC: with no subject before the kin word, the possessor is the scene's topic (the subject of the nearest earlier sentence)", () => {
  const names = ["Николай"], text = "Николай сказал, что дом пуст.\nПотом отец был дома.\n", args = setup(text, names);
  assert.equal(bind2({ ...args, tier: 2 }).statements[0].possessor.ref, null);
  const s = sceneKin({ ...args, tier: 2 }).statements[0]; assert.equal(s.possessor.rule, "S-TOPIC"); assert.equal(s.possessor.ref, R(names, "Николай"));
});
test("a being with no gender evidence is not a topic (the ledger holds places): no tie", () => {
  const names = ["Москве"], text = "Москве было жарко.\nПотом отец был дома.\n", args = setup(text, names);
  const s = sceneKin({ ...args, tier: 2 }).statements[0]; assert.equal(s.possessor.ref, null); assert.equal(s.possessor.gap, "scene_no_topic");
});
test("S-PRON: a possessive the page layer could not place (its reach is the paragraph and the one before) is resolved through the scene", () => {
  const names = ["Пьер"], text = "Пьер сказал это.\n\nВсе молчали.\n\nБыло поздно.\n\nПотом сын его пришел.\n", args = setup(text, names);
  const page = bind2({ ...args, tier: 2 }).statements[0]; assert.equal(page.possessor.ref, null); assert.equal(page.possessor.gap, "antecedent_absent");
  const s = sceneKin({ ...args, tier: 1 }).statements[0]; assert.equal(s.possessor.rule, "S-PRON"); assert.equal(s.possessor.ref, R(names, "Пьер"));
});
test("S-PRON stops at the scene: a chapter heading between the name and the possessive is a hard break", () => {
  const names = ["Пьер"], text = "Пьер сказал это.\n\nII.\n\nПотом сын его пришел.\n", args = setup(text, names);
  assert.equal(sceneKin({ ...args, tier: 1 }).statements[0].possessor.ref, null);
});
test("K-KNOWN: a relation the page layer tied earlier in the scene names the holder of a later bare kin word", () => {
  const names = ["Андрей", "Николая"], text = "Андрей, сын князя Николая, сказал это.\nПотом Андрей сказал, что отец был дома.\n", args = setup(text, names);
  const page = bind2({ ...args, tier: 2 }); assert.ok(page.statements[0].fact, "the page layer ties the first statement at both ends");
  const r = sceneKin({ ...args, tier: 3 }), s = r.statements[1];
  assert.equal(s.possessor.ref, R(names, "Андрей")); assert.equal(s.holder.rule, "K-KNOWN"); assert.equal(s.holder.ref, R(names, "Николая")); assert.ok(s.fact && s.fact.giver.startsWith("text:ru|rule:"));
});
test("S-OTHER: the one other person of the sentence is the holder; two are a typed gap", () => {
  const n1 = ["Наташа", "Николай"], t1 = "Наташа сказала, что брат Николай был дома.\n";   // (a marker would tie it on the page; use the bare form below)
  const names = ["Наташа", "Николай"], text = "Николай пришел домой, а Наташа сказала, что любила брата.\n", args = setup(text, names), s = sceneKin({ ...args, tier: 3 }).statements[0];
  assert.equal(s.possessor.ref, R(names, "Наташа")); assert.equal(s.holder.rule, "S-OTHER"); assert.equal(s.holder.ref, R(names, "Николай"));
  const names2 = ["Наташа", "Николай", "Борис"], text2 = "Николай пришел домой, Борис пришел тоже, а Наташа сказала, что любила брата.\n", s2 = sceneKin({ ...setup(text2, names2), tier: 3 }).statements[0];
  assert.equal(s2.holder.ref, null); assert.equal(s2.holder.gap, "scene_holder_ambiguous"); void n1; void t1;
});
test("a rule never replaces a tie the page layer made, and never ties both ends to one being", () => {
  const names = ["Василия", "Элен"], text = "Приехала дочь князя Василия, красавица Элен, и села.\n", args = setup(text, names);
  const page = bind2({ ...args, tier: 2 }).statements[0], s = sceneKin({ ...args, tier: 3 }).statements[0];
  assert.ok(page.holder.ref && page.possessor.ref);
  assert.deepEqual([s.holder.ref, s.possessor.ref, s.holder.rule, s.possessor.rule], [page.holder.ref, page.possessor.ref, page.holder.rule, page.possessor.rule]);
  const n2 = ["Николай"], t2 = "Николай сказал, что любил Николая и жену.\n";
  for (const t of [1, 2, 3]) for (const st of sceneKin({ ...setup(t2, n2), tier: t }).statements) if (st.holder.ref && st.possessor.ref) assert.notEqual(st.holder.ref, st.possessor.ref);
});
test("scenes: a chapter heading is a hard break; a paragraph whose beings none was named in the last W paragraphs breaks; overlap continues", () => {
  const names = ["Андрей", "Пьер", "Наташа"], text = "Андрей вошел.\nАндрей и Пьер говорили.\nПьер ушел.\nНаташа пела.\n\nII.\n\nНаташа пела.\n", args = setup(text, names), P = prepare(args), sc = segment(P);
  assert.deepEqual(sc.map((s) => [s.from, s.to]), [[0, 2], [3, 3], [4, 4]]);
  assert.equal(paragraphsOf(text).filter((p) => p.heading).length, 2);
});
test("the shuffled-scene control takes the state of another scene's paragraph; the real pass is unchanged by it", () => {
  const names = ["Николай", "Наташа"], text = "Николай сказал, что дом пуст.\nПотом отец был дома.\n\nII.\n\nНаташа сказала, что дом пуст.\nПотом мать была дома.\n", args = setup(text, names), P = prepare(args);
  const real = apply(P, { tier: 2 }); const r0 = JSON.stringify(real.statements);
  const sigma = [2, 2, 0, 0];     // paragraph k takes the state at the start of paragraph sigma[k] of the real pass (here: the other chapter's)
  const sh = apply(P, { tier: 2, mode: "shuffled", sigma, snaps0: real.snaps });
  assert.equal(real.statements[0].possessor.ref, R(names, "Николай")); assert.notEqual(sh.statements[0].possessor.ref, R(names, "Николай"));
  assert.equal(JSON.stringify(apply(P, { tier: 2 }).statements), r0);
});
test("every unbound end is a typed gap with a kind of kinship.js and a reason of the closed set; facts enter the fact base without refusal", () => {
  const names = ["Николай"], text = "Николай сказал, что дом пуст.\nПотом отец был дома, а брат был в Москве.\n", args = setup(text, names), r = sceneKin({ ...args, tier: 3 });
  for (const s of r.statements) for (const g of s.gaps) { assert.ok(Object.hasOwn(K.GAP_KINDS, g.kind)); assert.ok(SCENE_REASONS.includes(g.why), g.why); }
  const base = K.factBase(r.specs); assert.equal(base.refused.length, 0);
});
test("determinism: two runs are byte-identical", () => {
  const names = ["Николай", "Андрей"], text = "Андрей, сын князя Николая, сказал это.\nАндрей сказал, что отец был дома.\n", args = setup(text, names);
  assert.equal(JSON.stringify(sceneKin({ ...args, tier: 3 })), JSON.stringify(sceneKin({ ...args, tier: 3 })));
});
test("the page layer and everything existing are the files of main (the PR adds files and changes none)", () => {
  assert.equal(sha("scripts/kinship/bind-kin2.mjs"), "b4703c99533211585b0c8a4fe7eeeedd1c674665bf8d6b8dbc75ba0c58357d3a");
  assert.equal(sha("scripts/kinship/bind-kin.mjs"), "da075991f427d4483990b1a6a1bdd0ac84ab7465c834e4a4dc0452b73c540f72");
  assert.equal(sha("scripts/kinship/score-kin-binder2.mjs"), "1fda2e081c56f6b40029f224035d235d34395d4027df5201f30db410b8c73bd3");
  assert.equal(sha("scripts/kinship/extract-kin.mjs"), "a4f776bbadd6381f8ed1890804cac77c8b23b96e7a6d4eea222ac20514d766e4");
  assert.equal(sha("native/organs/kinship.js"), "6f4b5131d9d267fb537b0104062f0acdb17f5bb9026b148c2894fce7156eb4ba");
  for (const f of ["scripts/kinship/bind-kin2.mjs", "scripts/kinship/bind-kin.mjs", "scripts/kinship/extract-kin.mjs", "native/organs/kinship.js"]) assert.ok(!/scene-kin/.test(fs.readFileSync(path.join(repo, f), "utf8")), `${f} must not mention the scene model`);
});
test("no model, no network, no name list: scene-kin.mjs imports only node builtins, the kinship organ, the second binder and the extractor; its givers are the binders' priors", () => {
  const src = fs.readFileSync(path.join(here, "scene-kin.mjs"), "utf8"), specs = [...src.matchAll(/(?:from|import\()\s*["']([^"']+)["']/g)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set(specs)], ["./bind-kin2.mjs", "./extract-kin.mjs", "../../native/organs/kinship.js", "node:crypto", "node:fs", "node:path", "node:url"].sort());
  assert.ok(!/fetch\(|XMLHttpRequest|https?:\/\/|child_process|WebSocket/.test(src.replace(/\/\/.*$/gm, "")));
});
test("params: one declared parameter, W, and it is frozen", () => { assert.deepEqual(Object.keys(PARAMS), ["W"]); assert.ok(Object.isFrozen(PARAMS)); });
