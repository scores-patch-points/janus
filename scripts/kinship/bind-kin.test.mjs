// bind-kin.test.mjs — the kin binder's own tests (node --test scripts/kinship/bind-kin.test.mjs). Synthetic Russian sentences with a hand-made ledger (one referent per name string);
// the real-text measurement is score-kin-binder.mjs, registered in PREREG-KIN-BINDER.md. No model, no network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { extract } from "./extract-kin.mjs";
import { bindKin, loadPriors, REASONS, PARAMS } from "./bind-kin.mjs";
import { score } from "./score-kin-binder.mjs";
import * as K from "../../native/organs/kinship.js";

const here = path.dirname(fileURLToPath(import.meta.url)), repo = path.join(here, "..", "..");
const priors = loadPriors();
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(path.join(repo, f))).digest("hex");

/** a ledger for `text`: every occurrence of each name string is a name span of its own referent (standing `referent`) */
function ledgerFor(text, names) {
  const spans = [], referents = [];
  names.forEach((nm, k) => {
    const ref = `ref_${k}_${nm.replace(/\s+/g, "_")}`; referents.push({ id: ref, face: nm, standing: "referent", forms: [nm.toLowerCase()], mentions: 1 });
    let at = -1; while ((at = text.indexOf(nm, at + 1)) >= 0) spans.push({ id: `spn_${ref}_${at}`, kind: "name", text: nm, at: [at, at + nm.length], bytes: [Buffer.byteLength(text.slice(0, at)), Buffer.byteLength(text.slice(0, at + nm.length))], ref });
  });
  return { schema: "KinLedger@1", text_sha256: "test", referents, spans: spans.sort((a, b) => a.at[0] - b.at[0]), sentences: [] };
}
const run = (text, names, tier = 2) => { const ledger = ledgerFor(text, names), extraction = extract({ text, lang: "ru", lexicon: priors.lexicon, namePartsRu: priors.nameParts }); return { ledger, extraction, res: bindKin({ text, ledger, extraction, priors, tier }) }; };
const ref = (nm) => `ref_${nm.replace(/\s+/g, "_")}`;
const refOf = (names, nm) => `ref_${names.indexOf(nm)}_${nm.replace(/\s+/g, "_")}`;

test("P-GEN and H-APP2: «дочь князя Василия, красавица Элен» ties both ends", () => {
  const names = ["Василия", "Элен"], text = "Приехала дочь князя Василия, красавица Элен, и села.";
  const { res } = run(text, names); const s = res.statements[0];
  assert.equal(s.possessor.ref, refOf(names, "Василия")); assert.equal(s.possessor.rule, "P-GEN");
  assert.equal(s.holder.ref, refOf(names, "Элен")); assert.equal(s.holder.rule, "H-APP2");
  assert.equal(s.fact.giver, "text:ru|rule:H-APP2+P-GEN");
  const parent = res.specs.find((x) => x.rel === "parent_of"); assert.equal(parent.a, refOf(names, "Василия")); assert.equal(parent.b, refOf(names, "Элен")); assert.equal(parent.standing, "candidate");
  assert.ok(res.specs.some((x) => x.rel === "sex" && x.value === "female" && x.a === refOf(names, "Элен")));
  const [a, b] = s.fact.witness.split("#")[1].split("-").map(Number); assert.ok(Buffer.from(text).subarray(a, b).toString().includes("дочь"));
});

test("H-APP-LEFT: «Ипполит, сын князя Василия» (the plain extractor's category A, tied the same way)", () => {
  const names = ["Ипполит", "Василия"], { res, extraction } = run("Приехал Ипполит, сын князя Василия.", names);
  assert.equal(extraction.stmts[0].cat, "A"); const s = res.statements[0];
  assert.equal(s.holder.rule, "H-APP-LEFT"); assert.equal(s.possessor.rule, "P-GEN"); assert.equal(s.holder.ref, refOf(names, "Ипполит"));
});

test("H-APP-DET: a possessive before the kin word makes the name after it the holder («вашего блудного сына Анатоля»)", () => {
  const names = ["Анатоля", "Анна Михайловна"], text = "— Вы думали о том, чтобы женить вашего блудного сына Анатоля, — сказал он. — Chère Анна Михайловна, — сказал он.";
  const { res } = run(text, names); const s = res.statements[0];
  assert.equal(s.holder.rule, "H-APP-DET"); assert.equal(s.holder.ref, refOf(names, "Анатоля"));
  assert.equal(s.possessor.rule, "P-VOC"); assert.equal(s.possessor.ref, refOf(names, "Анна Михайловна"));
});

test("P-VOC: second person names the vocative of the turn; no vocative is a typed gap", () => {
  const names = ["Анна Михайловна"], withV = "— Chère Анна Михайловна, — сказал он, — сын ваш будет переведен.", without = "— Ваш сын будет переведен, — сказал он.";
  assert.equal(run(withV, names).res.statements[0].possessor.rule, "P-VOC");
  const g = run(without, names).res.statements[0]; assert.equal(g.possessor.gap, "addressee_not_named"); assert.ok(g.holder.gap);
});

test("P-VOC refuses an apposition as a vocative (two words besides the name)", () => {
  const names = ["Болконская"], text = "— Вы думали о моем сыне, — сказала она, — une princesse Болконская, ваш сын.";
  const s = run(text, names).res.statements.at(-1); assert.notEqual(s.possessor.rule, "P-VOC");
});

test("P-SPEAKER: first person names the subject of the attribution; a pronoun speaker is a gap", () => {
  const names = ["Пьер"];
  assert.equal(run("— Я люблю моего сына, — сказал Пьер.", names).res.statements[0].possessor.rule, "P-SPEAKER");
  const g = run("— Я люблю моего сына, — сказал он.", names).res.statements[0]; assert.equal(g.possessor.gap, "speaker_not_named");
});

test("P-PRON3 (tier 2): the one compatible being of the nearest sentence; two beings is a gap; tier 1 does not search", () => {
  const one = ["Андрей"], text = "Князь Андрей вошел в гостиную. Лицо его жены было скучно.";
  assert.equal(run(text, one).res.statements[0].possessor.rule, "P-PRON3");
  assert.equal(run(text, one, 1).res.statements[0].possessor.gap, "antecedent_not_searched");
  const two = ["Андрей", "Пьер"]; assert.equal(run("Андрей и Пьер вошли в гостиную. Лицо его жены было скучно.", two).res.statements[0].possessor.gap, "antecedent_ambiguous");
});

test("P-PRON3 excludes a being whose patronymic gives the other gender", () => {
  const names = ["Василий", "Анна Павловна", "Элен"], text = "Князь Василий и Анна Павловна пришли. Потом дочь его, княжна Элен, пошла.";
  const { res } = run(text, names); const s = res.statements[0];
  assert.equal(s.holder.rule, "H-APP-DET"); assert.equal(s.holder.ref, refOf(names, "Элен")); assert.equal(s.possessor.ref, refOf(names, "Василий")); assert.equal(s.possessor.rule, "P-PRON3");
});

test("P-SUBJ (tier 2): a bare kin word takes the nearest being before it in the sentence; never across a sentence break; tier 1 leaves a gap", () => {
  const names = ["Василий"], text = "Князь Василий желал определить сына на это место.";
  assert.equal(run(text, names).res.statements[0].possessor.rule, "P-SUBJ"); assert.equal(run(text, names, 1).res.statements[0].possessor.gap, "no_marker");
  assert.equal(run("Князь Василий пришел. Желали определить сына на это место.", names).res.statements[0].possessor.gap, "no_marker");
});

test("H-PRED (tier 2): «Он сын ...» takes the pronoun's referent as the holder", () => {
  const names = ["Пьер", "Безухова"], { res } = run("Пьер вошел в гостиную. Он сын графа Безухова.", names), s = res.statements[0];
  assert.equal(s.holder.rule, "H-PRED"); assert.equal(s.holder.ref, refOf(names, "Пьер")); assert.equal(s.possessor.rule, "P-GEN");
});

test("an oblique kin word followed by one name, with nothing to tell apposition from a genitive, is a typed gap for both ends", () => {
  const names = ["Василью", "Пьером"], s = run("Пьером, который приходился родня по отцу князю Василью.", names).res.statements[0];
  assert.equal(s.holder.gap, "genitive_or_apposition"); assert.equal(s.possessor.gap, "genitive_or_apposition");
});

test("every unbound end is a gap of a closed kind and reason, the slot names the relation, and the unchanged opinion seam takes an opinion for it", () => {
  const names = ["Анна Михайловна"], { res } = run("— Chère Анна Михайловна, — сказал он, — сын ваш будет переведен.", names), s = res.statements[0];
  assert.equal(s.gaps.length, 1); const g = s.gaps[0];
  assert.ok(Object.hasOwn(K.GAP_KINDS, g.kind)); assert.ok(REASONS.includes(g.why)); assert.equal(g.kind, "no_parent_fact"); assert.equal(g.slot.rel, "parent_of"); assert.equal(g.slot.a, refOf(names, "Анна Михайловна")); assert.equal(g.slot.b, "?");
  assert.ok(g.opinionSlot && g.opinionSlot.schema === K.OPINION_SLOT_SCHEMA);
  const before = JSON.stringify(res), hex = "a".repeat(64);
  const filed = K.fileOpinion(g.opinionSlot, { holder: "self:model:test-model", lens: hex, outputSha256: hex, value: { rel: "parent_of", a: refOf(names, "Анна Михайловна"), b: "ref_son" } });
  assert.ok(filed.opinion && filed.opinion.standing === "opinion"); assert.equal(JSON.stringify(res), before);                       // an opinion changes nothing in the binder's output
  assert.deepEqual(K.makeFact({ rel: "parent_of", a: "x", b: "y", giver: "self:model:test-model", witness: "ru#1-2" }).refused, "opinion_is_not_a_fact");
});

test("a stated composite (grandfather) with an unbound end is a gap with no opinion slot, and says why", () => {
  const { res } = run("Он любил своего деда.", ["Пьер"]);
  const g = res.statements.find((s) => s.term === "grandfather")?.gaps[0]; if (g) { assert.equal(g.kind, "no_rule_giver"); assert.ok(g.opinionSlotAbsent); }
});

test("emitted facts enter the fact base without refusal and carry the rule in the giver; a derivation over them is a candidate", () => {
  const names = ["Василия", "Элен", "Ипполит"], text = "Приехала дочь князя Василия, красавица Элен. Приехал Ипполит, сын князя Василия.";
  const { res } = run(text, names); const base = K.factBase(res.specs);
  assert.equal(base.refused.length, 0); assert.ok(base.facts.every((f) => f.standing === "candidate" && f.giver.startsWith("text:ru|rule:")));
  const rules = K.rulesFromLexicon(priors.lexicon), a = K.deriveKin({ term: "uncle", of: refOf(names, "Элен") }, { base, rules });
  assert.ok(a.state === "gap" || a.state === "answered"); assert.equal(a.evidence.opinion, 0);
});

test("determinism: two runs are byte-identical", () => {
  const names = ["Василия", "Элен"], text = "Приехала дочь князя Василия, красавица Элен, и села. — Сын ваш, — сказал он.";
  assert.equal(JSON.stringify(run(text, names).res), JSON.stringify(run(text, names).res));
});

test("the default behaviour is byte-identical: the plain extractor, the lexicon builder, the measurement script and the kinship organ are the files of main (9fe6d918)", () => {
  assert.equal(sha("scripts/kinship/extract-kin.mjs"), "a4f776bbadd6381f8ed1890804cac77c8b23b96e7a6d4eea222ac20514d766e4");
  assert.equal(sha("scripts/kinship/kin-lexicon.mjs"), "e623033954687eb60438aeece5ed2977f3112a82fdb507d1d728dc4ef8538e42");
  assert.equal(sha("scripts/kinship/measure-kin.mjs"), "02441a4d650397ec6afa2f33544afecca7207652b8e31e9a6c5caf9fa2fd29ac");
  assert.equal(sha("native/organs/kinship.js"), "6f4b5131d9d267fb537b0104062f0acdb17f5bb9026b148c2894fce7156eb4ba");
  assert.equal(sha("priors/kin-lexicon.json"), "693f23772d76fb5d582b76db7d5b40d88803eaa91cb47cf05a54b958a59a1737");
  for (const f of ["scripts/kinship/extract-kin.mjs", "scripts/kinship/measure-kin.mjs", "native/organs/kinship.js"]) assert.ok(!/bind-kin/.test(fs.readFileSync(path.join(repo, f), "utf8")), `${f} must not mention the binder`);
});

test("no model, no network: the binder imports only node builtins, the kinship organ and the plain extractor", () => {
  const src = fs.readFileSync(path.join(here, "bind-kin.mjs"), "utf8"), specs = [...src.matchAll(/(?:from|import\()\s*["']([^"']+)["']/g)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set(specs)], ["../../native/organs/kinship.js", "./extract-kin.mjs", "node:crypto", "node:fs", "node:path", "node:url"]);
  assert.ok(!/fetch\(|XMLHttpRequest|https?:\/\/|child_process|WebSocket/.test(src.replace(/\/\/.*$/gm, "")));
});

test("the scorer: arithmetic on a three-statement window, the swapped-ends mutant falls to zero, and the plain arm ties only category A", () => {
  const names = ["Василия", "Элен", "Ипполит"], text = "Приехала дочь князя Василия, красавица Элен. Приехал Ипполит, сын князя Василия.\n\nКнязя Василия беспокоил сын.\n";
  const ledger = ledgerFor(text, names), extraction = extract({ text, lang: "ru", lexicon: priors.lexicon, namePartsRu: priors.nameParts });
  const R = (n) => refOf(names, n), e = (ref, kind) => ({ ref, display: ref, kind, quote: "q", quoteAt: [[0, 1]] });
  const gold = { window: "test", holder: "self:model:test", lens: "x", opinion: true, statements: extraction.stmts.map((s, i) => ({ i, term: s.en, termSpan: s.span, holder: i === 0 ? e(R("Элен"), "apposition") : i === 1 ? e(R("Ипполит"), "apposition") : { ref: null, why: "unnamed" }, possessor: e(R("Василия"), i === 2 ? "subject" : "genitive") })) };
  const r = score({ text, ledger, gold, priors });
  assert.equal(r.statements.total, 3); assert.equal(r.arms.t2.all.correct, 5); assert.equal(r.arms.t2.all.wrong, 0); assert.equal(r.arms.plain.all.bound, 2);   // plain: only the category-A statement (Ипполит, сын князя Василия) is tied: two ends
  assert.equal(r.controls.C3_swapped_ends.correct, 0); assert.ok(r.determinism === undefined);
});

test("params are the declared plain-arm parameters and nothing else", () => { assert.deepEqual(Object.keys(PARAMS).sort(), ["MAX_APPOS_MOD", "MAX_DET_GAP", "MAX_MOD", "VOCATIVE_MAX_MODS"]); assert.ok(Object.isFrozen(PARAMS)); });
