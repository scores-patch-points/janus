// organs/edit-intent.mjs: "TRIM THIS CLIP", "MAKE THE PACING BETTER" AS A STRUCTURE, NOT AN ACTION. Janus is the researcher: it reads what the sentence ASKS and says what is still missing; it never edits anything and never guesses.
// The path (THE LAW OF TEXT): the sentence goes through its codec to EOT (nl-eot.mjs `read`); this file only reads the EOT record's STRUCTURE (the root, its obj and xcomp arcs, the markers' features, the lemma's act prior). No string is matched.
//   verb     the root node's lemma, looked up in the ACT PRIOR (VerbNet 3 through Zenodotus act-priors; standing unanimous|contested; every candidate kept, never collapsed)
//   primitive a verb class -> an editing primitive, through EDIT_CLASSES below: A DECLARED TABLE, authored here, each row naming its VerbNet class and why; it is the one hand-written thing and the owner's to review. A verb none of whose classes is in it is `no_edit_primitive`.
//   theme    the obj node; deixis = a determiner marker with PronType=Dem ("this clip") -> needs the caller's SELECTION or the gap `no_selection`; PronType=Art/Def ("the pacing") is recorded as definite, not resolved here
//   result   an xcomp ADJ ("make X better"): a RESULTATIVE. It needs a CRITERION for that (theme, adjective) pair, a declared prior that names a measure; there is none today, so it is the gap `no_criterion`, never a guess at what "better" means
// OUTPUT status: ready | needs_params | ambiguous | gap. `gaps` lists every missing thing by code. Pure: no log, no clock, no model.
export const SCHEMA = "EditIntent@1";
/** VerbNet class -> editing primitive. DECLARED, authored in janus 2026-11-27, NOT measured: a class is a received grouping (giver: VerbNet 3 via act-prior-en.json), the mapping to what an editor can do is this table's claim. */
export const EDIT_CLASSES = Object.freeze({
  "remove-10.1": { primitive: "remove_span", because: "remove: take a thing away from a location (a span from the timeline)" },
  "banish-10.2": { primitive: "remove_span", because: "banish: remove from a place" },
  "fire-10.10": { primitive: "remove_span", because: "fire: remove from a position" },
  "wipe_manner-10.4.1": { primitive: "remove_span", because: "wipe/trim: remove material from a surface (trim a clip's ends)" },
  "cut-21.1": { primitive: "remove_span", because: "cut: separate with an edge; here a span is cut out" },
  "split-23.2": { primitive: "split", because: "split: separate into parts (a cut point)" },
  "break-45.1": { primitive: "split", because: "break: separate into parts" },
  "other_cos-45.4": { primitive: "change_state", because: "change of state of a quantity (shorten, tighten, lengthen, slow): needs a measure and a target" },
  "caused_calibratable_cos-45.6.2": { primitive: "change_state", because: "caused change of a calibratable quantity (raise, lower, increase)" },
});
/** what each primitive needs that a sentence like "trim this clip" does NOT say: the caller (a selection, a transcript, the material's own measurements) supplies it, or it stays a named gap */
export const PRIMITIVE_PARAMS = Object.freeze({ remove_span: ["span"], split: ["at"], change_state: ["target"], change_state_to: [] });
const arcsOf = (rec) => rec.meaning?.arcs ?? [], nodeOf = (rec, k) => (rec.meaning?.nodes ?? []).find((n) => n.key === k) ?? null, markerOf = (rec, k) => (rec.meaning?.markers ?? []).find((m) => m.key === k) ?? null;
const featOf = (x, name) => (x?.feats ?? []).find((f) => f.name === name)?.value ?? null;

/** intentOf(record, { act, selection, criteria }) -> EditIntent@1. `act` = the ActPrior@1 `forms` object (null = typed gap); `selection` = the caller's current selection (an id) or null; `criteria` = { "<theme>|<adjective>": { measure } } declared priors (default none); `params` = what the sentence does not say, supplied by the caller (span, at, target); `salient` = the caller's discourse focus for a bare pronoun ("delete it"): STATED by the caller, never inferred here (the proper source is khora's text-referents cast, not wired). */
export function intentOf(record, { act = null, selection = null, criteria = {}, params = {}, salient = null } = {}) {
  const gaps = [], out = { schema: SCHEMA, verb: null, acts: null, primitives: [], alternatives: [], theme: null, result: null, oblique: [], gaps, status: "gap" };
  const root = arcsOf(record).find((a) => a.rel === "root" && a.to), verb = root && nodeOf(record, root.to);
  if (!verb || verb.upos !== "VERB") { gaps.push({ gap: "no_predicate", why: "the sentence has no root verb in its EOT" }); return out; }
  out.verb = verb.lemma;
  const kids = arcsOf(record).filter((a) => a.from === verb.key), obj = kids.find((a) => a.rel === "obj"), xc = kids.find((a) => a.rel === "xcomp");
  if (obj) { const t = nodeOf(record, obj.to), dem = (t.markers ?? []).map((k) => markerOf(record, k)).find((m) => m && featOf(m, "PronType") === "Dem"), art = (t.markers ?? []).map((k) => markerOf(record, k)).find((m) => m && featOf(m, "Definite") === "Def");
    out.theme = { lemma: t.lemma, deixis: dem ? dem.lemma : null, definite: !!art, bound: dem ? (selection ?? null) : null };
    if (t.upos === "PRON" && !dem) { out.theme.pronoun = true; out.theme.bound = salient; if (salient == null) gaps.push({ gap: "referent_unresolved", why: `"${t.lemma}" refers to something the sentence does not name and no salient referent was given (khora's text-referents cast is not wired)` }); }
    if (dem && selection == null) gaps.push({ gap: "no_selection", why: `"${dem.lemma} ${t.lemma}" points at the selection and none was given` }); }
  else gaps.push({ gap: "no_theme", why: "the verb has no object in the EOT (the parse may have attached it elsewhere)" });
  for (const a of kids.filter((k) => k.rel === "obl" || k.rel === "obl:tmod")) { const n = nodeOf(record, a.to); if (n) out.oblique.push({ rel: a.rel, lemma: n.lemma }); }
  if (xc) { const r = nodeOf(record, xc.to); if (r?.upos === "ADJ") { out.result = { lemma: r.lemma, degree: featOf(r, "Degree") }; out.primitives.push("change_state_to"); } }
  if (!act) gaps.push({ gap: "no_act_prior", why: "no ActPrior@1 (set ACT_PRIOR to Zenodotus derived-priors/act-priors/act-prior-en.json)" });
  else { const p = act[verb.lemma]; if (!p) gaps.push({ gap: "verb_not_in_act_prior", why: `${verb.lemma} has no VerbNet entry` });
    else { out.acts = { standing: p.standing, candidates: p.candidates ?? [{ op: p.op, classes: p.classes, alt: p.alt }] };
      const seen = new Set(); for (const c of out.acts.candidates) for (const cl of c.classes) { const e = EDIT_CLASSES[cl]; if (e && !seen.has(e.primitive)) { seen.add(e.primitive); out.alternatives.push({ primitive: e.primitive, class: cl, because: e.because }); } }
      if (!xc) for (const a of out.alternatives) out.primitives.push(a.primitive); } }
  if (out.result) { const k = `${out.theme?.lemma}|${out.result.lemma}`, c = criteria[k]; if (!c) gaps.push({ gap: "no_criterion", why: `no declared criterion says what "${out.result.degree === "Cmp" ? "more " : ""}${out.result.lemma}" means for "${out.theme?.lemma}" (a measure and a direction): ${k}` }); else out.result.criterion = c; }
  else if (out.acts && !out.primitives.length) gaps.push({ gap: "no_edit_primitive", why: `none of ${out.verb}'s VerbNet classes is in EDIT_CLASSES` });
  const prim = [...new Set(out.primitives)]; out.primitives = prim;
  out.params_missing = prim.length === 1 ? PRIMITIVE_PARAMS[prim[0]].filter((k) => params[k] == null) : [];
  out.status = gaps.some((g) => ["no_predicate", "referent_unresolved", "no_act_prior", "verb_not_in_act_prior", "no_edit_primitive", "no_criterion", "no_theme"].includes(g.gap)) ? "gap" : prim.length > 1 ? "ambiguous" : gaps.length || out.params_missing.length ? "needs_params" : "ready";
  return out;
}
