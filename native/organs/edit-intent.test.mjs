// edit-intent: "trim this clip" / "make the pacing better" read as STRUCTURE through the real codec (nl-eot read) and the real act prior; the material supplies what the sentence leaves open.
// THEORY, NOT AN EDITOR: nothing here edits a timeline; the word timings below are SYNTHETIC (declared, not from any recording). Needs the English grammar priors and $ACT_PRIOR (Zenodotus derived-priors/act-priors/act-prior-en.json).
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import { loadGrammar, read, PRIORS } from "./nl-eot.mjs"; import { intentOf, EDIT_CLASSES, PRIMITIVE_PARAMS } from "./edit-intent.mjs"; import { gapsOf, trimProposal, pacingProposals } from "./edit-propose.mjs";
const ACT = process.env.ACT_PRIOR ?? "/home/user/Zenodotus/derived-priors/act-priors/act-prior-en.json";
const haveEng = fs.readdirSync(PRIORS).some((f) => f.startsWith("ud-parser-eng-")) && fs.existsSync(`${PRIORS}/ud-grammar-eng.json.gz`);
const skip = !haveEng ? "no English grammar priors on disk" : !fs.existsSync(ACT) ? `no act prior at ${ACT} (set ACT_PRIOR)` : false;
const act = skip ? null : JSON.parse(fs.readFileSync(ACT, "utf8")).forms, G = skip ? null : loadGrammar("eng");
const say = (s, o = {}) => intentOf(read(G, s).records[0], { act, ...o });

test("'Trim this clip.': the root is trim, the theme is clip pointed at by 'this' and bound to the selection, the primitive is remove_span (the one of trim's VerbNet classes an editor can do), and the span is the named gap the sentence leaves open", { skip }, () => {
  const i = say("Trim this clip.", { selection: "clip-7" });
  assert.deepEqual([i.verb, i.theme.lemma, i.theme.deixis, i.theme.bound, i.primitives, i.status, i.params_missing], ["trim", "clip", "this", "clip-7", ["remove_span"], "needs_params", ["span"]]);
  assert.equal(i.acts.standing, "contested", "the prior's own ambiguity is kept, not collapsed"); assert.ok(i.alternatives.every((a) => EDIT_CLASSES[a.class]));
  assert.equal(say("Trim this clip.", { selection: "clip-7", params: { span: [0, 1] } }).status, "ready", "with the span supplied it is ready");
});

test("FALSE IF deixis is a string match: 'the clip' (definite, not deictic) does not take the selection, 'this clip' does, and with no selection 'this clip' is the gap no_selection", { skip }, () => {
  const d = say("Trim the clip.", { selection: "c" }); assert.deepEqual([d.theme.deixis, d.theme.bound, d.theme.definite], [null, null, true]);
  assert.equal(say("Delete this clip.", { selection: "c" }).theme.bound, "c"); assert.ok(say("Trim this clip.").gaps.some((g) => g.gap === "no_selection"));
});

test("FINDING (the reader, not this layer; kept): 'that' in 'that clip' is tagged SCONJ with no PronType, so its deixis is LOST ('Remove that clip.' reads, the theme is clip, but nothing binds it to the selection); this layer must not bind what the EOT does not mark", { skip }, () => {
  const r = say("Remove that clip.", { selection: "c" }); assert.deepEqual([r.verb, r.theme.lemma, r.theme.deixis, r.theme.bound], ["remove", "clip", null, null]);
});

test("FINDING (the reader; kept): capitalised sentence-initial imperatives are often not read as verbs: 'Trim that clip.' (Trim=PROPN, clip=VERB) and 'Tighten this clip.' (Tighten=PROPN) give the typed gap no_predicate and no intent; the same words lower-cased or after 'Please' read. Measured on 14 phrasings of mine, exploratory, ONE parser (the shipped English UD parser prior): 10 of 14 have a root verb. Falsifier: a reader that tags the imperative verb gives 14 of 14", { skip }, () => {
  const V = ["Trim that clip.", "trim that clip", "Please trim that clip.", "Tighten this clip.", "Please tighten this clip.", "Shorten this clip.", "Cut this clip.", "Delete this clip.", "Remove that clip.", "Split this clip.", "Speed up this clip.", "Slow this clip down.", "Trim this clip.", "Trim the start of this clip."];
  const readable = V.filter((x) => say(x, { selection: "c" }).verb !== null); assert.equal(readable.length, 10, `readable: ${readable.join(" | ")}`);
  for (const x of ["Trim that clip.", "Tighten this clip.", "Speed up this clip.", "Slow this clip down."]) assert.deepEqual(say(x, { selection: "c" }).gaps.map((g) => g.gap), ["no_predicate"], x);
});

test("'Make the pacing better.': a RESULTATIVE (xcomp ADJ, comparative of 'good'); no criterion says what better pacing is, so it is the gap no_criterion and NOT an edit; a declared criterion turns the gap into a ready intent", { skip }, () => {
  const i = say("Make the pacing better."); assert.deepEqual([i.verb, i.theme.lemma, i.result.lemma, i.result.degree, i.primitives, i.status], ["make", "pacing", "good", "Cmp", ["change_state_to"], "gap"]); assert.ok(i.gaps.some((g) => g.gap === "no_criterion"));
  const k = say("Make the pacing better.", { criteria: { "pacing|good": { measure: "outlier_gaps", direction: "fewer" } } }); assert.equal(k.status, "ready"); assert.equal(k.result.criterion.measure, "outlier_gaps");
});

test("'Remove the silence at the start.': the prior is UNANIMOUS (remove is SEG in every class), the anchor 'at the start' is carried as an oblique, and the span is still open; 'Cut the pause...' is AMBIGUOUS between primitives and is reported as such, not chosen", { skip }, () => {
  const r = say("Remove the silence at the start."); assert.deepEqual([r.acts.standing, r.primitives, r.status, r.oblique.map((o) => o.lemma)], ["unanimous", ["remove_span"], "needs_params", ["start"]]);
  const c = say("Cut the pause after the second sentence."); assert.equal(c.status, "ambiguous"); assert.ok(c.primitives.includes("remove_span") && c.primitives.includes("split"));
});

test("FINDING (a failure, kept): 'Tighten this up.' is not read: the English parser attaches 'tighten' as a compound of 'up' and there is no root verb, so the layer says no_predicate rather than guess; its VerbNet entry (tighten: unanimous change_state) is never reached", { skip }, () => {
  const i = say("Tighten this up."); assert.deepEqual([i.status, i.gaps.map((g) => g.gap)], ["gap", ["no_predicate"]]);
  assert.equal(act.tighten.standing, "unanimous"); assert.equal(say("Please tighten this clip.", { selection: "c" }).status, "needs_params", "with 'Please' the same verb reads");
});

test("typed gaps, never a default: no act prior, a verb not in VerbNet, and a verb none of whose classes an editor can do", { skip }, () => {
  assert.ok(intentOf(read(G, "Trim this clip.").records[0], { act: null }).gaps.some((g) => g.gap === "no_act_prior"));
  assert.ok(say("Zork this clip.", { selection: "c" }).gaps.length > 0); const f = say("Fill the clip.", { selection: "c" }); if (f.acts) assert.ok(["gap", "needs_params", "ambiguous"].includes(f.status));
  assert.ok(Object.keys(PRIMITIVE_PARAMS).every((p) => Array.isArray(PRIMITIVE_PARAMS[p])));
});

// ---- the material supplies what the sentence does not. SYNTHETIC word timings (seconds).
const talk = (t0, n, w = 0.3, g = 0.2) => Array.from({ length: n }, (_, i) => ({ start: +(t0 + i * (w + g)).toFixed(3), end: +(t0 + i * (w + g) + w).toFixed(3) }));
test("trim: a clip of 10 s whose speech runs 1.2..8.7 s loses its silent head and tail, each kept back by the clip's OWN median gap (0.2 s); a clip that already starts and ends on speech loses nothing; a clip with no speech gets no proposal", () => {
  const words = talk(1.2, 16), t = trimProposal({ start: 0, end: 10 }, words); assert.equal(t.pad, 0.2); assert.deepEqual(t.remove[0], { from: 0, to: 1 }); assert.ok(t.kept.to - words.at(-1).end - 0.2 < 1e-9 && t.remove.length === 2);
  assert.deepEqual(trimProposal({ start: 1.2, end: words.at(-1).end }, words).remove, []); assert.match(trimProposal({ start: 20, end: 30 }, words).why, /no_speech/);
});
test("pacing: 40 words with one 2.0 s hole -> exactly that gap is proposed (its saving is the hole minus the median gap), from the material's own Tukey fence; uniform pauses -> NO proposal (a recorded negative); too few gaps -> a typed refusal", () => {
  const a = talk(0, 20), b = talk(a.at(-1).end + 2.0, 20), p = pacingProposals([...a, ...b]); assert.equal(p.proposals.length, 1); assert.deepEqual([p.proposals[0].from, p.proposals[0].to, p.proposals[0].saves], [a.at(-1).end, b[0].start, 1.8]); assert.ok(p.fence < 2.0 && p.fence >= p.median);
  const u = pacingProposals(talk(0, 40)); assert.deepEqual([u.proposals.length, u.fence], [0, 0.2]); assert.match(u.why, /nothing to improve/); assert.match(pacingProposals(talk(0, 5)).why, /too_few_gaps/);
  assert.equal(gapsOf(talk(0, 3)).length, 2);
});
test("end to end in theory: 'Trim this clip.' + the clip's word timings -> a ready intent whose span is the material's proposal, never an edit; the proposal is returned for the person to accept (DEF)", { skip }, () => {
  const clip = { id: "clip-7", start: 0, end: 10 }, prop = trimProposal(clip, talk(1.2, 16)), i = say("Trim this clip.", { selection: clip.id, params: { span: prop.remove } });
  assert.equal(i.status, "ready"); assert.deepEqual(i.params_missing, []); assert.deepEqual(prop.remove[0], { from: 0, to: 1 });
});

test("FALSIFIED 2026-11-27 and FIXED: negation, questions, coordination, a constraint clause and a sequencing adverb were silently dropped and the sentence read as a plain request ('Never delete this clip.' -> delete). Now: a negator of the root verb (UD Polarity=Neg or PronType=Neg, the rule of khora's negation-read.js) makes a PROHIBITION with polarity '-'; questions, coordination, a second clause and an unread adverb are typed gaps; none is ready or needs_params", { skip }, () => {
  for (const s of ["Do not cut the pause.", "Never delete this clip."]) { const i = say(s, { selection: "c" }); assert.deepEqual([i.status, i.polarity, i.params_missing], ["prohibition", "-", []], s); assert.ok(i.negators.length === 1, s); }
  assert.equal(say("Never delete this clip.").negators[0], "never", "'never' is PronType=Neg: found by the same rule as 'not' (Polarity=Neg), not by a word list");
  for (const s of ["Should I trim this clip?", "Can you trim this clip?", "Why did you trim this clip?", "Trim this clip and the next one.", "Trim this clip, but keep the first sentence.", "Remove the silence at the start, then undo it.", "If it's not definitive, cut it."]) {
    const i = say(s, { selection: "c" }); assert.equal(i.status, "gap", s); assert.ok(i.gaps.some((g) => ["unconsumed_structure", "no_predicate"].includes(g.gap)), s); assert.notEqual(i.polarity === "-", true, `${s}: the negator is inside another clause, not on the root`);
  }
  assert.equal(say("Trim this clip.", { selection: "c" }).polarity, "+");
});
