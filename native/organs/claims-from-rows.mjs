// organs/claims-from-rows.mjs: the reader's dependency rows -> claims in the shape claim-links.mjs weaves: { rel, a, b, polarity, where, when, object }.
// Pure: rows in, claims and typed gaps out. No model, no word list: roles come from the reader's own tags (dependency relation, part of speech, features).
// What it reads, and the oblique roles the earlier reading missed (khora clauses carry only subject and object):
//   verb + nsubj + obj/iobj             (Bell, defeat, Greene)
//   verb + nsubj + obl with a case      (Members, begin_against, Serbs)        the preposition is part of the relation
//   passive  nsubj:pass + obl:agent     (Bell, defeat, Greene)                 the agent is the subject, the passive subject the object
//   noun + nmod with a case             (campaign, against, Serbs)             a noun's own oblique, so a referent in "against Serbs" is IN a claim
//   copula   nsubj + cop + predicate    (Jack, is, coin) or (Jack, is, tall) literal
//   negation  the feature the parser marks (Polarity=Neg), never the word "not"      -> polarity "-"
//   year      an obl or nmod whose head is a number: it is the claim's `when` (a time is a ground), not a value
// What it does NOT do, and says so as a typed gap: a pronoun subject or value (no coreference here: `unbound_pronoun`), a coordination (`conj_not_expanded`), a verb with no subject (`no_subject`).
// `where` is the DOCUMENT ground the caller gives (the claim holds in the document, so two sentences of one document meet); `at` ("s<n>") is the sentence, provenance only, never a ground. A value is a literal when its head is a number or an adjective, a referent otherwise.
const PHRASE = new Set(["compound", "flat", "flat:name"]);
// structured field access, no pattern matching: the parser's tags are data. feats is "Key=Val|Key=Val"; a deprel is "base:subtype".
const featsOf = (r) => { const m = new Map(); for (const part of String(r.feats ?? "").split("|")) { const i = part.indexOf("="); if (i > 0) m.set(part.slice(0, i), part.slice(i + 1)); } return m; };
const depOf = (r) => { const d = String(r.deprel ?? ""), i = d.indexOf(":"); return i < 0 ? { base: d, sub: null } : { base: d.slice(0, i), sub: d.slice(i + 1) }; };
const CLAUSE_OWN = new Set(["root", "conj", "parataxis", "ccomp"]);        // a clause of these kinds has a subject of its own to find
const isNeg = (r) => featsOf(r).get("Polarity") === "Neg";
const num = (r) => r.upos === "NUM";
/** `bind(at, end) -> face | null` (optional): the reader's own referents. A noun or pronoun whose character span is a mention of a referent takes that referent's FACE as its being, so "he" or "the club" becomes
 *  the named referent the reader bound it to (a measured presence binding, not a guess made here). With no bind, or a token with no offsets or no referent, a pronoun stays an `unbound_pronoun` gap. */
export function claimsFromRows(rows, { doc = "doc", bind = null } = {}) {
  const claims = [], gaps = [], bySent = new Map();
  for (const r of rows) { if (!bySent.has(r.s)) bySent.set(r.s, []); bySent.get(r.s).push(r); }
  for (const [s, rs] of bySent) {
    const kids = (id) => rs.filter((r) => r.head === id), by = (id, d) => kids(id).filter((r) => depOf(r).base === d);
    const phrase = (r) => [r, ...kids(r.id).filter((k) => PHRASE.has(k.deprel)).flatMap((k) => [k, ...kids(k.id).filter((x) => PHRASE.has(x.deprel))])].sort((p, q) => p.id - q.id).map((x) => x.form).join(" ");
    const bound = (r) => (bind && r.at != null ? bind(r.at, r.end ?? r.at) : null);
    const value = (r) => (bound(r) && !num(r) ? { b: bound(r), object: "referent", upos: r.upos } : num(r) ? { b: r.form, object: "literal", upos: r.upos } : r.upos === "ADJ" ? { b: r.lemma, object: "literal", upos: r.upos } : r.upos === "PRON" ? null : { b: phrase(r), object: "referent", upos: r.upos });   // upos: the parser's own tag of the end's head (PROPN, NOUN...): a structural fact, so a claim about a NAME can be told from talk about the discourse
    const conj = (r) => { const out = [r], seen = new Set([r.id]); for (let i = 0; i < out.length; i++) for (const k of by(out[i].id, "conj")) if (!seen.has(k.id)) { seen.add(k.id); out.push(k); } return out; };   // a coordinated word and its coordinates
    const caseOf = (r) => by(r.id, "case")[0]?.lemma ?? null;
    // a PREPOSITION (an adposition) names its own relation; a possessive (the parser's `poss` subtype, or Case=Gen) is the genitive and is named by the CASE. English "Oscar 's": Oscar is nmod:poss and the clitic is a PART case marker, not a preposition (measured on the codecs we hold, 2026-11-20)
    const prepOf = (r) => by(r.id, "case").find((k) => k.upos === "ADP")?.lemma ?? null, genitive = (r) => featsOf(r).get("Case") === "Gen" || depOf(r).sub === "poss";
    const yearOf = (r) => { for (const o of [...by(r.id, "obl"), ...by(r.id, "nmod")]) if (num(o) && caseOf(o)) return o.form; return null; };
    const at = `s${s}`, push = (c) => claims.push({ polarity: "+", where: doc ?? "*", at, ...c });   // the DOCUMENT is the ground the claim holds in; the sentence is provenance (`at`), never a ground: sibling sentences of one document must meet
    const unbound = (r, id) => gaps.push({ kind: "unbound_pronoun", s, id, note: `${r.form} is a pronoun: no coreference here, so no claim is made about it` });
    if (!rs.some((r) => ["VERB", "AUX"].includes(r.upos))) gaps.push({ kind: "no_verb_in_sentence", s, note: "the reader found no verb in this sentence (a verb it tagged as a noun is invisible here): any claim from it is a noun-phrase reading, not a statement, and a missing claim is not silence" });
    for (const c of rs.filter((r) => r.deprel === "conj" && !["NOUN", "PROPN", "NUM", "ADJ", "PRON", "VERB", "AUX"].includes(r.upos))) gaps.push({ kind: "conj_not_expanded", s, id: c.id, note: `${c.form} is coordinated with a word this reader does not expand` });
    for (const v of rs) {
      const own = by(v.id, "nsubj")[0], headRow = rs.find((r) => r.id === v.head), headNoun = headRow && ["NOUN", "PROPN"].includes(headRow.upos) && depOf(v).base === "acl" && depOf(v).sub === "relcl" ? headRow : null, relPron = own && own.upos === "PRON" && featsOf(own).get("PronType") === "Rel" ? headNoun : null, relcl = !own ? headNoun : relPron, subj = relPron ?? own ?? relcl, cop = by(v.id, "cop")[0], neg = isNeg(v) || kids(v.id).some(isNeg), when = yearOf(v);
      const mk = (a, rel, b, extra = {}) => { push({ rel, a: a.b ?? a, aUpos: a.upos ?? null, b: b.b, bUpos: b.upos ?? null, object: b.object, ...(neg ? { polarity: "-" } : {}), ...(when ? { when } : {}), ...extra }); };
      if (v.upos === "VERB") {
        const passive = !!by(v.id, "nsubj").find((k) => k.deprel === "nsubj:pass"), agent = by(v.id, "obl").find((k) => k.deprel === "obl:agent" || (caseOf(k) === "by" && passive));
        let A = null, B = [];
        if (passive) { A = agent ? conj(agent).map(value).filter(Boolean) : null; for (const sj of subj ? conj(subj) : []) { const p = value(sj); if (p) B.push({ rel: v.lemma, ...p }); else unbound(sj, sj.id); } if (!agent) gaps.push({ kind: "no_subject", s, id: v.id, note: "passive with no agent" }); }
        else if (!subj) gaps.push({ kind: CLAUSE_OWN.has(depOf(v).base) ? "no_subject" : "controlled_subject", s, id: v.id, note: `${v.lemma} has no subject of its own${CLAUSE_OWN.has(depOf(v).base) ? "" : " (a controlled or adverbial clause: its subject belongs to another word, not resolved here)"}` });
        else { A = conj(subj).map(value).filter(Boolean); if (!A.length) unbound(subj, subj.id); for (const o0 of [...by(v.id, "obj"), ...by(v.id, "iobj")]) for (const o of conj(o0)) { const x = value(o); if (x) B.push({ rel: v.lemma, ...x }); else unbound(o, o.id); }
          for (const o0 of by(v.id, "obl")) for (const o of conj(o0)) { if (num(o) && caseOf(o0)) continue; const c = caseOf(o0), x = value(o); if (c && x) B.push({ rel: `${v.lemma}_${c}`, ...x }); else if (c && !x) unbound(o, o.id); } }
        for (const a of [].concat(A ?? [])) for (const b of B) mk(a, b.rel, b);
      }
      if (cop && subj) for (const sj of conj(subj)) { const A = value(sj); if (!A) unbound(sj, sj.id); else for (const pv of conj(v)) { const x = value(pv); if (x) mk(A, "is", x); } }
      // a noun's own obliques: (head noun, preposition, value)
      // a GENITIVE names the relation by the CASE, not by a preposition: Greek "tou andros" and English "Oscar's" (once the codec marks Case=Gen) are the same slot, whatever the language
      if (["NOUN", "PROPN"].includes(v.upos)) for (const o0 of by(v.id, "nmod")) for (const o of conj(o0)) { if (num(o)) continue; const c = prepOf(o0) ?? (genitive(o0) ? "gen" : null), x = value(o); if (c && x) push({ rel: c, a: phrase(v), aUpos: v.upos, b: x.b, bUpos: x.upos ?? null, object: x.object, ...(isNeg(v) ? { polarity: "-" } : {}) }); }
    }
  }
  return { claims, gaps, grounds: { where: {} } };
}
