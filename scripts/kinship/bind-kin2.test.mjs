// bind-kin2.test.mjs — the second binder's own tests (node --test scripts/kinship/bind-kin2.test.mjs). Each fault the first binder's held-out run found is shown firing on the first binder and fixed on the second.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { extract } from "./extract-kin.mjs";
import { bindKin as bind1 } from "./bind-kin.mjs";
import { bindKin as bind2, loadPriors, PARAMS, REASONS } from "./bind-kin2.mjs";
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
const run = (bind, text, names, tier = 2) => { const ledger = ledgerFor(text, names), extraction = extract({ text, lang: "ru", lexicon: priors.lexicon, namePartsRu: priors.nameParts }); return bind({ text, ledger, extraction, priors, tier }); };
const R = (names, nm) => `ref_${names.indexOf(nm)}_${nm.replace(/\s+/g, "_")}`;

test("F1: a name is not taken across a comma into the next list item (v1 does, v2 does not)", () => {
  const names = ["Соня"], text = "Это был старший сын графа, Соня пришла в гостиную.";
  assert.equal(run(bind1, text, names).statements[0].possessor.ref, R(names, "Соня"));      // the fault
  const s = run(bind2, text, names).statements[0]; assert.equal(s.possessor.ref, null);
});
test("F1 keeps the comma right after a possessive: «Дочь его, княжна Элен»", () => {
  const names = ["Василий", "Элен"], s = run(bind2, "Князь Василий вышел. Потом дочь его, княжна Элен, пошла.", names).statements[0];
  assert.equal(s.holder.rule, "H-APP-DET"); assert.equal(s.holder.ref, R(names, "Элен")); assert.equal(s.possessor.ref, R(names, "Василий"));
});
test("F2: a list item after a comma is not an apposition (v1 ties the next name, v2 does not)", () => {
  const names = ["Борис", "Анны Михайловны", "Николай"], text = "Это молодое поколение: Борис — офицер, сын княгини Анны Михайловны, Николай — студент.";
  assert.equal(run(bind1, text, names).statements[0].holder.ref, R(names, "Николай"));      // the fault
  const s = run(bind2, text, names).statements[0]; assert.equal(s.holder.ref, R(names, "Борис")); assert.equal(s.holder.rule, "H-DASH"); assert.equal(s.possessor.ref, R(names, "Анны Михайловны")); assert.equal(s.possessor.rule, "P-GEN");
});
test("F2 keeps «дочь князя Василия, красавица Элен»", () => {
  const names = ["Василия", "Элен"], s = run(bind2, "Приехала дочь князя Василия, красавица Элен, и села.", names).statements[0];
  assert.equal(s.holder.rule, "H-APP2"); assert.equal(s.holder.ref, R(names, "Элен"));
});
test("F3: no name across a preposition (v1 ties «с князем Ипполитом», v2 does not)", () => {
  const names = ["Андрей", "Ипполитом"], text = "Князь Андрей слушал болтовню своей жены с князем Ипполитом.";
  assert.equal(run(bind1, text, names).statements[0].holder.ref, R(names, "Ипполитом"));   // the fault
  assert.equal(run(bind2, text, names).statements[0].holder.ref, null);
});
test("F3: an apposition-left name that follows a preposition is a clause boundary, not an apposition («в Москву, отец»)", () => {
  const names = ["Москву", "Пьер"], text = "Пьер вернулся в Москву, отец отпустил аббата.";
  assert.equal(run(bind1, text, names).statements[0].holder.ref, R(names, "Москву"));       // the fault
  assert.equal(run(bind2, text, names).statements[0].holder.ref, null);
});
test("F4: a dash inside narration is not a turn boundary, so a possessive there is read as narrative (v1: pronoun_in_speech)", () => {
  const names = ["Безухова", "Пьере"], text = "— Chère comtesse, — послышались голоса. Разговор зашел о новости того времени — о болезни графа Безухова и о его незаконном сыне Пьере.";
  assert.equal(run(bind1, text, names).statements[0].possessor.gap, "pronoun_in_speech");  // the fault
  const s = run(bind2, text, names).statements[0]; assert.equal(s.possessor.ref, R(names, "Безухова")); assert.equal(s.possessor.rule, "P-PRON3"); assert.equal(s.holder.ref, R(names, "Пьере"));
});
test("F4 keeps the real turn boundaries: speech, attribution, speech", () => {
  const names = ["Пьер"], s = run(bind2, "— Я люблю моего сына, — сказал Пьер. — Он хороший.", names).statements[0];
  assert.equal(s.possessor.rule, "P-SPEAKER");
});
test("F5: P-SUBJ is gone: a bare kin word takes no being (v1 takes the nearest)", () => {
  const names = ["Василий"], text = "Князь Василий желал определить сына на это место.";
  assert.equal(run(bind1, text, names).statements[0].possessor.rule, "P-SUBJ");            // the fault
  const s = run(bind2, text, names).statements[0]; assert.equal(s.possessor.ref, null); assert.equal(s.possessor.gap, "no_marker");
});
test("N1 H-DASH: Name — [words] kin word: holder = the name; the possessor stays a typed gap with a slot and an opinion slot", () => {
  const names = ["Петруша"], s = run(bind2, "Все сидели в гостиной, и маленький Петруша — меньшой сын, был весел.", names).statements[0];
  assert.equal(s.holder.rule, "H-DASH"); assert.equal(s.holder.ref, R(names, "Петруша")); assert.equal(s.possessor.gap, "no_marker");
  const g = s.gaps[0]; assert.ok(Object.hasOwn(K.GAP_KINDS, g.kind)); assert.ok(REASONS.includes(g.why)); assert.ok(g.opinionSlot && g.opinionSlot.schema === K.OPINION_SLOT_SCHEMA);
});
test("N1 H-DASH does not reach past a being, a sentence break or four words", () => {
  const names = ["Соня", "Петя"], t1 = "Соня — молодая, веселая и добрая девочка, а Петя играл с отцом.", s = run(bind2, t1, names).statements[0];
  assert.equal(s.holder.ref, null);
});
test("the tier-1/tier-2 split and the rest of the first binder's rules are unchanged (the first binder's tests' P-VOC, P-SPEAKER, P-PRON3 cases give the same answers)", () => {
  const names = ["Анна Михайловна"], a = run(bind2, "— Chère Анна Михайловна, — сказал он, — сын ваш будет переведен.", names).statements[0]; assert.equal(a.possessor.rule, "P-VOC");
  const one = ["Андрей"], text = "Князь Андрей вошел в гостиную. Лицо его жены было скучно."; assert.equal(run(bind2, text, one).statements[0].possessor.rule, "P-PRON3"); assert.equal(run(bind2, text, one, 1).statements[0].possessor.gap, "antecedent_not_searched");
});
test("emitted facts enter the fact base without refusal; the giver names the rule; determinism: two runs are byte-identical", () => {
  const names = ["Василия", "Элен"], text = "Приехала дочь князя Василия, красавица Элен, и села.";
  const a = run(bind2, text, names), b = run(bind2, text, names); assert.equal(JSON.stringify(a), JSON.stringify(b));
  const base = K.factBase(a.specs); assert.equal(base.refused.length, 0); assert.ok(base.facts.every((f) => f.standing === "candidate" && f.giver.startsWith("text:ru|rule:")));
});
test("the first binder, the plain extractor, the kinship organ and the first scorer are the files of main (the PR adds files and changes none)", () => {
  assert.equal(sha("scripts/kinship/bind-kin.mjs"), "da075991f427d4483990b1a6a1bdd0ac84ab7465c834e4a4dc0452b73c540f72");
  assert.equal(sha("scripts/kinship/score-kin-binder.mjs"), "ba300f9b3631da7c89c5c1475cb55b24662af5ee20fd248146842fbed84e8979");
  assert.equal(sha("scripts/kinship/extract-kin.mjs"), "a4f776bbadd6381f8ed1890804cac77c8b23b96e7a6d4eea222ac20514d766e4");
  assert.equal(sha("scripts/kinship/measure-kin.mjs"), "02441a4d650397ec6afa2f33544afecca7207652b8e31e9a6c5caf9fa2fd29ac");
  assert.equal(sha("native/organs/kinship.js"), "6f4b5131d9d267fb537b0104062f0acdb17f5bb9026b148c2894fce7156eb4ba");
  for (const f of ["scripts/kinship/bind-kin.mjs", "scripts/kinship/extract-kin.mjs", "native/organs/kinship.js"]) assert.ok(!/bind-kin2/.test(fs.readFileSync(path.join(repo, f), "utf8")), `${f} must not mention the second binder`);
});
test("no model, no network: bind-kin2.mjs imports only node builtins, the kinship organ and the extractor", () => {
  const src = fs.readFileSync(path.join(here, "bind-kin2.mjs"), "utf8"), specs = [...src.matchAll(/(?:from|import\()\s*["']([^"']+)["']/g)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set(specs)], ["../../native/organs/kinship.js", "./extract-kin.mjs", "node:crypto", "node:fs", "node:path", "node:url"]);
  assert.ok(!/fetch\(|XMLHttpRequest|https?:\/\/|child_process|WebSocket/.test(src.replace(/\/\/.*$/gm, "")));
});
test("params: the first binder's declared parameters plus MAX_DASH_MOD", () => { assert.deepEqual(Object.keys(PARAMS).sort(), ["MAX_APPOS_MOD", "MAX_DASH_MOD", "MAX_DET_GAP", "MAX_MOD", "VOCATIVE_MAX_MODS"]); assert.ok(Object.isFrozen(PARAMS)); });
