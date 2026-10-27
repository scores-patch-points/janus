// organs/kinship.js — G1-2, the DERIVATION side: a recorded derivation answers "who is X's uncle?", and where it cannot, it returns a TYPED GAP
// and a well-formed slot in which an opinion may be filed. Pure: no model, no network, no file IO; the facts and the rules are INJECTED.
//
// The law this file keeps (the user's, 2026-10-27):
//   - a derivation step with no giver is REFUSED, not guessed (makeFact refuses it; every step of an answer names its giver);
//   - a rule is read from a giver's gloss (rulesFromLexicon), never typed here; the only declared list is in scripts/kinship/kin-lexicon.mjs;
//   - typed gaps instead of silent defaults: an unanswered question returns {state:'gap', gaps:[{kind, slot}]}, never an empty answer;
//   - a model may take part ONLY as an OPINION: holder `self:model:<id>`, lens = the prompt's sha256, supersedable, auditable. An opinion is
//     never a fact, never counted as independent evidence, and NEVER changes the mechanical part of an answer (deriveKin computes the
//     mechanical result first, from facts and rules alone, and only then looks at opinions; they can add a `conditional` that carries
//     `opinionDependent: true`). The first seam of the opinion limit (reading-rules-audit/THE-OPINION-LIMIT.md, seat 3: the derivation seat).
// Name keys are NOT referents (a being is one referent however it is named): the facts' ends are opaque keys the caller chose; a key
// conflation that makes a person his own ancestor is a `parent_cycle` gap, not an answer.
import { createHash } from "node:crypto";

export const KINSHIP_SCHEMA = "Kinship@1";
export const OPINION_SLOT_SCHEMA = "KinshipOpinionSlot@1";
export const OPINION_SCHEMA = "KinshipOpinion@1";

/** The closed set of gap kinds. `opinionFillable` is a property of the KIND (is there a well-formed slot "one fact with one hole"?), not a per-case hand flag. */
export const GAP_KINDS = Object.freeze({
  no_parent_fact: { opinionFillable: true },     // no giver states a parent of X
  no_sibling_fact: { opinionFillable: true },    // a parent is known, no giver states (or derives) a sibling of it
  no_spouse_fact: { opinionFillable: true },
  no_sex_fact: { opinionFillable: true },        // a sibling of the parent is known, its sex is not
  open_world_empty: { opinionFillable: true },   // every premise is present, none yields an uncle: absence is NOT asserted
  no_rule_giver: { opinionFillable: true },      // the term has no rule row (cousin, nephew: the giver's gloss is not a composition)
  parent_cycle: { opinionFillable: false },      // a person is his own ancestor: a key conflation; the identity seat's gap, not this seat's
});
const RELS = new Set(["parent_of", "sibling_of", "spouse_of", "sex", "term"]);
const SEXES = new Set(["male", "female"]);
const ADDR = /^[^#\s]+#\d+-\d+$/;
const sha = (x) => createHash("sha256").update(typeof x === "string" ? x : JSON.stringify(x)).digest("hex");
const str = (x) => typeof x === "string" ? x.trim() : "";
const freeze = Object.freeze;
const core = (f) => ({ rel: f.rel, a: f.a, b: f.b ?? null, value: f.value ?? null, term: f.term ?? null });
const coreKey = (f) => JSON.stringify(core(f));

/** The door for a fact. A fact without a giver (or a witness) is refused: `fact_without_giver`. A giver that begins `self:model` is an opinion, not a fact. */
export function makeFact(spec = {}) {
  const giver = str(spec.giver), witness = str(spec.witness), rel = spec.rel, a = str(spec.a), b = str(spec.b);
  if (!giver) return { refused: "fact_without_giver" };
  if (giver.startsWith("self:model")) return { refused: "opinion_is_not_a_fact", detail: "file it through fileOpinion; an opinion is never a fact" };
  if (!witness) return { refused: "fact_without_witness" };
  if (!giver.startsWith("wiktionary") && !ADDR.test(witness)) return { refused: "witness_not_a_byte_span", detail: "a fact from a text giver carries `src#from-to`; only a lexical giver's gloss is its own witness" };
  if (!RELS.has(rel)) return { refused: "unknown_relation" };
  if (!a) return { refused: "no_subject" };
  if (rel === "sex") { if (!SEXES.has(spec.value)) return { refused: "bad_sex" }; }
  else if (!b) return { refused: "no_object" };
  else if (a === b) return { refused: "self_relation" };
  if (rel === "term" && !str(spec.term)) return { refused: "no_term" };
  const standing = spec.standing ?? "given";
  if (standing !== "given" && standing !== "candidate") return { refused: "bad_standing" };
  const f = { rel, a, b: rel === "sex" ? null : b, value: rel === "sex" ? spec.value : null, term: rel === "term" ? str(spec.term) : null, giver, witness, standing };
  return { fact: freeze({ ...f, id: sha({ ...core(f), giver }).slice(0, 16) }) };
}

/** A base of facts: raw specs in, deduplicated facts out (same relation, ends and giver: one fact, the witnesses kept), the refusals listed. */
export function factBase(specs = []) {
  const byId = new Map(), refused = [];
  for (const s of specs) {
    const r = makeFact(s);
    if (r.refused) { refused.push({ spec: s, reason: r.refused }); continue; }
    const prev = byId.get(r.fact.id);
    if (!prev) byId.set(r.fact.id, { ...r.fact, witnesses: [r.fact.witness] });
    else if (!prev.witnesses.includes(r.fact.witness)) prev.witnesses.push(r.fact.witness);
  }
  const facts = [...byId.values()].map((f) => freeze({ ...f, witnesses: freeze(f.witnesses) }));
  return freeze({ schema: KINSHIP_SCHEMA, facts: freeze(facts), refused: freeze(refused) });
}

/** Rule rows READ FROM A LEXICON (scripts/kinship/kin-lexicon.mjs, KinLexicon@1): atoms, composites, and the one authored row (derived sibling). A row with no giver or witness is dropped and listed. */
export function rulesFromLexicon(lex) {
  const atoms = {}, composites = {}, dropped = [];
  for (const [t, a] of Object.entries(lex?.atoms ?? {})) (a.giver && a.witness ? (atoms[t] = freeze({ term: t, rel: a.rel, end: a.end, sex: a.sex ?? null, giver: a.giver, witness: a.witness, standing: "given" })) : dropped.push(t));
  for (const [t, c] of Object.entries(lex?.composites ?? {})) {
    if (!c.giver || !c.witness || !atoms[c.head_of]) { dropped.push(t); continue; }
    composites[t] = freeze({ term: t, headOf: c.head_of, alternatives: freeze(c.alternatives.map((x) => freeze({ ...x }))), giver: c.giver, witness: c.witness, standing: "given", reading: "frame" });
  }
  const sib = atoms.sibling;
  // authored, not frame-read: the giver's gloss of "sibling" says "A person who shares a parent"; the rule structure is the builder's reading of it
  const derivedSibling = sib ? freeze({ term: "sibling", giver: sib.giver, witness: sib.witness, standing: "candidate", reading: "authored" }) : null;
  return freeze({ atoms: freeze(atoms), composites: freeze(composites), derivedSibling, dropped: freeze(dropped) });
}

// ---------------------------------------------------------------------------------------------------------------------------------- mechanics

const mapSet = (m, k, v) => { (m.get(k) ?? m.set(k, new Set()).get(k)).add(v); };
const indexCache = new WeakMap();
function indexOf(facts) {
  if (indexCache.has(facts)) return indexCache.get(facts);
  const ix = { parents: new Map(), children: new Map(), sib: new Map(), spouse: new Map(), sex: new Map(), term: new Map(), byEdge: new Map() };
  for (const f of facts) {
    if (f.rel === "parent_of") { mapSet(ix.parents, f.b, f.a); mapSet(ix.children, f.a, f.b); (ix.byEdge.get(`p|${f.a}|${f.b}`) ?? ix.byEdge.set(`p|${f.a}|${f.b}`, []).get(`p|${f.a}|${f.b}`)).push(f); }
    else if (f.rel === "sibling_of") { mapSet(ix.sib, f.a, f.b); mapSet(ix.sib, f.b, f.a); for (const k of [`s|${f.a}|${f.b}`, `s|${f.b}|${f.a}`]) (ix.byEdge.get(k) ?? ix.byEdge.set(k, []).get(k)).push(f); }
    else if (f.rel === "spouse_of") { mapSet(ix.spouse, f.a, f.b); mapSet(ix.spouse, f.b, f.a); for (const k of [`m|${f.a}|${f.b}`, `m|${f.b}|${f.a}`]) (ix.byEdge.get(k) ?? ix.byEdge.set(k, []).get(k)).push(f); }
    else if (f.rel === "sex") (ix.sex.get(f.a) ?? ix.sex.set(f.a, []).get(f.a)).push(f);
    else if (f.rel === "term") (ix.term.get(`${f.term}|${f.b}`) ?? ix.term.set(`${f.term}|${f.b}`, []).get(`${f.term}|${f.b}`)).push(f);
  }
  indexCache.set(facts, ix); return ix;
}
const stepOf = (f) => ({ kind: "fact", fact: f.id, rel: f.rel, a: f.a, b: f.b, value: f.value, term: f.term, giver: f.giver, witness: f.witnesses?.[0] ?? f.witness, standing: f.standing });
const ruleStep = (r, term) => ({ kind: "rule", rule: term ?? r.term, giver: r.giver, witness: r.witness, standing: r.standing, reading: r.reading });
const sortJson = (xs) => xs.slice().sort((p, q) => (JSON.stringify(p) < JSON.stringify(q) ? -1 : 1));
const standingOf = (steps) => (steps.some((s) => s.standing === "candidate" || s.standing === "opinion") ? (steps.some((s) => s.standing === "opinion") ? "opinion" : "candidate") : "given");

/** Is there a parent_of cycle among the ancestors of x (x its own ancestor, a key conflation)? Returns the cycle path or null. */
function ancestorCycle(ix, x) {
  const state = new Map(); const path = [];
  const dfs = (n) => {
    state.set(n, 1); path.push(n);
    for (const p of ix.parents.get(n) ?? []) {
      if (state.get(p) === 1) return [...path.slice(path.indexOf(p)), p];
      if (!state.has(p)) { const c = dfs(p); if (c) return c; }
    }
    state.set(n, 2); path.pop(); return null;
  };
  return dfs(x);
}

/** Who holds `atom` toward y (x is the atom of y), with the facts that say so. Sex of x is checked when the atom has one: unknown -> pending. */
function holders(ix, rules, atom, y) {
  const out = [], pending = [];
  const consider = (x, steps) => {
    if (atom.sex) {
      const sx = ix.sex.get(x);
      if (!sx || !sx.length) { pending.push({ x, steps }); return; }
      const hit = sx.find((f) => f.value === atom.sex);
      if (!hit) return;
      out.push({ x, steps: [...steps, stepOf(hit)] });
    } else out.push({ x, steps });
  };
  if (atom.rel === "parent_of") {
    if (atom.end === "a") for (const p of ix.parents.get(y) ?? []) consider(p, (ix.byEdge.get(`p|${p}|${y}`) ?? []).slice(0, 1).map(stepOf));
    else for (const c of ix.children.get(y) ?? []) consider(c, (ix.byEdge.get(`p|${y}|${c}`) ?? []).slice(0, 1).map(stepOf));
  } else if (atom.rel === "sibling_of") {
    const seen = new Set();
    for (const s of ix.sib.get(y) ?? []) { seen.add(s); consider(s, (ix.byEdge.get(`s|${s}|${y}`) ?? []).slice(0, 1).map(stepOf)); }
    if (rules.derivedSibling) for (const p of ix.parents.get(y) ?? []) for (const c of ix.children.get(p) ?? []) {
      if (c === y || seen.has(c)) continue; seen.add(c);
      consider(c, [stepOf((ix.byEdge.get(`p|${p}|${c}`) ?? [])[0]), stepOf((ix.byEdge.get(`p|${p}|${y}`) ?? [])[0]), { kind: "rule", rule: "sibling:shared_parent", giver: rules.derivedSibling.giver, witness: rules.derivedSibling.witness, standing: rules.derivedSibling.standing, reading: rules.derivedSibling.reading }]);
    }
  } else if (atom.rel === "spouse_of") for (const s of ix.spouse.get(y) ?? []) consider(s, (ix.byEdge.get(`m|${s}|${y}`) ?? []).slice(0, 1).map(stepOf));
  return { out, pending };
}
const slotFor = (atom, y) => atom.rel === "parent_of" ? (atom.end === "a" ? { rel: "parent_of", a: "?", b: y } : { rel: "parent_of", a: y, b: "?" }) : { rel: atom.rel, a: "?", b: y };
const gapKindFor = (atom) => atom.rel === "parent_of" ? "no_parent_fact" : atom.rel === "sibling_of" ? "no_sibling_fact" : "no_spouse_fact";

/** The MECHANICAL result: facts and rules only. An opinion never enters here. */
function mechanical(question, facts, rules) {
  const { term, of: X } = question, ix = indexOf(facts);
  const gaps = [], items = new Map(), ruleNotes = [];
  const addGap = (kind, slot, detail) => { if (!gaps.some((g) => g.kind === kind && JSON.stringify(g.slot) === JSON.stringify(slot))) gaps.push({ kind, slot, opinionFillable: GAP_KINDS[kind].opinionFillable, ...(detail ? { detail } : {}) }); };
  const rule = rules.composites[term];
  // a stated answer: the giver says "x is the <term> of X" outright
  for (const f of ix.term.get(`${term}|${X}`) ?? []) items.set(f.a, [{ steps: [stepOf(f)], standing: f.standing }]);
  if (!rule) {
    if (!items.size) addGap("no_rule_giver", { rule: term }, rules.atoms[term] ? "an atom: ask it as a fact, not a derivation" : "no giver states what this term is composed of");
  } else {
    const cyc = ancestorCycle(ix, X);
    if (cyc) addGap("parent_cycle", { cycle: cyc }, "a person is his own ancestor: two beings share one key");
    else {
      const head = rules.atoms[rule.headOf];
      for (const alt of rule.alternatives) if (!alt.evaluable) ruleNotes.push({ alternative: alt.head, gap: alt.gap ?? "alternative_not_atomic" });
      const mids = holders(ix, rules, head, X);
      if (!mids.out.length && !mids.pending.length) addGap(gapKindFor(head), slotFor(head, X));
      for (const m of mids.pending) addGap("no_sex_fact", { rel: "sex", a: m.x, value: "?" });
      for (const m of mids.out) {
        let found = false;
        for (const alt of rule.alternatives.filter((a) => a.evaluable)) {
          const us = holders(ix, rules, rules.atoms[alt.head], m.x);
          for (const u of us.out) {
            if (u.x === X || u.x === m.x) continue;
            found = true;
            const steps = [ruleStep(rule), ...m.steps, ...u.steps];
            (items.get(u.x) ?? items.set(u.x, []).get(u.x)).push({ steps, standing: standingOf(steps) });
          }
          for (const p of us.pending) addGap("no_sex_fact", { rel: "sex", a: p.x, value: "?" });
        }
        // open world: a parent through whom no uncle was found may still have a sibling nobody states; name the slot (a pending sex does not remove it)
        if (!found) {
          const sibs = holders(ix, rules, { rel: "sibling_of", end: "a", sex: null }, m.x);
          if (!sibs.out.length) addGap("no_sibling_fact", { rel: "sibling_of", a: "?", b: m.x });
          else addGap("open_world_empty", { rel: "sibling_of", a: "?", b: m.x }, "no stated or derived sibling of this parent is a confirmed male; absence is not asserted");
        }
      }
    }
  }
  const out = [...items.entries()].sort((p, q) => (p[0] < q[0] ? -1 : 1)).map(([who, derivations]) => ({ who, derivations: sortJson(derivations.map((d) => ({ steps: d.steps, standing: d.standing }))) }));
  for (const it of out) for (const d of it.derivations) for (const s of d.steps) if (!s.giver) throw new Error("kinship: a derivation step with no giver (refused by construction)");
  const givers = new Set(); for (const it of out) for (const d of it.derivations) for (const s of d.steps) if (s.kind === "fact") givers.add(s.giver);
  const slotted = gaps.map((g) => g.opinionFillable ? { ...g, opinionSlot: opinionSlot(question, g) } : g);
  return { schema: KINSHIP_SCHEMA, question: { term, of: X }, state: out.length ? "answered" : "gap", items: out, gaps: slotted, ruleNotes, complete: false,
    evidence: { independent: givers.size, givers: [...givers].sort(), opinion: 0 } };
}

// ---------------------------------------------------------------------------------------------------------------------------------- the seam

/** The well-formed slot an opinion may be filed in: one fact (or one rule) with one hole. It states what a filing must look like and what it will NOT be. */
export function opinionSlot(question, gap) {
  const id = sha({ q: question, kind: gap.kind, slot: gap.slot }).slice(0, 16);
  return freeze({ schema: OPINION_SLOT_SCHEMA, id, gap: gap.kind, question, ask: gap.slot,
    accepts: { holder: "self:model:<model id>", lens: "sha256 (64 hex) of the exact prompt", audit: ["outputSha256 (64 hex)", "modelId", "temperature", "seed"] },
    fileAs: { standing: "opinion", evidenceClass: "self:model", countsAsIndependent: false, licenses: false, supersedable: true, answerCarries: "opinionDependent" } });
}
const HEX64 = /^[0-9a-f]{64}$/;
const HOLDER = /^self:model:[^\s:][^\s]*$/;

/** File an opinion in a slot. Refused unless it names a model holder, a lens that is a prompt hash, an audit hash, and a value that fills EXACTLY the slot's hole. */
export function fileOpinion(slot, rec = {}) {
  if (!slot || slot.schema !== OPINION_SLOT_SCHEMA) return { refused: "no_slot" };
  if (!HOLDER.test(rec.holder ?? "")) return { refused: "holder_is_not_a_model", detail: "holder must be self:model:<id>" };
  if (!HEX64.test(rec.lens ?? "")) return { refused: "lens_is_not_a_prompt_hash" };
  if (!HEX64.test(rec.outputSha256 ?? "")) return { refused: "no_audit_hash", detail: "the raw output must be stored and its sha256 filed" };
  const v = rec.value ?? {}, ask = slot.ask;
  if (slot.gap === "no_rule_giver") return { refused: "rule_opinions_are_filed_as_candidates", detail: "a rule opinion is a candidate row; not implemented in this seam" };
  if (v.rel !== ask.rel) return { refused: "value_does_not_fit_slot" };
  for (const k of ["a", "b", "value"]) {
    if (ask[k] === undefined) continue;
    if (ask[k] === "?") { if (!str(v[k])) return { refused: "hole_not_filled" }; if (k === "value" && !SEXES.has(v[k])) return { refused: "bad_sex" }; }
    else if (v[k] !== ask[k]) return { refused: "value_does_not_fit_slot" };
  }
  if (v.rel !== "sex" && v.a === v.b) return { refused: "self_relation" };
  const holes = ["a", "b", "value"].filter((k) => ask[k] === "?");
  const value = { rel: v.rel, a: v.a, b: v.rel === "sex" ? null : v.b, value: v.rel === "sex" ? v.value : null };
  const id = sha({ slot: slot.id, holder: rec.holder, lens: rec.lens, value }).slice(0, 16);
  return { opinion: freeze({ schema: OPINION_SCHEMA, kind: "file", id, slot: slot.id, holder: rec.holder, lens: rec.lens, value, holes,
    audit: { outputSha256: rec.outputSha256, modelId: rec.modelId ?? null, temperature: rec.temperature ?? null, seed: rec.seed ?? null, at: rec.at ?? null }, standing: "opinion" }) };
}
/** The opinion log is append-only (as the reasoning spiral's is): files, supersessions, retractions. Nothing is edited or deleted. */
export function appendOpinion(log = [], ev = {}) {
  if (!Array.isArray(log)) throw new TypeError("appendOpinion: log must be an array");
  if (ev.kind === "file") { if (ev.schema !== OPINION_SCHEMA) throw new TypeError("appendOpinion: file a record made by fileOpinion"); }
  else if (ev.kind === "supersede") { if (!str(ev.id) || !str(ev.by) || !str(ev.reason)) throw new TypeError("appendOpinion: a supersession names the opinion, who supersedes it and why"); }
  else if (ev.kind === "retract") { if (!str(ev.id) || !str(ev.basis)) throw new TypeError("appendOpinion: a retraction names the opinion and its basis"); }
  else throw new TypeError("appendOpinion: unknown event kind");
  return freeze([...log, freeze({ ...ev, seq: log.length })]);
}
/** The opinions standing at a cursor: filed and not superseded or retracted. */
export function opinionsAt(log = [], { asOf = Infinity } = {}) {
  const dead = new Set(); const filed = [];
  for (const e of log.slice(0, asOf)) { if (e.kind === "file") filed.push(e); else dead.add(e.id); }
  return filed.filter((o) => !dead.has(o.id));
}
/** Audit the opinions against the base: confirmed (a giver now states the same fact), contradicted (a giver states the other sex), or open. The avoidability measure of the seat. */
export function auditOpinions(log, base) {
  const ix = indexOf(base.facts), keys = new Set(base.facts.map(coreKey));
  return opinionsAt(log).map((o) => {
    const v = o.value; let status = "open", by = null;
    if (keys.has(JSON.stringify({ rel: v.rel, a: v.a, b: v.b ?? null, value: v.value ?? null, term: null }))) { status = "confirmed_by_giver"; by = base.facts.find((f) => coreKey(f) === JSON.stringify({ rel: v.rel, a: v.a, b: v.b ?? null, value: v.value ?? null, term: null }))?.giver ?? null; }
    else if (v.rel === "sex" && (ix.sex.get(v.a) ?? []).some((f) => f.value !== v.value)) status = "contradicted_by_giver";
    return { id: o.id, status, by };
  });
}

/**
 * Answer `{term:'uncle', of: X}`. The MECHANICAL part (state, items, gaps, ruleNotes, evidence) is computed from the base and the rules alone.
 * Opinions (an append-only log) can only add `conditional`: the items a derivation would reach if the standing opinions were facts, each
 * marked opinionDependent, each listing the opinions it used, none counted as independent evidence.
 */
export function deriveKin(question, { base, rules, opinions = [] }) {
  const m = mechanical(question, base.facts, rules);
  const active = opinionsAt(opinions);
  if (!active.length) return { ...m, conditional: [], opinionDependent: false };
  const opFacts = active.map((o) => ({ rel: o.value.rel, a: o.value.a, b: o.value.b, value: o.value.value, term: null, giver: o.holder, witness: `opinion:${o.id}`, standing: "opinion", id: `op-${o.id}`, witnesses: [`opinion:${o.id}`], opinion: o.id }));
  const c = mechanical(question, [...base.facts, ...opFacts], rules);
  const have = new Set(m.items.map((i) => i.who));
  const conditional = [];
  for (const it of c.items) {
    const ders = it.derivations.filter((d) => d.steps.some((s) => s.standing === "opinion"));
    if (!ders.length || have.has(it.who)) continue;
    const used = [...new Set(ders.flatMap((d) => d.steps.filter((s) => s.standing === "opinion").map((s) => s.fact.replace(/^op-/, ""))))].sort();
    const independent = new Set(ders.flatMap((d) => d.steps.filter((s) => s.kind === "fact" && s.standing !== "opinion").map((s) => s.giver)));
    conditional.push({ who: it.who, derivations: ders, opinionDependent: true, opinions: used, evidence: { independent: independent.size, givers: [...independent].sort(), opinion: used.length, countsAsIndependent: false } });
  }
  return { ...m, conditional, opinionDependent: conditional.length > 0, opinionsConsidered: active.map((o) => o.id) };
}

/** The mechanical part of an answer, for comparing runs with and without opinions. */
export const mechanicalPart = (a) => ({ schema: a.schema, question: a.question, state: a.state, items: a.items, gaps: a.gaps, ruleNotes: a.ruleNotes, complete: a.complete, evidence: a.evidence });
