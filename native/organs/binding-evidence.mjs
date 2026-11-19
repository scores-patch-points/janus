// organs/binding-evidence.mjs: WHAT A PRONOUN COULD BIND TO, as evidence. Janus is the researcher: for every anaphor (a personal pronoun, a definite description) in the reader's dependency rows it
// lists EVERY candidate it could refer back to inside a declared window, with the raw facts about each pairing, and it picks NOTHING: no score, no rank, no "best". Which candidate holds, whether the
// anaphor is bound at all or introduces something new ("the title"), and how much agreement is enough are Penelope's to declare (DEF a bound) and judge (EVA); she re-judges (REC) when more reading arrives.
// The candidates stay in superposition in one entry per anaphor. Listed alphabetically by being, so the ORDER implies no preference.
//
// Input: the reader's rows { s, id, form, lemma, upos, feats, head, deprel, at, end } (khora's UD parser prior; `s` the sentence, `at`/`end` UTF-16 offsets) and the known BEINGS' mentions
// [{ being, at, end }] (the caller's: khora's referents, read from the log). No regex: the feature string is split at "|" and at the first "=", a dependency label at the first ":", and everything
// else is a field compared exactly. Pure: no clock, no log access in bindingsOf; writeBindings is the only function that touches a door, and it is told the door.
//
// What each candidate carries (nothing here says "same", "bound" or "best"):
//   direction   "before" (an antecedent) or "after" (a cataphor: the mention comes later in the same sentence)
//   sentences   how many sentences back; chars  the distance in the text between the two spans
//   role        the dependency label (base) of the candidate's head: nsubj, obj, obl, nmod ...
//   agreement   number / gender / person: "match" | "mismatch" | "unknown" (unknown when either side carries no such feature: an English proper name has no gender: that is a HOLE, not a pass)
//   clauseMate  the two share the same governing predicate (the first verb or auxiliary above each): the structural fact a binding principle needs; null when in different sentences
// A candidate is a being's nearest mention, or an EARLIER ANAPHOR of this window (so "himself" lists "He": the chain is evidence, not a decision).
import crypto from "node:crypto";
export const BINDING_SCHEMA = "BindingEvidence@1";
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
/** "A=B|C=D" -> Map; "_" or nothing -> empty. Split at "|" then at the FIRST "=": no pattern matching. */
export function parseFeats(s) {
  const m = new Map(); if (typeof s !== "string" || s === "_" || s === "") return m;
  for (const part of s.split("|")) { const i = part.indexOf("="); if (i > 0) m.set(part.slice(0, i), part.slice(i + 1)); }
  return m;
}
/** a dependency label's base: "nsubj:pass" -> "nsubj" */
export const depBase = (d) => { const s = String(d ?? ""), i = s.indexOf(":"); return i < 0 ? s : s.slice(0, i); };
const cmp = (a, b) => (a == null || b == null ? "unknown" : a === b ? "match" : "mismatch");
const feat = (r, k) => parseFeats(r.feats).get(k) ?? null;

/** bindingsOf(rows, beings, { window, kinds }) -> { schema, window, anaphors: [{ anaphor, candidates, holes }], holes, counts } */
export function bindingsOf(rows, beings = [], { window = 3, kinds = ["pronoun", "definite-description"] } = {}) {
  if (!Array.isArray(rows)) throw new TypeError("bindingsOf: rows must be the reader's rows");
  if (!Number.isInteger(window) || window < 0) throw new TypeError("bindingsOf: window is a declared number of sentences back");
  if (!Array.isArray(kinds) || kinds.some((k) => k !== "pronoun" && k !== "definite-description")) throw new TypeError("bindingsOf: kinds is a list of pronoun and definite-description (the anaphor kinds to LIST: janus does not decide which are anaphoric)");
  const by = new Map(); for (const r of rows) { if (!by.has(r.s)) by.set(r.s, new Map()); by.get(r.s).set(r.id, r); }
  const governing = (s, id) => { const m = by.get(s); let c = id; for (let n = 0; n < 64; n++) { const r = m?.get(c); if (!r || r.head === 0) return null; const p = m.get(r.head); if (!p) return null; if (p.upos === "VERB" || p.upos === "AUX") return p.id; c = p.id; } return null; };
  const holes = [], mentions = [], spanTokens = new Set();
  for (const b of beings) {
    const toks = rows.filter((r) => r.at != null && r.at >= b.at && r.end <= b.end);
    if (!toks.length) { holes.push({ why: "mention_not_in_rows", being: b.being, at: b.at, end: b.end }); continue; }
    const s = toks[0].s, own = toks.filter((t) => t.s === s), ids = new Set(own.map((t) => t.id)), head = own.find((t) => !ids.has(t.head)) ?? own[0];
    for (const t of own) spanTokens.add(`${s}:${t.id}`);
    mentions.push({ being: b.being, s, head, at: b.at, end: b.end, role: depBase(head.deprel), gov: governing(s, head.id) });
  }
  const anaphors = [];
  for (const r of rows) {
    if (r.at == null || spanTokens.has(`${r.s}:${r.id}`)) continue;
    const f = parseFeats(r.feats);
    const pron = r.upos === "PRON" && f.get("PronType") === "Prs";
    const def = r.upos === "NOUN" && rows.some((k) => k.s === r.s && k.head === r.id && depBase(k.deprel) === "det" && feat(k, "Definite") === "Def");
    if ((pron && kinds.includes("pronoun")) || (def && kinds.includes("definite-description"))) anaphors.push({ kind: pron ? "pronoun" : "definite-description", s: r.s, id: r.id, form: r.form, lemma: r.lemma ?? null, at: r.at, end: r.end, role: depBase(r.deprel), number: f.get("Number") ?? null, gender: f.get("Gender") ?? null, person: f.get("Person") ?? null, reflexive: f.get("Reflex") === "Yes", possessive: f.get("Poss") === "Yes", gov: governing(r.s, r.id) });
  }
  anaphors.sort((x, y) => x.at - y.at);
  const out = [];
  for (const a of anaphors) {
    const cands = new Map(), aholes = [];
    const consider = (key, ref, m, sameKindFeatures) => {
      const dir = m.at < a.at ? "before" : "after", sentences = a.s - m.s;
      if (sentences < 0 || sentences > window || (m.s === a.s && m.at === a.at)) return;
      const chars = dir === "before" ? a.at - m.end : m.at - a.end, prev = cands.get(key);
      if (prev && prev.chars <= chars) return;                                  // the nearest mention of this being
      cands.set(key, { ref, direction: dir, sentences, chars, role: m.role, agreement: { number: cmp(a.number, m.number), gender: cmp(a.gender, m.gender), person: cmp(a.person, m.person) }, clauseMate: m.s === a.s && a.gov != null && m.gov != null ? a.gov === m.gov : null });
    };
    for (const m of mentions) { const row = m.head; consider(`being:${m.being}`, { being: m.being }, { ...m, number: feat(row, "Number"), gender: feat(row, "Gender"), person: feat(row, "Person") }); }
    for (const p of anaphors) if (p.at < a.at) consider(`anaphor:${p.s}:${p.id}`, { anaphor: { s: p.s, id: p.id, form: p.form } }, p);
    const list = [...cands.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([, c]) => c);
    if (a.kind === "definite-description") aholes.push({ why: "kind_unknown", note: "a definite description needs the referent's kind to be compared; none is given here" });
    if (a.kind === "pronoun" && list.some((c) => c.ref.being && c.agreement.gender === "unknown")) aholes.push({ why: "gender_unknown_for_a_being", note: "a name carries no gender in the reading: the gender comparison is a hole, not a match" });
    if (!list.length) aholes.push({ why: "no_candidate_in_window", window });
    const { gov, ...anaphor } = a; out.push({ anaphor, candidates: list, holes: aholes });
  }
  return Object.freeze({ schema: BINDING_SCHEMA, window, anaphors: Object.freeze(out), holes: Object.freeze(holes), counts: Object.freeze({ anaphors: out.length, pronouns: out.filter((x) => x.anaphor.kind === "pronoun").length, definite: out.filter((x) => x.anaphor.kind === "definite-description").length, candidates: out.reduce((n, x) => n + x.candidates.length, 0), withNoCandidate: out.filter((x) => !x.candidates.length).length }) });
}
const sha16 = (o) => crypto.createHash("sha256").update(JSON.stringify(o), "utf8").digest("hex").slice(0, 16);
export const KIND = "binding", CELL = "CON·Figure";   // candidate BONDS between an anaphor and what it might refer back to: janus bonds and never decides; Penelope DEFs the note that one holds
/** one entry per anaphor: CON at Figure (candidate bonds), every candidate in it, no verdict. `doc` is the text's own address, so the same anaphor of the same text is one address. */
export function bindingEntries(result, { doc, by = "janus.binding" } = {}) {
  if (typeof doc !== "string" || !doc) throw new TypeError("bindingEntries: doc is the text's address (e.g. its text:<sha16> id)");
  return result.anaphors.map((x) => ({ cell: CELL, kind: KIND, addr: `binding:${sha16([doc, x.anaphor.at, x.anaphor.end])}`, body: { by, doc, window: result.window, ...x } }));
}
/** writeBindings(door, result, { doc, of }) -> { written, refused, why }. `of` is the ids of the entries the bindings were read from (the reading); a door that is off writes nothing and says why. */
export function writeBindings(door, result, { doc, of = [] } = {}) {
  const es = bindingEntries(result, { doc });
  if (!door?.on) return { written: 0, refused: es.length, why: door?.why ?? "no door" };
  door.declare(KIND, CELL, "janus's structure: every candidate bond an anaphor could have, with the facts about each pairing; no choice made");
  let written = 0, refused = 0; for (const e of es) { if (door.weave(of.length ? { ...e, of } : e)) written++; else refused++; }
  return { written, refused, why: refused ? door.counts?.lastReason ?? "weave refused" : null };
}
