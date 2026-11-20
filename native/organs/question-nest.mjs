// organs/question-nest.mjs: a NESTED question: a noun phrase that carries a relative clause ("the person Maria hired", "the city Tom moved to") is a SUB-QUESTION whose answer fills the outer one. Found by the parser's tags (a NOUN with an acl:relcl child verb that has its own subject), cut out by the tokens' character offsets, answered from the marks, and each value substituted into the outer question, which is then judged as any other.
// No regex, no word list. The span runs from the noun phrase's first token to the relative verb (plus a stranded preposition the parser tags as its oblique: "moved to"); everything after belongs to the outer clause. The outer text is re-read with a placeholder PROPN in the cut's place.
// The COMPOSITION is the asker's: a relative clause asks "the ones X <verb>"; that is a prior with a named giver (the asker, by asking), recorded in the standing's basis, never presented as something the text said. When the inner relation has no marks, the answer is a hole that lists the candidate priors (the relations the being does have marks for) as NOMINATIONS with no giver, never a guess and never a license.
import { lemmaOf } from "./question-from-rows.mjs";
const feat = (r, k) => String(r.feats ?? "").split("|").map((p) => p.split("=")).find((p) => p[0] === k)?.[1];
const PLACEHOLDER = "Someone";
export function nestOf(rows, text) {
  for (const n of rows.filter((r) => ["NOUN", "PROPN"].includes(r.upos))) {
    const V = rows.find((k) => k.head === n.id && k.deprel === "acl:relcl" && k.upos === "VERB"); if (!V) continue;
    const S = rows.find((k) => k.head === V.id && k.deprel === "nsubj" && !["Rel", "Int"].includes(feat(k, "PronType"))); if (!S) continue;
    const stranded = rows.filter((k) => k.head === V.id && ["ADP", "PART"].includes(k.upos) && ["obl", "case"].includes(k.deprel)), det = rows.filter((k) => k.head === n.id && k.deprel === "det");
    const ends = [V, ...stranded], toks = [n, S, V, ...stranded, ...det]; if (toks.some((t) => t.at == null || t.end == null)) continue;
    const start = Math.min(...toks.map((t) => t.at)), end = Math.max(...ends.map((t) => t.end));
    return { span: [start, end], np: text.slice(start, end), inner: { lemma: V.lemma, rel: stranded.length ? `${V.lemma}_${stranded[0].lemma}` : V.lemma, a: S.form }, outerText: `${text.slice(0, start)}${PLACEHOLDER}${text.slice(end)}` };
  }
  return null;
}
/** compose(nest, { read, marks, judge, functional, giver }) -> { kind: "nested", standing, finding, basis, parts } | { standing: "gap"|"hole", needs } ; `judge(rows)` judges one outer reading */
export function compose(nest, { read, marks, judge, giver = "asker" }) {
  const vals = marks.filter((m) => m.polarity !== "-" && m.a === nest.inner.a && lemmaOf(m.rel) === lemmaOf(nest.inner.rel) && (!nest.inner.rel.includes("_") || m.rel === nest.inner.rel)).sort((x, y) => +String(x.at).slice(1) - +String(y.at).slice(1));
  if (!vals.length) {
    const has = [...new Set(marks.filter((m) => m.a === nest.inner.a && m.polarity !== "-").map((m) => m.rel))];
    return { kind: "nested", standing: "hole", basis: { material: [], priors: [] }, note: `${nest.np}: no ${nest.inner.rel} mark for ${nest.inner.a}`, candidate_priors: has.map((r) => ({ kind: "relation_equivalence", left: nest.inner.rel, right: r, standing: "nominated", giver: null, why: `${nest.inner.a} has ${r} marks; a NOMINATION only: it would answer this if a named giver declared ${nest.inner.rel} the same relation, and nothing here says so` })) };
  }
  const outer = read(nest.outerText), parts = vals.map((v) => { const rows = outer.map((r) => (r.form === PLACEHOLDER ? { ...r, form: v.b, upos: "PROPN" } : r)); return { value: v.b, turn: `turn ${+String(v.at).slice(1) + 1}`, j: judge(rows) }; });
  const sts = parts.map((p) => p.j.standing), all = (x) => sts.every((v) => v === x), standing = all("stands") ? "stands" : all("contradicted") ? "contradicted" : all("gap") ? "gap" : "hole";   // a partly answered set is a hole: the parts are listed in the finding
  const mat = [...new Set([...parts.map((p) => p.turn), ...parts.flatMap((p) => p.j.basis?.material ?? [])])], pri = [{ kind: "relative_clause_composition", rel: nest.inner.rel, giver }, ...parts.flatMap((p) => p.j.basis?.priors ?? [])];
  return { kind: "nested", standing, basis: { material: mat, priors: pri.filter((p, i) => pri.findIndex((q) => JSON.stringify(q) === JSON.stringify(p)) === i) }, finding: `${nest.np} = ${vals.map((v) => v.b).join(", ")}: ${parts.map((p) => `${p.value}: ${p.j.finding ?? p.j.note}`).join("; ")}`, parts };
}
