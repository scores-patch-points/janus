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
// `where` is the sentence ("s<n>") inside the document; the caller gives the document ground. A value is a literal when its head is a number or an adjective, a referent otherwise.
const PHRASE = new Set(["compound", "flat", "flat:name"]);
const isNeg = (r) => /Polarity=Neg/.test(String(r.feats ?? ""));
const num = (r) => r.upos === "NUM";
export function claimsFromRows(rows, { doc = "doc" } = {}) {
  const claims = [], gaps = [], bySent = new Map();
  for (const r of rows) { if (!bySent.has(r.s)) bySent.set(r.s, []); bySent.get(r.s).push(r); }
  for (const [s, rs] of bySent) {
    const kids = (id) => rs.filter((r) => r.head === id), by = (id, d) => kids(id).filter((r) => r.deprel === d || r.deprel.startsWith(`${d}:`));
    const phrase = (r) => [r, ...kids(r.id).filter((k) => PHRASE.has(k.deprel)).flatMap((k) => [k, ...kids(k.id).filter((x) => PHRASE.has(x.deprel))])].sort((p, q) => p.id - q.id).map((x) => x.form).join(" ");
    const value = (r) => (num(r) ? { b: r.form, object: "literal" } : r.upos === "ADJ" ? { b: r.lemma, object: "literal" } : r.upos === "PRON" ? null : { b: phrase(r), object: "referent" });
    const caseOf = (r) => by(r.id, "case")[0]?.lemma ?? null;
    const yearOf = (r) => { for (const o of [...by(r.id, "obl"), ...by(r.id, "nmod")]) if (num(o) && caseOf(o)) return o.form; return null; };
    const where = `s${s}`, push = (c) => claims.push({ polarity: "+", where, ...c });
    const unbound = (r, id) => gaps.push({ kind: "unbound_pronoun", s, id, note: `${r.form} is a pronoun: no coreference here, so no claim is made about it` });
    for (const c of rs.filter((r) => r.deprel === "conj")) gaps.push({ kind: "conj_not_expanded", s, id: c.id, note: `${c.form} is coordinated with another word: the coordination is not expanded, so its claims are not made` });
    for (const v of rs) {
      const subj = by(v.id, "nsubj")[0], cop = by(v.id, "cop")[0], neg = isNeg(v) || kids(v.id).some(isNeg), when = yearOf(v);
      const mk = (a, rel, b, extra = {}) => { push({ rel, a: a.b ?? a, b: b.b, object: b.object, ...(neg ? { polarity: "-" } : {}), ...(when ? { when } : {}), ...extra }); };
      if (v.upos === "VERB") {
        const passive = !!by(v.id, "nsubj").find((k) => k.deprel === "nsubj:pass"), agent = by(v.id, "obl").find((k) => k.deprel === "obl:agent" || (caseOf(k) === "by" && passive));
        let A = null, B = [];
        if (passive) { A = agent ? value(agent) : null; const p = subj ? value(subj) : null; if (p) B.push({ rel: v.lemma, ...p }); if (subj && !p) unbound(subj, subj.id); if (!agent) gaps.push({ kind: "no_subject", s, id: v.id, note: "passive with no agent" }); }
        else if (!subj) gaps.push({ kind: "no_subject", s, id: v.id, note: `${v.lemma} has no subject in this sentence` });
        else { A = value(subj); if (!A) unbound(subj, subj.id); for (const o of [...by(v.id, "obj"), ...by(v.id, "iobj")]) { const x = value(o); if (x) B.push({ rel: v.lemma, ...x }); else unbound(o, o.id); }
          for (const o of by(v.id, "obl")) { if (num(o) && caseOf(o)) continue; const c = caseOf(o), x = value(o); if (c && x) B.push({ rel: `${v.lemma}_${c}`, ...x }); else if (c && !x) unbound(o, o.id); } }
        if (A) for (const b of B) mk(A, b.rel, b);
      }
      if (cop && subj) { const A = value(subj); if (!A) unbound(subj, subj.id); else { const x = value(v); if (x) mk(A, "is", x); } }
      // a noun's own obliques: (head noun, preposition, value)
      if (["NOUN", "PROPN"].includes(v.upos)) for (const o of by(v.id, "nmod")) { if (num(o)) continue; const c = caseOf(o), x = value(o); if (c && x) push({ rel: c, a: phrase(v), b: x.b, object: x.object, ...(isNeg(v) ? { polarity: "-" } : {}) }); }
    }
  }
  return { claims, gaps, grounds: { where: Object.fromEntries([...bySent.keys()].map((s) => [`s${s}`, doc])) } };
}
