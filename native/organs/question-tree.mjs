// organs/question-tree.mjs: a (compound) QUESTION becomes MARKS in the log, nested: the ask (the verbatim text, INS·Figure), its parts (goals, SEG·Pattern, each citing the ask and holding its character span), the nesting (CON·Figure part_of), and a standing per goal (EVA·Figure, written by the interpreter, citing the goal and the claims it rests on).
// No regex and no string match on the question. The cut is at tokens the PARSER tags (CCONJ, SCONJ, a comma, a sentence end). The ROLE of a connective (antecedent, consequent, contrast, inference, conjunct) is read from a declared closed-class table (`connectives`: a prior with a named giver, never discovered); a connective the table does not hold is not taken as a lead at all: its fragment keeps it and has role "part".
// Each fragment is RE-READ ALONE (the reader is reliable on short clauses, not on a long compound) and judged from its own parse: a modal (AUX) is a judgement; a wh hole or a polar test goes to question-from-rows; a stated claim is a premise tested against the marks. What the reader cannot read is a typed gap carrying the reason, and is never answered.
// Every standing carries its BASIS: `material` (the marks present in what was said, by turn) kept apart from `priors` (a declared rule used, with its named giver): a prior is never counted as something the text said, and a verdict that needed one says which. Standing is: stands | contradicted | hole | judgement | gap. A hole is silence, never a no. `functional` (the relations a giver declared single-valued) is the prior under which "contradicted" and "current" are allowed.
import { questionPattern, answer, lemmaOf } from "./question-from-rows.mjs"; import { nestOf, compose } from "./question-nest.mjs"; import { claimsFromRows } from "./claims-from-rows.mjs";
const feat = (r, k) => String(r.feats ?? "").split("|").map((p) => p.split("=")).find((p) => p[0] === k)?.[1];
export const CONNECTIVES = Object.freeze({ if: "antecedent", then: "consequent", but: "contrast", so: "inference", and: "conjunct" });   // the default giver: the asker's closed-class table
/** cut(rows, text) -> [{ s, lead, role, start, end, text }]: boundaries are parser-tagged tokens; the lead token's lemma, when the table holds it, gives the role */
export function cut(rows, text, connectives = CONNECTIVES) {
  const frags = []; let cur = null;
  const open = (r) => { cur = { s: r.s, lead: null, toks: [] }; frags.push(cur); };
  for (const r of rows) {
    const boundary = !cur || r.s !== cur.s || ["CCONJ", "SCONJ"].includes(r.upos) || r.form === ",";
    if (boundary) open(r);
    if (r.upos === "PUNCT") continue;
    if (!cur.lead && !cur.toks.length && connectives[r.lemma] !== undefined && (["CCONJ", "SCONJ", "ADV"].includes(r.upos))) { cur.lead = r; continue; }   // a leading connective is the fragment's role, not its content
    cur.toks.push(r);
  }
  const lastOf = new Map(); for (const r of rows) lastOf.set(r.s, r);   // a sentence's final token: when it is punctuation it belongs to the LAST fragment ("Who lives in Hull" read without its "?" is a different parse: measured 2026-11-20)
  const kept = frags.filter((f) => f.toks.length), lastFrag = new Map(); for (const f of kept) lastFrag.set(f.s, f);
  return kept.map((f) => { const fin = lastFrag.get(f.s) === f && lastOf.get(f.s)?.upos === "PUNCT" ? lastOf.get(f.s) : null, a = f.toks[0].at, b = fin?.end ?? f.toks.at(-1).end; return { s: f.s, lead: f.lead?.lemma ?? null, role: f.lead ? connectives[f.lead.lemma] : "part", start: a, end: b, text: a != null && b != null ? text.slice(a, b) : f.toks.map((t) => t.form).join(" ") }; });
}
/** judge(fragRows, marks, { functional }) -> { kind, standing, finding, note, claims } for one re-read fragment */
export function judge(rr, marks, { functional = [], giver = "asker", text = null, read = null, depth = 0 } = {}) {
  const nest = text != null && read && depth < 2 ? nestOf(rr, text) : null;   // a noun phrase with a relative clause is a sub-question: answered first, its values substituted into the outer one
  if (nest) return compose(nest, { read, marks, giver, judge: (rows) => judge(rows, marks, { functional, giver, depth: depth + 1 }) });
  if (rr.some((r) => r.upos === "AUX" && r.head && feat(r, "VerbForm") !== "Part" && ["should", "must", "ought", "shall"].includes(r.lemma))) return { kind: "judgement", standing: "judgement", basis: { material: [], priors: [{ kind: "closed_class_modals", giver }] }, note: "a recommendation or obligation: no mark can ground it, and no fact is derived from it" };
  const p = questionPattern(rr);
  if (!p.gap) { const a = answer(p, marks, { functional, giver }); return a.gap ? { kind: p.kind, standing: "hole", basis: { material: [], priors: [] }, note: `${a.gap}: ${a.note}` } : { kind: p.kind, standing: p.kind === "polar" && a.value === false ? "contradicted" : "stands", basis: a.basis, finding: a.finding }; }
  const cl = claimsFromRows(rr, { doc: "q" }).claims;
  if (cl.length) {
    const rs = cl.map((c) => { const lem = lemmaOf(c.rel), same = marks.filter((m) => m.a === c.a && lemmaOf(m.rel) === lem && m.polarity !== "-");
      if (same.some((m) => m.b === c.b)) return { st: "stands", mat: `turn ${+String(same.find((m) => m.b === c.b).at).slice(1) + 1}`, t: `${c.a} ${c.rel.split("_").join(" ")} ${c.b} is on record` };
      if (!same.length) return { st: "hole", t: `no ${lem} mark for ${c.a}` };
      const last = same.sort((x, y) => +String(y.at).slice(1) - +String(x.at).slice(1))[0];
      return functional.includes(lem) ? { st: "contradicted", prior: { kind: "single_value", rel: lem, giver }, mat: `turn ${+String(last.at).slice(1) + 1}`, t: `${c.a} ${last.rel.split("_").join(" ")} ${last.b}, not ${c.b}` } : { st: "hole", t: `${c.a} ${lem} ${same.map((m) => m.b).join("/")} is on record; ${c.b} is not ruled out (${lem} is not declared single-valued)` }; });
    const st = rs.some((x) => x.st === "contradicted") ? "contradicted" : rs.every((x) => x.st === "stands") ? "stands" : "hole";
    return { kind: "premise", standing: st, basis: { material: rs.map((x) => x.mat).filter(Boolean), priors: rs.map((x) => x.prior).filter(Boolean) }, finding: rs.map((x) => x.t).join("; "), claims: cl };
  }
  return { kind: "unread", standing: "gap", basis: { material: [], priors: [] }, note: `${p.gap}: ${p.note}` };
}
/** build(text, rows, { read, marks, functional, connectives }) -> nodes [{ id, parent, role, text, start, end, ...judge }]; `read(fragmentText)` re-reads one fragment with the reader */
export function build(text, rows, { read, marks, functional = [], giver = "asker", connectives = CONNECTIVES }) {
  const nodes = [{ id: "g0", parent: null, role: "ask", text, start: 0, end: text.length, kind: "ask", standing: null }], sent = new Map(); let n = 1;
  for (const f of cut(rows, text, connectives)) {
    if (!sent.has(f.s)) { const id = `g${n++}`; sent.set(f.s, id); nodes.push({ id, parent: "g0", role: "sentence", text: null, kind: "sentence", standing: null, s: f.s }); }
    const j = judge(read(f.text), marks, { functional, giver, text: f.text, read });
    nodes.push({ id: `g${n++}`, parent: sent.get(f.s), role: f.role, lead: f.lead, text: f.text, start: f.start, end: f.end, ...j });
  }
  return nodes;
}
/** weave(P, h, nodes, { by }) writes the tree as marks: ask INS·Figure, goal SEG·Pattern (of the ask), part_of CON·Figure, standing EVA·Figure (of the goal). Interpretation (the standing) is written under the interpreter's writer. */
export function weave(P, h, nodes, { kinds = true } = {}) {
  const K = { ask: "INS·Figure", goal: "SEG·Pattern", part_of: "CON·Figure", standing: "EVA·Figure" };
  if (kinds) for (const [name, cell] of Object.entries(K)) { try { P.weave(h, { cell: "DEF·Figure", kind: "kind", addr: `kind:${name}`, body: { name, cell } }); } catch { /* declared */ } }
  const ids = new Map(); let ask = null;
  for (const nd of nodes) {
    if (nd.kind === "ask") { const e = P.weave(h, { cell: K.ask, kind: "ask", addr: `ask:${nd.id}`, body: { text: nd.text } }); ask = e.id; ids.set(nd.id, e.id); continue; }
    const e = P.weave(h, { cell: K.goal, kind: "goal", addr: `goal:${nd.id}`, body: { role: nd.role, kind: nd.kind, lead: nd.lead ?? null, start: nd.start ?? null, end: nd.end ?? null, text: nd.text ?? null }, of: [ask] }); ids.set(nd.id, e.id);
    P.weave(h, { cell: K.part_of, kind: "part_of", addr: `goal:${nd.id}`, body: { to: nd.parent === "g0" ? "ask:g0" : `goal:${nd.parent}` }, of: [e.id, ids.get(nd.parent)] });
  }
  for (const nd of nodes) if (nd.standing) P.weave(h, { cell: K.standing, kind: "standing", addr: `goal:${nd.id}`, body: { standing: nd.standing, finding: nd.finding ?? null, note: nd.note ?? null, basis: nd.basis ?? { material: [], priors: [] } }, of: [ids.get(nd.id)] });
  return ids;
}
