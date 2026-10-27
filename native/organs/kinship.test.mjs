// kinship.test.mjs — the synthetic bars S1 to S7 of PREREG-G1-2 (+ Amendment 1) and unit tests of the opinion seam.
// Truth is by construction: seeded families, a brute force coded independently of the engine over the SAME stated facts, and three mutants
// of the engine's own source that must each be caught (a check never seen firing is a comment).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import * as K from './kinship.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const lex = JSON.parse(fs.readFileSync(path.join(HERE, '../../priors/kin-lexicon.json'), 'utf8'));
const sha = (s) => createHash('sha256').update(s).digest('hex');
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ------------------------------------------------------------------------------------------------ the generator (truth by construction)
function makeWorld(seed) {
  const rng = mulberry32(seed); let n = 0;
  const persons = new Map(), edges = [];
  const person = (gen) => { const p = `p${seed}_${n++}`; persons.set(p, { sex: rng() < 0.5 ? 'male' : 'female', gen }); return p; };
  let couples = []; for (let i = 0, f = 2 + Math.floor(rng() * 2); i < f; i++) couples.push([person(0), person(0)]);
  for (let g = 1; g <= 3; g++) {
    const kids = [];
    for (const [a, b] of couples) for (let k = 0, c = 2 + Math.floor(rng() * 3); k < c; k++) { const ch = person(g); edges.push([a, ch], [b, ch]); kids.push(ch); }
    couples = kids.filter(() => rng() < 0.6).map((k) => [k, person(g)]);
  }
  const par = new Map(), kids = new Map();
  for (const [p, c] of edges) { (par.get(c) ?? par.set(c, []).get(c)).push(p); (kids.get(p) ?? kids.set(p, []).get(p)).push(c); }
  const parentsOf = (x) => par.get(x) ?? [];
  const sibs = (x) => [...new Set(parentsOf(x).flatMap((p) => kids.get(p)))].filter((y) => y !== x);
  const trueUncles = (x) => [...new Set(parentsOf(x).flatMap((m) => sibs(m)).filter((u) => u !== x && persons.get(u).sex === 'male'))].sort();
  return { seed, rng, persons, edges, parentsOf, sibs, trueUncles };
}
function stated(world) {
  const { rng } = world, r = 0.4 + 0.6 * rng(), specs = []; let i = 0;
  for (const [p, c] of world.edges) if (rng() < r) specs.push({ rel: 'parent_of', a: p, b: c, giver: rng() < 0.5 ? 'text:syn' : 'name-parts-ru', witness: `syn#${i}-${i++ + 5}`, standing: 'given' });
  for (const [p, v] of world.persons) if (rng() < r) specs.push({ rel: 'sex', a: p, value: v.sex, giver: 'text:syn', witness: `syn#${i}-${i++ + 5}`, standing: 'given' });
  return specs;
}
// the brute force: no shared helper with the engine; ordered pairs over the stated specs
function brute(world, specs, X) {
  const pars = new Map(); for (const s of specs) if (s.rel === 'parent_of') (pars.get(s.b) ?? pars.set(s.b, new Set()).get(s.b)).add(s.a);
  const sex = new Map(specs.filter((s) => s.rel === 'sex').map((s) => [s.a, s.value]));
  const sib = (u, p) => u !== p && [...(pars.get(u) ?? [])].some((g) => (pars.get(p) ?? new Set()).has(g));
  return [...world.persons.keys()].filter((u) => u !== X && sex.get(u) === 'male' && [...(pars.get(X) ?? [])].some((p) => p !== u && sib(u, p))).sort();
}
const rules = K.rulesFromLexicon(lex);
const ask = (mod, base, X, opinions = []) => mod.deriveKin({ term: 'uncle', of: X }, { base, rules, opinions });

// ------------------------------------------------------------------------------------------------ the bars as functions (so a mutant can be run through them)
const N = 200;
function barS1(mod) {
  const bad = [];
  for (let seed = 1; seed <= N; seed++) {
    const w = makeWorld(seed), specs = stated(w), base = mod.factBase(specs);
    for (const X of w.persons.keys()) {
      const got = ask(mod, base, X).items.map((i) => i.who).sort(), want = brute(w, specs, X), truth = w.trueUncles(X);
      if (JSON.stringify(got) !== JSON.stringify(want) || got.some((u) => !truth.includes(u))) { bad.push(seed); break; }
    }
  }
  return bad;
}
function barS6(mod) {
  const bad = [];
  for (let seed = 1; seed <= 100; seed++) {
    const w = makeWorld(seed), specs = stated(w).filter((s) => s.rel !== 'parent_of');
    // the name-conflation case: X's grandparent is also X's child (one key for two beings)
    const x = [...w.persons.keys()].find((p) => w.persons.get(p).gen === 3 && w.parentsOf(p).length), m = w.parentsOf(x)[0], g = w.parentsOf(m)[0];
    let i = 0; for (const [a, b] of [[m, x], [g, m], [x, g]]) specs.push({ rel: 'parent_of', a, b, giver: 'text:syn', witness: `syn#${i}-${i++ + 5}` });
    const a = ask(mod, mod.factBase(specs), x);
    if (!(a.state === 'gap' && a.items.length === 0 && a.gaps.some((q) => q.kind === 'parent_cycle'))) bad.push(seed);
  }
  return bad;
}
const instanceOf = (slot, f) => slot.rel === f.rel && ['a', 'b', 'value'].every((k) => (slot[k] === '?' ? true : slot[k] === undefined ? (f[k] ?? null) === null : slot[k] === f[k]));
function barS3(mod) {
  const bad = [], invisible = { n: 0, of: 0 }; let visibleSeen = 0, silent = 0;
  for (let seed = 1; seed <= N; seed++) {
    const w = makeWorld(seed), specs = stated(w), base = mod.factBase(specs), key = (f) => JSON.stringify([f.rel, f.a, f.b ?? null, f.value ?? null]);
    const have = new Set(specs.map(key));
    for (const X of w.persons.keys()) {
      const a = ask(mod, base, X);
      if (a.state === 'gap' && a.gaps.length === 0) silent++;
      if (a.state !== 'gap' || !w.trueUncles(X).length) continue;
      const M = w.parentsOf(X).filter((m) => w.sibs(m).some((u) => w.persons.get(u).sex === 'male'));
      const statedParents = specs.filter((s) => s.rel === 'parent_of' && s.b === X).map((s) => s.a);
      invisible.of++;
      const visible = statedParents.length === 0 || M.some((m) => statedParents.includes(m));
      if (!visible) { invisible.n++; continue; }
      const D = [];
      for (const m of M) {
        D.push({ rel: 'parent_of', a: m, b: X });
        for (const u of w.sibs(m).filter((u) => w.persons.get(u).sex === 'male')) {
          D.push({ rel: 'sibling_of', a: u, b: m }, { rel: 'sex', a: u, value: 'male' });
          for (const gp of w.parentsOf(m).filter((p) => w.parentsOf(u).includes(p))) D.push({ rel: 'parent_of', a: gp, b: u }, { rel: 'parent_of', a: gp, b: m });
        }
      }
      visibleSeen++;
      if (!a.gaps.some((g) => D.some((d) => instanceOf(g.slot, d) && !have.has(key(d))))) bad.push(`${seed}:${X}`);
    }
  }
  return { bad, invisible, visibleSeen, silent };
}

// ------------------------------------------------------------------------------------------------ S1, S3, S6, S7 on the engine
test('S1 exact: the engine equals an independent brute force over the same stated facts, and is sound against the generator, in 200 of 200 families', () => {
  assert.deepEqual(barS1(K), []);
});
test('S3 typed gaps name the missing premise (visible cases 100 percent; invisible cases counted); no silent empty', () => {
  const r = barS3(K);
  assert.deepEqual(r.bad, []);
  assert.equal(r.silent, 0);
  assert.ok(r.visibleSeen > 0, 'the check never saw a visible gap case: it would be a comment');
  assert.ok(r.invisible.of > 0 && r.invisible.n >= 0);
  console.log(`# S3: visible gap cases ${r.visibleSeen}; unanswered-but-answerable ${r.invisible.of}, of them invisible (open-world floor) ${r.invisible.n}`);
});
test('S6 a parent_of cycle (a person his own grandparent: one key for two beings) is a parent_cycle gap, never an answer, in 100 of 100 cases', () => {
  assert.deepEqual(barS6(K), []);
});
test('S7 redeal: permuting the b end of the parent_of facts moves the answered pairs in at least 95 percent of the families that had an answer', () => {
  let had = 0, moved = 0;
  for (let seed = 1; seed <= N; seed++) {
    const w = makeWorld(seed), specs = stated(w), pairs = (sp) => { const b = K.factBase(sp); return [...w.persons.keys()].flatMap((X) => ask(K, b, X).items.map((i) => `${X}|${i.who}`)).sort().join(); };
    const real = pairs(specs); if (!real) continue; had++;
    const par = specs.filter((s) => s.rel === 'parent_of'), rest = specs.filter((s) => s.rel !== 'parent_of'), rng = mulberry32(seed + 9000);
    const bs = par.map((s) => s.b); for (let i = bs.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [bs[i], bs[j]] = [bs[j], bs[i]]; }
    const shuffled = par.map((s, i) => ({ ...s, b: bs[i] === s.a ? s.b : bs[i] }));
    if (pairs([...rest, ...shuffled]) !== real) moved++;
  }
  assert.ok(had >= 100, `only ${had} families had an answer`);
  assert.ok(moved / had >= 0.95, `shuffle moved ${moved} of ${had}`);
});

// ------------------------------------------------------------------------------------------------ S2: three mutants of the engine's own source, each must be caught
function mutant(name, from, to) {
  const src = fs.readFileSync(path.join(HERE, 'kinship.js'), 'utf8');
  assert.ok(src.includes(from), `mutant ${name} did not apply: the source no longer contains ${from}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kin-mutant-')), file = path.join(dir, `${name}.mjs`);
  fs.writeFileSync(file, src.replace(from, to));
  return import(pathToFileURL(file).href);
}
const MUTANTS = [
  ['no_sex_filter', 'if (atom.sex) {', 'if (false) {'],
  ['no_cycle_check', 'const cyc = ancestorCycle(ix, X);', 'const cyc = null;'],
  ['sibling_without_shared_parent', 'for (const p of ix.parents.get(y) ?? []) for (const c of ix.children.get(p) ?? []) {', 'for (const p of ix.children.keys()) for (const c of ix.children.get(p) ?? []) {'],
];
for (const [name, from, to] of MUTANTS) {
  test(`S2 mutant "${name}" is caught by S1, S3 or S6`, async () => {
    const M = await mutant(name, from, to);
    let caught = false;
    try { caught = barS1(M).length > 0 || barS6(M).length > 0 || barS3(M).bad.length > 0; } catch (e) { caught = true; }   // a mutant that crashes is seen
    assert.ok(caught, `mutant ${name} survived: the bars never saw it fire`);
  });
}

// ------------------------------------------------------------------------------------------------ S4: no giver, no step
test('S4 a fact with no giver or no witness is refused at the door (100 of 100), an opinion is not a fact, and no step of any derivation lacks a giver', () => {
  const rng = mulberry32(4), bad = [];
  for (let i = 0; i < 100; i++) {
    const spec = { rel: 'parent_of', a: 'a' + i, b: 'b' + i, giver: [undefined, '', '   ', null][i % 4], witness: 'syn#1-2' };
    if (i % 2) { spec.giver = 'text:syn'; spec.witness = [undefined, '', '  '][i % 3]; }
    bad.push(K.makeFact(spec).refused);
  }
  assert.ok(bad.every((r) => r === 'fact_without_giver' || r === 'fact_without_witness'), JSON.stringify(bad.filter((r) => !['fact_without_giver', 'fact_without_witness'].includes(r))));
  assert.equal(K.makeFact({ rel: 'parent_of', a: 'x', b: 'y', giver: 'self:model:gemma2', witness: 'syn#1-2' }).refused, 'opinion_is_not_a_fact');
  assert.equal(K.makeFact({ rel: 'parent_of', a: 'x', b: 'y', giver: 'text:syn', witness: 'the book says so' }).refused, 'witness_not_a_byte_span');
  for (let seed = 1; seed <= N; seed++) {
    const w = makeWorld(seed), base = K.factBase(stated(w));
    for (const X of w.persons.keys()) for (const it of ask(K, base, X).items) for (const d of it.derivations) for (const s of d.steps) assert.ok(s.giver && s.witness, JSON.stringify(s));
  }
  assert.ok(rng() >= 0);
});

// ------------------------------------------------------------------------------------------------ S5: the opinion seam
const HOLDER = 'self:model:test-model@sha1', LENS = sha('prompt v1');
function fileFor(slot, value, extra = {}) { return K.fileOpinion(slot, { holder: HOLDER, lens: LENS, outputSha256: sha('raw output ' + JSON.stringify(value)), modelId: 'test-model', temperature: 0, seed: 1, value, ...extra }); }
function trueFill(w, slot) {
  const A = slot.ask;
  if (A.rel === 'parent_of' && A.a === '?') return { rel: 'parent_of', a: w.parentsOf(A.b)[0], b: A.b };
  if (A.rel === 'sibling_of' && A.a === '?') { const s = w.sibs(A.b)[0]; return s ? { rel: 'sibling_of', a: s, b: A.b } : null; }
  if (A.rel === 'sex') return { rel: 'sex', a: A.a, value: w.persons.get(A.a).sex };
  return null;
}
test('S5 the opinion seam: opinions never change the mechanical part, always carry opinionDependent, add 0 independent evidence, supersede cleanly, and a false opinion cannot make a gap an answer', () => {
  let conditionalSeen = 0, filed = 0, refusedBad = 0, falseKeptGap = 0;
  for (let seed = 1; seed <= N; seed++) {
    const w = makeWorld(seed), base = K.factBase(stated(w)), rng = mulberry32(seed + 5000);
    const people = [...w.persons.keys()];
    let log = [];
    const k = Math.floor(rng() * 6);
    const asked = people.map((X) => ask(K, base, X)).filter((a) => a.state === 'gap').slice(0, 12);
    for (let j = 0; j < k && asked.length; j++) {
      const a = asked[Math.floor(rng() * asked.length)], g = a.gaps.find((x) => x.opinionSlot); if (!g) continue;
      let v = trueFill(w, g.opinionSlot); const wrong = rng() < 0.5;
      if (!v) continue;
      if (wrong) { const other = people[Math.floor(rng() * people.length)]; if (v.rel === 'sex') v = { ...v, value: v.value === 'male' ? 'female' : 'male' }; else v = { ...v, a: other }; }
      const r = fileFor(g.opinionSlot, v);
      if (r.opinion) { log = K.appendOpinion(log, r.opinion); filed++; } else refusedBad++;
    }
    for (const X of people) {
      const without = ask(K, base, X), withOp = ask(K, base, X, log);
      assert.equal(JSON.stringify(K.mechanicalPart(withOp)), JSON.stringify(K.mechanicalPart(without)), `(a) mechanical part moved, seed ${seed} ${X}`);
      assert.equal(withOp.evidence.opinion, 0);
      for (const c of withOp.conditional) {
        conditionalSeen++;
        assert.equal(c.opinionDependent, true); assert.ok(c.opinions.length > 0 && c.opinions.every((id) => log.some((e) => e.id === id)));
        assert.equal(c.evidence.countsAsIndependent, false);
        const recount = new Set(c.derivations.flatMap((d) => d.steps.filter((s) => s.kind === 'fact' && s.standing !== 'opinion').map((s) => s.giver)));
        assert.equal(c.evidence.independent, recount.size);
        assert.ok(c.derivations.every((d) => d.steps.every((s) => s.giver)));
      }
      assert.equal(withOp.opinionDependent, withOp.conditional.length > 0);
      if (without.state === 'gap') assert.equal(withOp.state, 'gap');           // no opinion turns a gap into an answer
    }
    // (c) supersede the first opinion: no conditional lists it any more
    if (log.length) {
      const dead = log[0].id, log2 = K.appendOpinion(log, { kind: 'supersede', id: dead, by: 'giver:text:syn', reason: 'a giver now states it' });
      for (const X of people) for (const c of ask(K, base, X, log2).conditional) assert.ok(!c.opinions.includes(dead));
      assert.equal(log2.length, log.length + 1);   // append-only: the file event is still there
      assert.ok(K.opinionsAt(log2).every((o) => o.id !== dead)); assert.ok(K.opinionsAt(log2, { asOf: log.length }).some((o) => o.id === dead));
    }
    // (d) a holder that is not a model, a lens that is not a prompt hash, a missing audit hash: refused
    const any = asked.find((a) => a.gaps.some((g) => g.opinionSlot));
    if (any) {
      const slot = any.gaps.find((g) => g.opinionSlot).opinionSlot, v = trueFill(w, slot);
      if (v) {
        assert.equal(fileFor(slot, v, { holder: 'text:syn' }).refused, 'holder_is_not_a_model');
        assert.equal(fileFor(slot, v, { holder: 'self:model:' }).refused, 'holder_is_not_a_model');
        assert.equal(fileFor(slot, v, { lens: 'my prompt' }).refused, 'lens_is_not_a_prompt_hash');
        assert.equal(K.fileOpinion(slot, { holder: HOLDER, lens: LENS, value: v }).refused, 'no_audit_hash');
        assert.equal(fileFor(slot, { ...v, rel: v.rel === 'sex' ? 'parent_of' : 'sex' }).refused, 'value_does_not_fit_slot');
      }
    }
  }
  assert.ok(filed > 50, `only ${filed} opinions filed`);
  assert.ok(conditionalSeen > 0, 'no conditional answer was ever produced: the seam was never exercised');
  console.log(`# S5: opinions filed ${filed}, conditional items seen ${conditionalSeen}`);
});
test('S5(e) with exactly one fact missing, a TRUE opinion makes mechanical plus conditional equal the generator truth; a FALSE one leaves the mechanical gap a gap', () => {
  let exercised = 0;
  for (let seed = 1; seed <= N && exercised < 40; seed++) {
    const w = makeWorld(seed); const full = [];
    let i = 0; for (const [p, c] of w.edges) full.push({ rel: 'parent_of', a: p, b: c, giver: 'text:syn', witness: `syn#${i}-${i++ + 5}` });
    for (const [p, v] of w.persons) full.push({ rel: 'sex', a: p, value: v.sex, giver: 'text:syn', witness: `syn#${i}-${i++ + 5}` });
    for (const X of w.persons.keys()) {
      const truth = w.trueUncles(X); if (!truth.length) continue;
      // make one needed fact unknown: u's parents are not stated at all, so sibling_of(u, m) is the single missing premise
      const m = w.parentsOf(X).find((p) => w.sibs(p).some((u) => truth.includes(u))), u = truth.find((t) => w.sibs(m).includes(t));
      const partial = full.filter((f) => !(f.rel === 'parent_of' && f.b === u));
      const base = K.factBase(partial), a = ask(K, base, X); if (a.items.map((x) => x.who).sort().join() === truth.join()) continue;
      const slotG = a.gaps.find((q) => q.opinionSlot && q.slot.rel === 'sibling_of' && q.slot.b === m); if (!slotG) continue;
      const good = fileFor(slotG.opinionSlot, { rel: 'sibling_of', a: u, b: m }); assert.ok(good.opinion, JSON.stringify(good));
      const log = K.appendOpinion([], good.opinion), c = ask(K, base, X, log);
      const union = [...new Set([...c.items.map((x) => x.who), ...c.conditional.map((x) => x.who)])].sort();
      assert.deepEqual(union, truth, `seed ${seed} ${X}`); exercised++;
      const wrongP = [...w.persons.keys()].find((p) => p !== u && p !== m && !w.sibs(m).includes(p));
      const bad = fileFor(slotG.opinionSlot, { rel: 'sibling_of', a: wrongP, b: m }); assert.ok(bad.opinion);
      const c2 = ask(K, base, X, K.appendOpinion([], bad.opinion));
      assert.equal(c2.state, a.state); assert.equal(JSON.stringify(K.mechanicalPart(c2)), JSON.stringify(K.mechanicalPart(a)));
    }
  }
  assert.ok(exercised >= 20, `only ${exercised} one-missing-fact cases were exercised`);
});

// ------------------------------------------------------------------------------------------------ unit tests
test('the rules are READ from the giver: uncle is the gloss "The brother or brother-in-law of one\'s parent", the in-law alternative is a typed note, the derived-sibling row is authored (candidate)', () => {
  assert.equal(rules.composites.uncle.giver, 'wiktionary-en');
  assert.match(rules.composites.uncle.witness, /brother or brother-in-law of one.s parent/);
  assert.equal(rules.composites.uncle.reading, 'frame');
  assert.equal(rules.derivedSibling.standing, 'candidate'); assert.equal(rules.derivedSibling.reading, 'authored');
  const base = K.factBase([{ rel: 'parent_of', a: 'F', b: 'X', giver: 'text:t', witness: 't#1-2' }]);
  const a = ask(K, base, 'X');
  assert.deepEqual(a.ruleNotes, [{ alternative: 'brother-in-law', gap: 'alternative_not_atomic' }]);
  assert.equal(a.complete, false);
});
test('a worked derivation: uncle, aunt, grandfather from stated facts, every step with its giver, standing candidate because the sibling rule is authored', () => {
  const f = (rel, a, b, giver, i) => ({ rel, a, b, giver, witness: `src#${i}-${i + 9}` });
  const base = K.factBase([f('parent_of', 'G', 'F', 'text:src', 1), f('parent_of', 'G', 'U', 'name-parts-ru', 11), f('parent_of', 'F', 'X', 'text:src', 21),
    { rel: 'sex', a: 'U', value: 'male', giver: 'name-parts-ru', witness: 'src#31-40' }, { rel: 'parent_of', a: 'G', b: 'A', giver: 'text:src', witness: 'src#41-50' }, { rel: 'sex', a: 'A', value: 'female', giver: 'text:src', witness: 'src#51-60' },
    { rel: 'sex', a: 'G', value: 'male', giver: 'text:src', witness: 'src#61-70' }]);
  const u = ask(K, base, 'X');
  assert.equal(u.state, 'answered'); assert.deepEqual(u.items.map((i) => i.who), ['U']);
  const d = u.items[0].derivations[0];
  assert.equal(d.steps[0].kind, 'rule'); assert.equal(d.steps[0].giver, 'wiktionary-en');
  assert.ok(d.steps.every((s) => s.giver && s.witness)); assert.equal(d.standing, 'candidate');
  assert.deepEqual(u.evidence.givers, ['name-parts-ru', 'text:src']); assert.equal(u.evidence.independent, 2);
  const aunt = K.deriveKin({ term: 'aunt', of: 'X' }, { base, rules }); assert.deepEqual(aunt.items.map((i) => i.who), ['A']);
  const gf = K.deriveKin({ term: 'grandfather', of: 'X' }, { base, rules }); assert.deepEqual(gf.items.map((i) => i.who), ['G']);
});
test('typed gaps: every gap kind is closed and flagged; only parent_cycle is not opinion-fillable; a non-fillable gap carries no slot', () => {
  assert.deepEqual(Object.entries(K.GAP_KINDS).filter(([, v]) => !v.opinionFillable).map(([k]) => k), ['parent_cycle']);
  const none = ask(K, K.factBase([]), 'X'); assert.equal(none.state, 'gap'); assert.equal(none.gaps[0].kind, 'no_parent_fact'); assert.deepEqual(none.gaps[0].slot, { rel: 'parent_of', a: '?', b: 'X' });
  const s = none.gaps[0].opinionSlot; assert.equal(s.fileAs.countsAsIndependent, false); assert.equal(s.fileAs.licenses, false); assert.equal(s.fileAs.answerCarries, 'opinionDependent');
  const cousin = K.deriveKin({ term: 'cousin', of: 'X' }, { base: K.factBase([]), rules }); assert.equal(cousin.gaps[0].kind, 'no_rule_giver'); assert.equal(cousin.state, 'gap');
  const cyc = ask(K, K.factBase([{ rel: 'parent_of', a: 'A', b: 'B', giver: 'text:t', witness: 't#1-2' }, { rel: 'parent_of', a: 'B', b: 'A', giver: 'text:t', witness: 't#3-4' }]), 'A');
  assert.equal(cyc.gaps[0].kind, 'parent_cycle'); assert.equal(cyc.gaps[0].opinionSlot, undefined); assert.equal(cyc.gaps[0].opinionFillable, false);
});
test('an opinion log is append-only and auditable; an audit against a later giver says confirmed, contradicted or open (the avoidability measure)', () => {
  const base0 = K.factBase([]), a = ask(K, base0, 'X'), slot = a.gaps[0].opinionSlot;
  const o1 = fileFor(slot, { rel: 'parent_of', a: 'F', b: 'X' }).opinion, o2 = fileFor(slot, { rel: 'parent_of', a: 'Z', b: 'X' }).opinion;
  let log = K.appendOpinion(K.appendOpinion([], o1), o2);
  assert.throws(() => K.appendOpinion(log, { kind: 'file' }), TypeError); assert.throws(() => K.appendOpinion(log, { kind: 'supersede', id: o1.id }), TypeError);
  assert.throws(() => { log.push(1); }, TypeError);          // frozen
  assert.equal(o1.holder, HOLDER); assert.equal(o1.lens, LENS); assert.match(o1.audit.outputSha256, /^[0-9a-f]{64}$/); assert.equal(o1.standing, 'opinion');
  const later = K.factBase([{ rel: 'parent_of', a: 'F', b: 'X', giver: 'wiktionary-en', witness: 'a gloss' }]);
  assert.deepEqual(K.auditOpinions(log, later).map((x) => x.status), ['confirmed_by_giver', 'open']);
  const sexSlot = { ...slot, ask: { rel: 'sex', a: 'U', value: '?' }, gap: 'no_sex_fact' };
  const o3 = fileFor(sexSlot, { rel: 'sex', a: 'U', value: 'male' }).opinion;
  const withSex = K.factBase([{ rel: 'sex', a: 'U', value: 'female', giver: 'text:t', witness: 't#1-2' }]);
  assert.equal(K.auditOpinions(K.appendOpinion([], o3), withSex)[0].status, 'contradicted_by_giver');
  assert.equal(K.opinionsAt(K.appendOpinion(log, { kind: 'retract', id: o2.id, basis: 'withdrawn by the filer' })).length, 1);
});
test('an opinion fills only its slot: a value for another slot, a missing hole or a self relation is refused', () => {
  const slot = ask(K, K.factBase([]), 'X').gaps[0].opinionSlot;
  assert.equal(fileFor(slot, { rel: 'parent_of', a: 'F', b: 'Y' }).refused, 'value_does_not_fit_slot');
  assert.equal(fileFor(slot, { rel: 'parent_of', a: '', b: 'X' }).refused, 'hole_not_filled');
  assert.equal(fileFor(slot, { rel: 'parent_of', a: 'X', b: 'X' }).refused, 'self_relation');
  assert.equal(K.fileOpinion(null, {}).refused, 'no_slot');
});
