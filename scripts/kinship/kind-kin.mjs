// kind-kin.mjs — the second end of a kin fact from the INDUCED KIND of the beings, over the hyperlexicon, with POLARITY read: no scene, no topic. OFF BY DEFAULT: nothing imports this file.
//   node kind-kin.mjs --text <text> --ledger <KinLedger.json> --beings <KinStoreBeings.json> --polarity <PolarityLexicon.json> --kin-rows <KinStoreRows.json> --out <KindKin.json>
// The second binder (bind-kin2.mjs, unchanged) is the PAGE LAYER: every end it ties is kept. This layer fills the ends it left as typed gaps by RULES whose candidates are gated by a KIND, and reads the POLARITY of every kin statement:
//   KIND of a being (a person, with a sex or none): (1) the hyperlexicon store says whether the being's written forms are NAMES or common words (a being whose every known form is a common noun, verb or adjective, «мужа», «лицом», is not a name and is not a person);
//   (2) the being's COMPANY: the mentions of it followed by a gender-agreeing past-tense verb, or carrying a patronymic, counted per being and kept only where they exceed the p95 of the same count under SHUFFLED COMPANY (the mention contexts permuted among the beings, seeded, 1000 draws: the kind-induction law's NULL falsifier);
//   (3) the page layer's own kin ties anchor a being as a person with the term's sex. Its sex is the vote of its company; a being with votes for both sexes (a merged referent) has none.
//   KIN TABLE: each kin term's relation schema and sex come from the givers' glosses (priors/kin-lexicon.json); its CONVERSE is the schema read from the other end; the HYPERLEXICON STORE rows (kin-store-rows: synonym and antonym rows; the store holds no converse, sex or generation row) check the sex of a term against its antonym partner and where
//   they disagree the term's sex is withheld (typed gap `store_disagrees`); a term with no row is a typed gap, never a guess.
//   POLARITY: a polarity cue READ from a giver's gloss (polarity-lexicon.mjs: negation, existential and 'former' cues), placed as the rules in prepareKind say (before a predicate kin word, before a copula that precedes it, an absence cue before it), makes the statement `negated` or `former`: its ends are tied as before and NO FACT is emitted for it.
// Rules (all over the kind gate): K-SUBJ (a kin word with no marker: the nearest person-kind clause subject before it in its sentence is the possessor); K-CONV (the possessor is tied and the window's own page ties hold one fact of the converse relation with it: the other end is the holder);
// K-OTHER (the possessor is tied: the one other person-kind being, sex not contradicting the kin word's, named in the sentence, else the paragraph; two or more is a gap). No name list, no model, no network.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GAP_KINDS, opinionSlot, makeFact } from "../../native/organs/kinship.js";
import { prepare } from "./scene-kin.mjs";
import { loadPriors, REASONS as PAGE_REASONS } from "./bind-kin2.mjs";

export const KIND_SCHEMA = "KindKin@1";
export const DECLARED_THRESHOLD = 0.2;      // the kind-induction organ's own declared cut for "keeps company as one kind" (native/organs/kind-induction.js), never fit to a gold
export const PARAMS = Object.freeze({ NULL_DRAWS: 1000, SEED: 20261029 });   // the shuffled-company null's budget and seed (declared; every threshold the kinds use derives from the null)
export const KIND_REASONS = Object.freeze([...PAGE_REASONS, "kind_no_subject", "kind_bare_in_speech", "kind_no_candidate", "kind_ambiguous", "kind_converse_ambiguous", "store_disagrees"]);
const foldRu = (s) => s.normalize("NFC").toLowerCase().replace(/́/g, "").replace(/ё/g, "е");
const PATRO = /^(.*?)(ович|евич|ьевич|ич|овн|евн|ичн)(а|у|е|ем|ом|ы|ой|ою)?$/, PATRO_F = /(овн|евн|ичн)/, HARD = /[.;:!?]/;
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pct = (xs, p) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))]; };

/** The store's verdict on one being from its written forms: "name" (a form is a proper name), "common" (known forms, none a name), "unknown" (no form known). beingRows: KinStoreBeings@1. */
export function storeKind(beingRows, ref) {
  const b = beingRows.beings[ref]; if (!b) return "unknown";
  let known = false;
  for (const f of Object.values(b.forms)) { if (!f.found) continue; known = true; if (f.entries.some((e) => e.pos.includes("name"))) return "name"; }
  return known ? "common" : "unknown";
}

/** prepare: the heavy, deterministic structures: the page layer, the beings' induced kinds, the kin table, the polarity of every statement. */
export function prepareKind({ text, ledger, extraction, priors, beingRows, polarity, kinRows, induction = "company" }) {
  const P = prepare({ text, ledger, extraction, priors }), { toks, mentions, base, lex, gapBetween } = P;
  const isVerb = (t) => t.pos === "VERB" || (t.pos == null && !t.cap && t.raw.length >= 4 && /(?:[аио]л|ла|ли|ло|лся|лась|лись)$/.test(t.f));
  const beingsSet = new Set(ledger.referents.filter((r) => r.standing === "referent").map((r) => r.id));
  // ---- KIN TABLE (givers' glosses + the store's rows, typed gaps where a row is missing)
  const rawOf = Object.fromEntries(Object.keys(lex.russian).map((L) => [foldRu(L), L])), table = {}, sexOfFolded = (f) => { const a = lex.atoms[lex.russian[rawOf[f]]?.en]; return a ? a.sex : null; };
  for (const L of Object.keys(lex.russian).sort()) {
    const en = lex.russian[L].en, atom = lex.atoms[en] ?? null, rows = kinRows.terms[L] ?? null, ants = (rows?.relations?.ant ?? []).flatMap((x) => x.names.filter((n) => n.endsWith("/ru")).map((n) => foldRu(n.slice(0, -3))));
    let sex = atom ? atom.sex : null, sexGap = atom ? (atom.sex === null ? "no_sex_in_gloss" : null) : "composite_no_sex", store = "no_row";
    if (ants.length) { const partners = ants.map((a) => sexOfFolded(a)).filter((x) => x); store = partners.length ? (partners.every((x) => sex && x !== sex) ? "ant_agrees" : "store_disagrees") : "ant_partner_not_a_kin_lemma"; if (store === "store_disagrees") { sex = null; sexGap = "store_disagrees"; } }
    else if (rows) store = (rows.relations.syn ?? []).length ? "syn_only" : "no_row";
    table[foldRu(L)] = { lemma: L, en, rel: atom?.rel ?? null, end: atom?.end ?? null, sex, sexGap, store };
  }
  // ---- KIND INDUCTION: company evidence per mention, the shuffled-company null per being
  const ctx = mentions.map((mn) => { const c = { ref: mn.ref, ev: 0, sex: null };
    for (let k = mn.first + 1; k <= mn.last; k++) if (PATRO.test(toks[k].f)) { c.ev = 1; c.sex = PATRO_F.test(toks[k].f) ? "Fem" : "Masc"; }
    if (toks[mn.first - 1]?.pos !== "ADP") for (let k = mn.last + 1, n = 0; k < toks.length && n < 4; k++, n++) { const t = toks[k]; if (t.mention || HARD.test(gapBetween(k - 1, k))) break;
      if (isVerb(t)) { if (/(ла|лась)$/.test(t.f)) { c.ev = 1; c.sex ??= "Fem"; } else if (/(л|лся)$/.test(t.f)) { c.ev = 1; c.sex ??= "Masc"; } break; } }
    return c; });
  const refs = [...beingsSet].sort(), mCount = new Map(refs.map((r) => [r, 0])), eReal = new Map(refs.map((r) => [r, 0]));
  for (const c of ctx) if (mCount.has(c.ref)) { mCount.set(c.ref, mCount.get(c.ref) + 1); eReal.set(c.ref, eReal.get(c.ref) + c.ev); }
  const rng = mulberry32(PARAMS.SEED), labels = ctx.map((c) => c.ref), draws = new Map(refs.map((r) => [r, []]));
  for (let d = 0; d < PARAMS.NULL_DRAWS; d++) { for (let i = labels.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [labels[i], labels[j]] = [labels[j], labels[i]]; }
    const e = new Map(); for (let i = 0; i < ctx.length; i++) if (ctx[i].ev) e.set(labels[i], (e.get(labels[i]) ?? 0) + 1); for (const r of refs) draws.get(r).push(e.get(r) ?? 0); }
  const nullP95 = new Map(refs.map((r) => [r, pct(draws.get(r), 0.95)]));
  const votes = new Map(refs.map((r) => [r, { Masc: 0, Fem: 0 }])); for (const c of ctx) if (c.sex && votes.has(c.ref)) votes.get(c.ref)[c.sex]++;
  const anchored = new Set();                                  // the page layer's own ties: a person, and the holder's sex is the term's
  for (const s of base.statements) { const sx = lex.atoms[s.term]?.sex;
    for (const end of ["holder", "possessor"]) if (s[end].ref && beingsSet.has(s[end].ref)) { anchored.add(s[end].ref); if (end === "holder" && sx) votes.get(s[end].ref)[sx === "male" ? "Masc" : "Fem"]++; } }
  // ---- KIND BY COMPANY SIMILARITY (the kind-induction organ's own reading: a kind is the beings whose company resembles it; DECLARED_THRESHOLD 0.2 is that organ's declared cut, never fit to a gold): company(b) = the words within three tokens of a mention of b
  // (a word's stem is its first five letters), weighted by inverse being-frequency (a word every being keeps is weightless: no stop list); the person kind is seeded by the anchors (the page layer's tie ends and the beings with a patronymic) and a being belongs to it when the cosine of
  // its company with the anchors' centroid (leave-one-out for an anchor) reaches the cut AND exceeds the p95 of the same cosine under SHUFFLED COMPANY (the (being, word) pairs permuted among the beings, seeded).
  const stem = (f) => f.slice(0, 5), company = new Map(refs.map((r) => [r, new Map()]));
  for (const mn of mentions) { if (!company.has(mn.ref)) continue; const c = company.get(mn.ref); for (const k of [mn.first - 3, mn.first - 2, mn.first - 1, mn.last + 1, mn.last + 2, mn.last + 3]) { const t = toks[k]; if (!t || t.mention) continue; const w = stem(t.f); c.set(w, (c.get(w) ?? 0) + 1); } }
  const pairs = []; for (const [r, c] of company) for (const [w, n] of c) for (let i = 0; i < n; i++) pairs.push([r, w]);
  const vecsOf = (assign) => { const m = new Map(refs.map((r) => [r, new Map()])); for (const [r, w] of assign) { const c = m.get(r); c.set(w, (c.get(w) ?? 0) + 1); } return m; };
  const idfOf = (m) => { const df = new Map(); for (const c of m.values()) for (const w of c.keys()) df.set(w, (df.get(w) ?? 0) + 1); return (w) => Math.log((refs.length + 1) / ((df.get(w) ?? 0) + 1)); };
  const anchorSet = new Set([...anchored, ...mentions.filter((mn) => { for (let k = mn.first + 1; k <= mn.last; k++) if (PATRO.test(toks[k].f)) return true; return false; }).map((mn) => mn.ref)].filter((r) => beingsSet.has(r)));
  const cosVs = (m, anchorsIn) => { const idf = idfOf(m), cen = new Map(), out = new Map(); for (const a of anchorsIn) for (const [w, n] of m.get(a)) cen.set(w, (cen.get(w) ?? 0) + n * idf(w));
    for (const r of refs) { const own = new Map(); if (anchorsIn.has(r)) for (const [w, n] of m.get(r)) own.set(w, n * idf(w)); let dot = 0, nb = 0, nc = 0; const v = m.get(r);
      for (const [w, n] of v) { const x = n * idf(w), y = (cen.get(w) ?? 0) - (own.get(w) ?? 0); dot += x * y; nb += x * x; }
      for (const [w, y0] of cen) { const y = y0 - (own.get(w) ?? 0); nc += y * y; } out.set(r, nb && nc ? dot / Math.sqrt(nb * nc) : 0); } return out; };
  const simReal = cosVs(vecsOf(pairs), anchorSet), simNull = new Map(refs.map((r) => [r, []])), rngC = mulberry32(PARAMS.SEED + 1), NULLC = Math.min(PARAMS.NULL_DRAWS, 200);
  for (let d = 0; d < NULLC; d++) { const ws = pairs.map((x) => x[1]); for (let i = ws.length - 1; i > 0; i--) { const j = Math.floor(rngC() * (i + 1)); [ws[i], ws[j]] = [ws[j], ws[i]]; } const sims = cosVs(vecsOf(pairs.map((x, i) => [x[0], ws[i]])), anchorSet); for (const r of refs) simNull.get(r).push(sims.get(r)); }
  const companyKind = new Map(refs.map((r) => [r, { sim: simReal.get(r), null_p95: pct(simNull.get(r), 0.95), person: anchorSet.has(r) || (simReal.get(r) >= DECLARED_THRESHOLD && simReal.get(r) > pct(simNull.get(r), 0.95)) }]));
  const kinds = new Map();
  for (const r of refs) { const sk = storeKind(beingRows, r), v = votes.get(r), ev = eReal.get(r), induced = induction === "any" ? ev >= 1 : induction === "company" ? companyKind.get(r).person : ev >= 1 && ev > nullP95.get(r);
    const person = sk !== "common" && (anchored.has(r) || induced), sex = v.Masc && v.Fem ? null : v.Masc ? "Masc" : v.Fem ? "Fem" : null;
    kinds.set(r, { person, sex, store: sk, mentions: mCount.get(r), evidence: ev, null_p95: nullP95.get(r), anchored: anchored.has(r), conflict: !!(v.Masc && v.Fem), company_sim: companyKind.get(r).sim, company_null_p95: companyKind.get(r).null_p95 }); }
  // ---- POLARITY of each kin statement. NEGATED (the relation is denied): an EXIST cue (a gloss that says the thing is absent: «нет», «без») within two words before the kin word; or a negation cue directly before a copula (a token the part-of-speech prior tags AUX) that precedes the kin word in its clause;
  // or a negation cue directly before the kin word when the kin word stands in the lemma's own (nominative) form, a predicate: «не брат». A negation cue before a kin word in another case negates the event, not the relation (the verb's «не мужа»): the relation stays affirmed, the cue is recorded.
  // FORMER (the relation no longer holds): a 'former' cue directly before the kin word.
  const pol = base.statements.map((s) => { const ti = P.tokAtByte.get(s.termAt[0]); if (ti == null) return { read: "affirmed", cue: null };
    const cueAt = (k) => { const t = toks[k]; return t ? polarity.forms[t.f] ?? null : null; }, clauseOK = (a, b) => !/[,;:!?.—–]/.test(gapBetween(a, b)), nominative = foldRu(toks[ti].raw) === foldRu(s.lemma ?? "");
    for (let k = ti - 1; k >= 0 && ti - k <= 2 && clauseOK(k, ti); k--) { const c = cueAt(k); if (c && c.cue === "exist") return { read: "negated", cue: toks[k].f }; }
    const c1 = ti >= 1 && clauseOK(ti - 1, ti) ? cueAt(ti - 1) : null; if (c1 && c1.cue === "former") return { read: "former", cue: toks[ti - 1].f };
    for (let k = ti - 1; k >= 1 && ti - k <= 4 && clauseOK(k, ti); k--) if (toks[k].pos === "AUX") { const c = cueAt(k - 1); if (c && c.cue === "neg") return { read: "negated", cue: toks[k - 1].f }; }
    if (c1 && c1.cue === "neg") return nominative ? { read: "negated", cue: toks[ti - 1].f } : { read: "affirmed", cue: null, event_negation_cue: toks[ti - 1].f };
    return { read: "affirmed", cue: null }; });
  return { P, table, kinds, pol, isVerb, beingsSet, beingRows };
}

/** apply: the rules over a prepared structure. opts: gate (true: the kind gate; false: any being, no sex gate: the ablation KG0), polarityOn (false: facts regardless of polarity: KP0), kindMap (a Map ref -> kind record replacing the induced kinds: the shuffled-kind control), sexStrict (a holder candidate must have a known sex when the term has one). */
export function applyKind(K, { gate = true, polarityOn = true, kindMap = null, sexStrict = false } = {}) {   // the registered arm: gate true, polarityOn true, sexStrict false
  const { P, table, pol, isVerb } = K, { toks, sents, base, lex, gapBetween } = P, kinds = kindMap ?? K.kinds;
  const person = (r) => !gate || !!kinds.get(r)?.person;
  const sexOk = (r, tsex) => { if (!gate || !tsex) return true; const x = kinds.get(r)?.sex; if (!x) return !sexStrict; return x === (tsex === "male" ? "Masc" : "Fem"); };
  const out = base.statements.map((s) => ({ ...s, holder: { ...s.holder }, possessor: { ...s.possessor }, uses: [] }));
  const stmtsBySent = new Map(); out.forEach((s, k) => { const ti = P.tokAtByte.get(s.termAt[0]); if (ti == null) return; (stmtsBySent.get(toks[ti].sent) ?? stmtsBySent.set(toks[ti].sent, []).get(toks[ti].sent)).push({ k, ti }); });
  const sentsOfPara = new Map(); for (const S of sents) (sentsOfPara.get(S.pi) ?? sentsOfPara.set(S.pi, []).get(S.pi)).push(S);
  // the window's own page ties (both ends), as converse facts
  const store = []; base.statements.forEach((b0) => { const term = lex.atoms[b0.term]; if (b0.holder.ref && b0.possessor.ref && term) { const h = b0.holder.ref, p = b0.possessor.ref, mention = { bs: b0.holder.mention[0], be: b0.holder.mention[1], text: b0.holder.text };
    store.push(term.rel === "parent_of" ? (term.end === "a" ? { rel: "parent_of", parent: h, child: p, mention } : { rel: "parent_of", parent: p, child: h, mention }) : { rel: term.rel, a: h, b: p, mention }); } });
  const bindEnd = (rec, end, ref, mention, rule, usedAt) => { rec[end] = { ref, rule, mention: [mention.bs, mention.be], text: mention.text }; rec.uses.push([mention.bs, mention.be]); if (usedAt) rec.uses.push(usedAt); };
  for (const S of sents) {
    // clause subjects of this sentence: the first person-kind being of each comma-delimited clause before its first verb, not after a preposition
    const subjs = []; for (const seg of S.segs ?? []) { const firstVerb = seg.tokens.find((i) => isVerb(toks[i])) ?? Infinity; const nm = S.named.find((x) => seg.tokens.includes(x.i) && x.i < firstVerb && !x.adp && person(x.ref)); if (nm) subjs.push(nm); }
    for (const { k, ti } of stmtsBySent.get(S.sid) ?? []) {
      const rec = out[k], T = toks[ti], term = lex.atoms[rec.term] ?? null, speech = T.speech, row = table[foldRu(rec.lemma ?? "")] ?? null;
      if (!rec.possessor.ref && rec.possessor.gap === "no_marker") {
        if (speech) rec.possessor = { ref: null, gap: "kind_bare_in_speech" };
        else { const sb = subjs.filter((x) => x.i < ti).pop(); if (!sb) rec.possessor = { ref: null, gap: "kind_no_subject" }; else if (sb.ref !== rec.holder.ref) bindEnd(rec, "possessor", sb.ref, sb.mention, "K-SUBJ", null); }
      }
      if (!rec.holder.ref && rec.possessor.ref && !speech && term) {
        const Pr = rec.possessor.ref, tsex = row ? row.sex : term.sex;
        const pc = term.rel === "parent_of" ? (term.end === "a" ? (f) => (f.child === Pr ? f.parent : null) : (f) => (f.parent === Pr ? f.child : null)) : (f) => (f.a === Pr ? f.b : f.b === Pr ? f.a : null);
        const rows = store.filter((f) => f.rel === term.rel).map((f) => ({ f, x: pc(f) })).filter((q) => q.x && q.x !== Pr && sexOk(q.x, tsex)), refs = [...new Set(rows.map((q) => q.x))];
        if (refs.length === 1) bindEnd(rec, "holder", refs[0], rows.find((q) => q.x === refs[0]).f.mention, "K-CONV", null);
        else if (refs.length > 1) rec.holder = { ref: null, gap: "kind_converse_ambiguous" };
        else {
          const cand = (list) => [...new Set(list)].filter((r) => r !== Pr && person(r) && sexOk(r, tsex));
          let cs = cand(S.present), pool = S.named; if (!cs.length) { const par = sentsOfPara.get(S.pi); cs = cand(par.flatMap((x) => x.present)); pool = par.flatMap((x) => x.named); }
          if (cs.length === 1) { const hit = pool.find((x) => x.ref === cs[0]); if (hit) bindEnd(rec, "holder", cs[0], hit.mention, "K-OTHER", null); else rec.holder = { ref: null, gap: "kind_no_candidate" }; }
          else rec.holder = { ref: null, gap: cs.length > 1 ? "kind_ambiguous" : "kind_no_candidate" };
        }
        if (row && row.sexGap === "store_disagrees" && !rec.holder.ref) rec.holder = { ref: null, gap: "store_disagrees" };
      }
      if (rec.holder.ref && rec.possessor.ref && rec.holder.ref === rec.possessor.ref) rec.possessor = { ref: null, gap: "one_referent_both_ends" };
    }
  }
  return assemble(K, out, polarityOn);
}

// ---- facts, typed gaps and opinion slots (as scene-kin.mjs and bind-kin2.mjs assemble them); a statement read `negated` or `former` ties its ends and emits no fact
function assemble(K, recs, polarityOn) {
  const { P, pol } = K, { base, lex } = P, specs = [], statements = [];
  const slotFor = (term, rec, end) => { const h = end === "holder" ? "?" : rec.holder.ref ?? "?", p = end === "possessor" ? "?" : rec.possessor.ref ?? "?";
    if (!term) return { rel: "term", term: rec.term, a: h, b: p }; if (term.rel === "parent_of") return term.end === "a" ? { rel: "parent_of", a: h, b: p } : { rel: "parent_of", a: p, b: h }; return { rel: term.rel, a: h, b: p }; };
  recs.forEach((rec, pos) => {
    const term = lex.atoms[rec.term] ?? null, gaps = [];
    for (const end of ["holder", "possessor"]) if (!rec[end].ref) {
      const kind = term ? (term.rel === "parent_of" ? "no_parent_fact" : term.rel === "sibling_of" ? "no_sibling_fact" : "no_spouse_fact") : "no_rule_giver";
      const slot = slotFor(term, rec, end), gap = { kind, slot, why: rec[end].gap, end, opinionFillable: GAP_KINDS[kind].opinionFillable };
      if (gap.opinionFillable && term) gap.opinionSlot = opinionSlot({ term: rec.term, of: (end === "holder" ? rec.possessor.ref : rec.holder.ref) ?? "?", statement: `ru#${rec.termAt[0]}-${rec.termAt[1]}` }, { kind, slot });
      else if (!term) gap.opinionSlotAbsent = "a stated composite term is not fileable through kinship.js fileOpinion";
      gaps.push(gap);
    }
    let fact = null; const polarity = pol[pos], withheld = polarityOn && polarity.read !== "affirmed";
    if (rec.holder.ref && rec.possessor.ref && !withheld) {
      const all = [...rec.uses, ...(rec.holder.mention ? [rec.holder.mention] : []), ...(rec.possessor.mention ? [rec.possessor.mention] : [])];
      const lo = Math.min(rec.termAt[0], ...all.map((u) => u[0])), hi = Math.max(rec.termAt[1], ...all.map((u) => u[1]));
      const giver = `text:ru|rule:${[...new Set([rec.holder.rule, rec.possessor.rule])].sort().join("+")}`, witness = `ru#${lo}-${hi}`, h = rec.holder.ref, p = rec.possessor.ref, sp = [];
      if (term) { sp.push(term.rel === "parent_of" ? (term.end === "a" ? { rel: "parent_of", a: h, b: p } : { rel: "parent_of", a: p, b: h }) : { rel: term.rel, a: h, b: p }); if (term.sex) sp.push({ rel: "sex", a: h, value: term.sex }); }
      else sp.push({ rel: "term", term: rec.term, a: h, b: p });
      for (const x of sp) Object.assign(x, { giver, witness, standing: "candidate" });
      for (const x of sp) { const r = makeFact(x); if (r.refused) throw new Error(`kind-kin: makeFact refused its own spec (${r.refused})`); }
      specs.push(...sp); fact = { giver, witness, specs: sp.length };
    }
    statements.push({ i: rec.i, term: rec.term, lemma: rec.lemma, termAt: rec.termAt, plain: rec.plain, holder: rec.holder, possessor: rec.possessor, polarity, fact, fact_withheld_by_polarity: rec.holder.ref && rec.possessor.ref && withheld ? true : false, gaps });
  });
  const n = (f) => statements.filter(f).length;
  return { schema: KIND_SCHEMA, params: PARAMS, text_sha256: base.text_sha256, ledger_text_sha256: base.ledger_text_sha256,
    counts: { statements: statements.length, facts: n((s) => s.fact), facts_withheld_by_polarity: n((s) => s.fact_withheld_by_polarity), holders_bound: n((s) => s.holder.ref), possessors_bound: n((s) => s.possessor.ref), gaps: statements.reduce((a, s) => a + s.gaps.length, 0),
      polarity_read: { negated: n((s) => s.polarity.read === "negated"), former: n((s) => s.polarity.read === "former") } }, statements, specs };
}

/** kindKin({...}) -> KindKin@1 (the registered arm). */
export function kindKin(args, opts) { return applyKind(prepareKind(args), opts); }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
  const { extract } = await import("./extract-kin.mjs");
  const need = ["text", "ledger", "beings", "polarity", "kin-rows", "out"]; if (need.some((k) => !arg(k))) { console.error("usage: node kind-kin.mjs --text <text> --ledger <KinLedger.json> --beings <KinStoreBeings.json> --polarity <PolarityLexicon.json> --kin-rows <KinStoreRows.json> --out <KindKin.json> [--priors <dir>]"); process.exit(2); }
  const priors = loadPriors(arg("priors") ?? undefined), text = fs.readFileSync(arg("text"), "utf8"), j = (k) => JSON.parse(fs.readFileSync(arg(k), "utf8"));
  const extraction = extract({ text, lang: "ru", lexicon: priors.lexicon, namePartsRu: priors.nameParts });
  const res = kindKin({ text, ledger: j("ledger"), extraction, priors, beingRows: j("beings"), polarity: j("polarity"), kinRows: j("kin-rows") });
  fs.writeFileSync(arg("out"), JSON.stringify(res, null, 1) + "\n"); console.log(JSON.stringify(res.counts));
}
