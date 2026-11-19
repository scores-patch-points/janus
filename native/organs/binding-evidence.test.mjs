import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { bindingsOf, bindingEntries, writeBindings, parseFeats, depBase, KIND, CELL } from "./binding-evidence.mjs";
import { openDoor } from "./pharos-door.mjs";
const FIX = JSON.parse(fs.readFileSync(new URL("./binding-evidence.fixture.json", import.meta.url), "utf8")), rows = FIX.rows;   // REAL reader output, frozen
const beings = [{ being: "Bell", at: 0, end: 4 }, { being: "Greene", at: 14, end: 20 }];
const R = bindingsOf(rows, beings), by = (form) => R.anaphors.find((x) => x.anaphor.form === form), cand = (x, k, v) => x.candidates.find((c) => (k === "anaphor" ? c.ref.anaphor?.form === v : c.ref[k] === v));
const FORBIDDEN = new Set(["score", "rank", "best", "chosen", "bound", "verdict", "winner", "likely", "probability", "confidence"]);
const choosy = (v) => { if (Array.isArray(v)) return v.some(choosy); if (v && typeof v === "object") return Object.entries(v).some(([k, x]) => FORBIDDEN.has(k) || choosy(x)); if (typeof v === "string") return ["same", "different", "bound", "best", "chosen"].includes(v.toLowerCase()); return false; };

test("features are split at '|' and the first '='; a label's base at the first ':'; exact keys only, no pattern matching", () => {
  const f = parseFeats("Case=Nom|Gender=Masc|Number=Sing|Person=3|PronType=Prs"); assert.equal(f.get("Gender"), "Masc"); assert.equal(f.get("PronType"), "Prs"); assert.equal(parseFeats("_").size, 0); assert.equal(parseFeats("").size, 0); assert.equal(parseFeats(undefined).size, 0);
  const n = parseFeats("XPolarity=Neg|Polarity=Neg2"); assert.equal(n.get("Polarity"), "Neg2"); assert.equal(n.get("XPolarity"), "Neg"); assert.equal(parseFeats("A=b=c").get("A"), "b=c", "split at the FIRST =");
  assert.equal(depBase("nsubj:pass"), "nsubj"); assert.equal(depBase("obl"), "obl"); assert.equal(depBase(undefined), "");
});

test("on the real rows: the anaphors are the personal pronouns and the definite descriptions, in text order, and nothing inside a known being's span", () => {
  assert.deepEqual(R.anaphors.map((x) => [x.anaphor.form, x.anaphor.kind]), [["He", "pronoun"], ["title", "definite-description"], ["himself", "pronoun"], ["champion", "definite-description"], ["they", "pronoun"], ["him", "pronoun"]]);
  assert.deepEqual([R.counts.anaphors, R.counts.pronouns, R.counts.definite], [6, 4, 2]);
  const inside = bindingsOf(rows, [...beings, { being: "HeX", at: 30, end: 32 }]); assert.equal(inside.anaphors.some((x) => x.anaphor.form === "He"), false, "a token inside a being's mention is not an anaphor");
});

test("'He' lists every being in the window with the raw facts; the order is alphabetical, so it implies no preference (Greene is nearer but listed second)", () => {
  const he = by("He"); assert.deepEqual(he.candidates.map((c) => c.ref.being ?? "anaphor"), ["Bell", "Greene"]);
  const b = cand(he, "being", "Bell"), g = cand(he, "being", "Greene");
  assert.deepEqual([b.direction, b.sentences, b.chars, b.role], ["before", 1, 26, "nsubj"]); assert.deepEqual([g.sentences, g.chars, g.role], [1, 10, "obj"]); assert.ok(g.chars < b.chars, "Greene is nearer, and still not listed first");
  assert.deepEqual(b.agreement, { number: "match", gender: "unknown", person: "unknown" }, "a name has no gender in the reading: unknown, never a match"); assert.equal(b.clauseMate, null, "different sentences: no clause-mate fact");
  assert.equal(by("He").holes.some((h) => h.why === "gender_unknown_for_a_being"), true);
});

test("a reflexive lists the earlier pronoun of its own clause as a candidate with clauseMate true; the chain is evidence, not a decision", () => {
  const h = by("himself"); assert.equal(h.anaphor.reflexive, true); const he = cand(h, "anaphor", "He"); assert.ok(he); assert.deepEqual([he.direction, he.clauseMate, he.agreement.number, he.agreement.gender], ["before", true, "match", "match"]);
  assert.equal(cand(h, "being", "Bell").clauseMate, null); assert.equal(h.candidates.some((c) => c.ref.anaphor?.form === "title"), true, "a definite description is a candidate too: ruling it out is not janus's");
});

test("agreement is compared, not assumed: 'they' (plural) mismatches the singular beings; 'him' and 'they' are clause-mates, 'him' and 'champion' are not", () => {
  const they = by("they"); assert.equal(cand(they, "being", "Bell").agreement.number, "mismatch"); assert.equal(cand(they, "anaphor", "himself").agreement.number, "mismatch");
  const him = by("him"); assert.equal(cand(him, "anaphor", "they").clauseMate, true); assert.equal(cand(him, "anaphor", "champion").clauseMate, false, "champion is governed by 'retired', him by 'thanked'"); assert.equal(cand(him, "anaphor", "they").agreement.number, "mismatch");
});

test("a definite description gets the same candidates and an explicit hole: its kind is not known here", () => {
  const c = by("champion"); assert.equal(c.anaphor.kind, "definite-description"); assert.equal(c.holes.some((h) => h.why === "kind_unknown"), true); assert.ok(cand(c, "being", "Bell"));
});

test("the window is a declared number of sentences back; outside it a candidate is absent and the anaphor says so", () => {
  const w0 = bindingsOf(rows, beings, { window: 0 }), he0 = w0.anaphors.find((x) => x.anaphor.form === "He"); assert.equal(he0.candidates.length, 0); assert.equal(he0.holes.some((h) => h.why === "no_candidate_in_window" && h.window === 0), true);
  const w1 = bindingsOf(rows, beings, { window: 1 }), they = w1.anaphors.find((x) => x.anaphor.form === "they"); assert.equal(cand(they, "being", "Bell"), undefined, "two sentences back is outside window 1"); assert.ok(cand(they, "anaphor", "himself"));
  assert.throws(() => bindingsOf(rows, beings, { window: -1 }), /window/); assert.throws(() => bindingsOf({}, beings), /rows/);
});

test("a later mention in the same sentence is a candidate marked 'after' (a cataphor), with its clause-mate fact; a mention the rows cannot place is a hole, not dropped silently", () => {
  const syn = [{ s: 0, id: 1, form: "He", lemma: "he", upos: "PRON", feats: "Gender=Masc|Number=Sing|Person=3|PronType=Prs", head: 2, deprel: "nsubj", at: 0, end: 2 }, { s: 0, id: 2, form: "said", lemma: "say", upos: "VERB", feats: "_", head: 0, deprel: "root", at: 3, end: 7 }, { s: 0, id: 3, form: "Bell", lemma: "Bell", upos: "PROPN", feats: "Number=Sing", head: 2, deprel: "obj", at: 8, end: 12 }];
  const r = bindingsOf(syn, [{ being: "Bell", at: 8, end: 12 }, { being: "Ghost", at: 99, end: 104 }]); const c = r.anaphors[0].candidates[0]; assert.deepEqual([c.ref.being, c.direction, c.clauseMate, c.chars], ["Bell", "after", true, 6]);
  assert.deepEqual(r.holes, [{ why: "mention_not_in_rows", being: "Ghost", at: 99, end: 104 }]);
});

test("nothing is chosen: no score, rank, best or verdict word anywhere in what janus leaves, and the result does not depend on the order the beings are given", () => {
  assert.equal(choosy(R), false); const rev = bindingsOf(rows, [...beings].reverse()); assert.equal(JSON.stringify(rev), JSON.stringify(R));
  assert.ok(Object.isFrozen(R) && Object.isFrozen(R.anaphors));
});

test("entries: CON at Figure (candidate bonds), one per anaphor, all its candidates in it, an address derived from the text and the span, no verdict", () => {
  assert.throws(() => bindingEntries(R, {}), /doc/); const es = bindingEntries(R, { doc: "text:abc" }), again = bindingEntries(R, { doc: "text:abc" }), other = bindingEntries(R, { doc: "text:zzz" });
  assert.equal(es.length, 6); assert.ok(es.every((e) => e.cell === CELL && e.kind === KIND && e.addr.startsWith("binding:"))); assert.deepEqual(es.map((e) => e.addr), again.map((e) => e.addr)); assert.notEqual(es[0].addr, other[0].addr);
  assert.equal(choosy(es.map((e) => e.body)), false); assert.equal(CELL, "CON·Figure");
});

// ---- the log: a real pharos log through janus's own door
const real = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..", "pharos.json"), have = fs.existsSync(real), skip = have ? false : "no pharos pointer on this machine";
const withDoor = async (f) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "janus-bind-")), base = JSON.parse(fs.readFileSync(real, "utf8")), at = (r) => path.resolve(path.dirname(real), r); const ptr = { ...base, lib: at(base.lib), ...(base.sig ? { sig: { ...base.sig, lib: at(base.sig.lib) } } : {}), ...(base.cells ? { cells: { ...base.cells, lib: at(base.cells.lib) } } : {}) }; const p = path.join(dir, "pharos.json"); fs.writeFileSync(p, JSON.stringify(ptr)); try { return await f(await openDoor({ pointer: p, log: "binding", dir })); } finally { fs.rmSync(dir, { recursive: true, force: true }); } };
test("through the door: every anaphor lands as a binding entry, citing the reading it came from; writing again does not fail; a door that is off says why", { skip }, async () => {
  await withDoor((door) => {
    door.declare("reading", "INS·Figure", "a fixture standing for the reading the rows came from"); const rd = door.weave({ cell: "INS·Figure", kind: "reading", addr: "reading:fixture", body: { rows: rows.length } }); assert.ok(rd);
    const r = writeBindings(door, R, { doc: "text:fixture", of: [rd.id] }); assert.equal(r.refused, 0, r.why); assert.equal(r.written, 6);
    const got = door.ask(["binding"]); assert.equal(got.length, 6); assert.ok(got.every((e) => e.cell === "CON·Figure" && e.of.length === 1 && e.of[0] === rd.id)); assert.equal(choosy(got.map((e) => e.body)), false);
    assert.equal(got.find((e) => e.body.anaphor.form === "He").body.candidates.length, 2); assert.equal(writeBindings(door, R, { doc: "text:fixture", of: [rd.id] }).refused, 0);
  });
  const off = writeBindings({ on: false, why: "no pointer" }, R, { doc: "text:fixture" }); assert.deepEqual([off.written, off.refused, off.why], [0, 6, "no pointer"]);
});

test("a being is listed once, by its NEAREST mention before the anaphor; a mention in a LATER sentence is never a candidate", () => {
  const two = bindingsOf(rows, [{ being: "Bell", at: 0, end: 4 }, { being: "Bell", at: 14, end: 20 }]), he = two.anaphors.find((x) => x.anaphor.form === "He"); assert.equal(he.candidates.length, 1);
  assert.deepEqual([he.candidates[0].chars, he.candidates[0].role], [10, "obj"], "the nearer of the two Bell mentions");
  const syn = [{ s: 0, id: 1, form: "He", lemma: "he", upos: "PRON", feats: "Gender=Masc|Number=Sing|Person=3|PronType=Prs", head: 2, deprel: "nsubj", at: 0, end: 2 }, { s: 0, id: 2, form: "left", lemma: "leave", upos: "VERB", feats: "_", head: 0, deprel: "root", at: 3, end: 7 }, { s: 1, id: 1, form: "Bell", lemma: "Bell", upos: "PROPN", feats: "Number=Sing", head: 2, deprel: "nsubj", at: 9, end: 13 }, { s: 1, id: 2, form: "stayed", lemma: "stay", upos: "VERB", feats: "_", head: 0, deprel: "root", at: 14, end: 20 }];
  const r = bindingsOf(syn, [{ being: "Bell", at: 9, end: 13 }]); assert.equal(r.anaphors[0].candidates.length, 0, "Bell is in the NEXT sentence: not a candidate"); assert.equal(r.anaphors[0].holes.some((h) => h.why === "no_candidate_in_window"), true);
});

test("the caller declares which anaphor kinds to LIST; the candidates of a listed anaphor are unchanged by what else is listed", () => {
  const p = bindingsOf(rows, beings, { kinds: ["pronoun"] }); assert.deepEqual(p.anaphors.map((x) => x.anaphor.form), ["He", "himself", "they", "him"]); assert.deepEqual([p.counts.pronouns, p.counts.definite], [4, 0]);
  const d = bindingsOf(rows, beings, { kinds: ["definite-description"] }); assert.deepEqual(d.anaphors.map((x) => x.anaphor.form), ["title", "champion"]);
  const he = (r) => r.anaphors.find((x) => x.anaphor.form === "He").candidates.map((c) => JSON.stringify(c)); assert.deepEqual(he(p), he(R), "He lists the same beings whether or not the descriptions are listed");
  const own = (r) => r.anaphors.find((x) => x.anaphor.form === "him").candidates.length; assert.ok(own(p) < own(R), "an earlier anaphor that is not listed is not a candidate: a candidate must itself be a listed anaphor or a being");
  assert.throws(() => bindingsOf(rows, beings, { kinds: ["verb"] }), /kinds/); assert.throws(() => bindingsOf(rows, beings, { kinds: "pronoun" }), /kinds/);
});
