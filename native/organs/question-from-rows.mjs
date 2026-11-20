// organs/question-from-rows.mjs: a QUESTION read by the same reader rows as a statement (no regex, no string match on the question): the parse becomes a PATTERN with a hole, and the hole is answered by a query over the claims.
// A wh word is a token the parser marks (PronType=Rel|Int), never a word list; a negation is the feature Polarity=Neg; the relation is composed the way claims-from-rows composes it (verb lemma, or verb lemma + the oblique's case).
//   hole-b   "Where does Tom live now?"      wh adverb on the verb: the place is the hole     -> { kind, lemma, a: "Tom" }
//   hole-a   "Who lives in Leeds?"           wh pronoun as the subject: the subject is the hole -> { kind, rel: "live_in", b: "Leeds" }
//   polar    "Does Anna work at Zebra?"      no wh: the claim the rows state, to be TESTED       -> { kind, rel: "work_at", a: "Anna", b: "Zebra" }
// `order` is "current" unless the parser gives an adverb the closed temporal list below calls earlier. "Current" is only meaningful for a relation a giver declared single-valued: answer() refuses to pick one value otherwise (a typed gap, not a guess).
// What it does NOT read, and says so: a nested question the parser breaks (a relative clause under a wh word), a comparison, an open "could/might" question. Those are typed gaps and the caller sends them to the model.
const featsOf = (r) => { const m = new Map(); for (const part of String(r.feats ?? "").split("|")) { const i = part.indexOf("="); if (i > 0) m.set(part.slice(0, i), part.slice(i + 1)); } return m; };
const wh = (r) => ["ADV", "PRON"].includes(r.upos) && ["Rel", "Int"].includes(featsOf(r).get("PronType"));
const EARLIER = new Set(["before", "previously", "earlier", "formerly"]);   // a closed-class temporal lexicon, data
const phrase = (rs, r) => [r, ...rs.filter((k) => k.head === r.id && ["compound", "flat", "flat:name"].includes(k.deprel))].sort((p, q) => p.id - q.id).map((x) => x.form).join(" ");
export const lemmaOf = (rel) => String(rel).split("_")[0];
export function questionPattern(rows) {
  const root = rows.find((r) => r.head === 0 && r.upos === "VERB");
  if (!root) return { gap: "no_verb_root", note: "the parser gave this question no verb root (a nested or broken parse): not read, not guessed" };
  const kids = rows.filter((r) => r.head === root.id), by = (d) => kids.filter((r) => r.deprel === d);
  if (rows.some((r) => r.deprel === "acl:relcl")) return { gap: "nested_not_read", note: "a relative clause inside the question: needs the nested form, not built" };
  const subj = by("nsubj")[0], obl = by("obl")[0], cs = obl ? rows.find((r) => r.head === obl.id && r.deprel === "case") : null;
  const order = kids.some((r) => r.deprel === "advmod" && EARLIER.has(r.lemma)) ? "previous" : "current", neg = featsOf(root).get("Polarity") === "Neg";
  const whAdv = kids.find((r) => r.deprel === "advmod" && wh(r));
  if (whAdv && subj) return { kind: "hole-b", lemma: root.lemma, a: phrase(rows, subj), order, neg };
  if (subj && wh(subj) && obl && cs) return { kind: "hole-a", rel: `${root.lemma}_${cs.lemma}`, b: phrase(rows, obl), order, neg };
  if (subj && !wh(subj) && obl && cs && !kids.some(wh)) return { kind: "polar", rel: `${root.lemma}_${cs.lemma}`, a: phrase(rows, subj), b: phrase(rows, obl), order, neg };
  return { gap: "unrecognised_shape", note: `the question has a verb (${root.lemma}) but no hole or test shape this reader knows` };
}
/** answer(pattern, claims, { functional }) over the claims { rel, a, b, polarity, at } (what the log holds): { finding, how } or a typed gap. `functional` = the lemmas a giver declared single-valued. */
export function answer(p, claims, { functional = [] } = {}) {
  if (!p || p.gap) return p ?? { gap: "no_pattern" };
  const turn = (c) => +String(c.at ?? "s0").slice(1), pos = claims.filter((c) => c.polarity !== "-");
  const values = (a, test) => pos.filter((c) => c.a === a && test(c.rel)).sort((x, y) => turn(y) - turn(x));
  if (p.kind === "hole-b") {
    const vs = values(p.a, (r) => lemmaOf(r) === p.lemma); if (!vs.length) return { gap: "not_on_record", note: `no ${p.lemma} mark for ${p.a}` };
    if (!functional.includes(p.lemma)) return { gap: "no_single_value_prior", note: `${p.lemma} is not declared single-valued, so "current" is not decided; the marks say: ${vs.map((c) => `${c.b} (turn ${turn(c) + 1})`).join(", ")}`, marks: vs };
    const v = p.order === "previous" ? vs[1] : vs[0]; if (!v) return { gap: "no_earlier_value", note: `${p.a} has one ${p.lemma} mark only` };
    return { how: p.order === "previous" ? "supersession (second latest)" : "latest of a single-valued relation", finding: p.order === "previous" ? `${p.a} ${v.rel.replace(/_/g, " ")} ${v.b} (turn ${turn(v) + 1}) before ${vs[0].b} (turn ${turn(vs[0]) + 1}).` : `${p.a} ${v.rel.replace(/_/g, " ")} ${v.b} (turn ${turn(v) + 1}).`, value: v.b };
  }
  if (p.kind === "hole-a") {
    const lemma = lemmaOf(p.rel); if (!functional.includes(lemma)) return { gap: "no_single_value_prior", note: `${lemma} is not declared single-valued: who holds it "now" is not decided` };
    const who = [...new Set(pos.filter((c) => c.rel === p.rel).map((c) => c.a))].filter((a) => { const v = values(a, (r) => lemmaOf(r) === lemma)[0]; return v && v.rel === p.rel && v.b === p.b; }).sort();
    return { how: "inverse lookup over the latest mark of each being", finding: who.length ? `${who.join(", ")} ${who.length === 1 ? "is" : "are"} on record as ${p.rel.replace(/_/g, " ")} ${p.b} now.` : `no one is on record as ${p.rel.replace(/_/g, " ")} ${p.b} now.`, value: who };
  }
  if (p.kind === "polar") {
    const lemma = lemmaOf(p.rel), vs = values(p.a, (r) => lemmaOf(r) === lemma);
    if (vs.some((c) => c.rel === p.rel && c.b === p.b)) return { how: "the stated claim is on record", finding: `Yes: ${p.a} ${p.rel.replace(/_/g, " ")} ${p.b} (turn ${turn(vs.find((c) => c.rel === p.rel && c.b === p.b)) + 1}).`, value: true };
    if (!vs.length) return { gap: "not_on_record", note: `silence is a hole, never a no: nothing about ${p.a} ${lemma}` };
    if (!functional.includes(lemma)) return { gap: "no_single_value_prior", note: `${p.a} ${lemma} ${vs.map((c) => c.b).join(", ")} is on record, but ${lemma} is not declared single-valued, so ${p.b} is not ruled out` };
    return { how: "single-value contradiction", finding: `No: ${p.a} ${vs[0].rel.replace(/_/g, " ")} ${vs[0].b} (turn ${turn(vs[0]) + 1}), not ${p.b}.`, value: false };
  }
  return { gap: "unsupported_kind" };
}
