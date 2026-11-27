// organs/edit-weave.mjs: THE EDIT REQUEST, READ FROM THE PHAROS AND WRITTEN BACK AS STRUCTURE. The whole path, repos never calling each other:
//   khora (the-fold/pharos-framed.mjs) reads the text through its canonical door and writes  text, text-codec, text-reading  (by kind)
//   janus  eot-weave.mjs reads those by kind, decodes the text through the codec the read ran under, and writes  text-eot  (SYN·Pattern)
//   janus  THIS FILE reads text-eot by kind and writes, per sentence,  edit-intent  (CON·Figure): what the sentence asks, what it still lacks (typed gaps), nothing chosen
// Janus structures; it never edits and never decides: an intent is an observation with its gaps. Accepting a proposal or a criterion is a DEF by a person (Penelope's cell); applying it is the editor's (Slate/Proteus).
// The sentence went through the SAME codec as everything else (rule 11), and the act prior arrives as DATA (`act`, the ActPrior@1 forms), loaded by the caller: janus imports no other repo here.
import { intentOf } from "./edit-intent.mjs"; import { trimProposal, pacingProposals } from "./edit-propose.mjs";
export const INTENT_KIND = "edit-intent", INTENT_CELL = "CON·Figure";
export const SHAPE_READS = Object.freeze(["text-roles", "text-polarity", "text-question"]);   // khora's (the-fold/pharos-roles.mjs), read by kind
/** shapeFor(record, i, { roles, polarity, question }) -> the shape of sentence i keyed by the EOT record's node keys, or null. khora's rows are keyed (s, id); the record carries surface.keyOfId (token id -> node key). Only used when janus and khora cut the same sentences. */
export function shapeFor(record, i, { roles = null, polarity = null, question = null } = {}) {
  if (!roles && !polarity && !question) return null; const key = (id) => record.surface?.keyOfId?.[id] ?? null, out = { roles: null, negated: null, question: null, consistency: null };
  if (roles) { const c = (roles.sentences ?? []).find((x) => x.s === i); out.consistency = c ? { consistent: c.consistent, unknown: c.unknown ?? {}, gaps: (c.gaps ?? []).map((g) => g.gap) } : null; out.roles = new Map(); for (const r of roles.rows ?? []) if (r.s === i && key(r.id)) out.roles.set(key(r.id), { panini: r.panini, karaka: r.karaka ?? null }); }
  if (polarity) { out.negated = new Set(); for (const n of polarity.negated ?? []) if (n.s === i && key(n.id)) out.negated.add(key(n.id)); }
  if (question) { const q = (question.sentences ?? []).find((x) => x.s === i); out.question = q ? { form: q.form, admits: q.admits ?? null, modality: q.modality ?? null } : null; }
  return out;
}
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}` : JSON.stringify(v));
/** weaveEdits(door, { act, selection, salient, criteria, params, only }) -> { written, skipped, refused, why, intents } — one edit-intent per sentence of every text-eot, addr `intent:<sha16>#<i>`, of [the text-eot entry]. */
export function weaveEdits(door, { act = null, selection = null, salient = null, criteria = {}, params = {}, only = null } = {}) {
  const out = { written: 0, skipped: 0, refused: 0, why: null, intents: [] };
  if (!door?.on) return { ...out, refused: 1, why: door?.why ?? "no door" };
  const es = door.ask(["text-eot"]); if (!es) return { ...out, refused: 1, why: door.counts?.lastReason ?? "could not read the log" };
  door.declare(INTENT_KIND, INTENT_CELL, "what one sentence asks of an editor, read from its EOT: the verb and its act-prior standing, the theme and what it points at, the primitives, and every missing thing as a typed gap; nothing chosen, nothing applied");
  const latest = new Map(); for (const e of es) latest.set(e.addr, e);
  const shapes = new Map(); for (const e of door.ask([...SHAPE_READS]) ?? []) shapes.set(e.addr, e);   // the last entry at an address is the live one
  for (const [addr, e] of latest) {
    const sha = addr.startsWith("eot:") ? addr.slice(4) : null; if (!sha || (only && !only.includes(sha))) continue;
    e.body.records.forEach((rec, i) => {
      // khora's shape is used only when both repos cut the same sentences (text-eot readingCheck.sameCut): otherwise sentence i here is not sentence i there, and the layer falls back and says so
      const aligned = e.body.readingCheck?.sameCut === true, shape = aligned ? shapeFor(rec, i, { roles: shapes.get(`roles:${sha}`)?.body, polarity: shapes.get(`polarity:${sha}`)?.body, question: shapes.get(`question:${sha}`)?.body }) : null;
      const intent = intentOf(rec, { act, selection, salient, criteria, params, shape }), body = { sentence: i, text: rec.surface?.text ?? null, codec: e.body.codec, ...intent };
      const a = `intent:${sha}#${i}`, have = (door.fold({ kind: INTENT_KIND, addr: a }) ?? []).find((x) => canon(x.body) === canon(body));
      out.intents.push({ addr: a, status: intent.status, verb: intent.verb });
      if (have) { out.skipped++; return; }
      const w = door.weave({ cell: INTENT_CELL, kind: INTENT_KIND, addr: a, body, of: [e.id], basis: { by: "janus", note: "read from the EOT by structure and the VerbNet act prior; an observation with its gaps, not a decision and not an edit" } });
      if (w) out.written++; else { out.refused++; out.why = door.counts?.lastReason ?? "weave refused"; }
    });
  }
  return out;
}

export const PROPOSAL_KIND = "edit-proposal", PROPOSAL_CELL = "SEG·Figure";
const r3 = (x) => Math.round(x * 1000) / 1000;
/** weaveProposals(door, { clips, words }) -> { written, skipped, refused, why } — for each live edit-intent, the NOMINATIONS the material's own distribution supports, written as edit-proposal (SEG·Figure, of the intent):
 *  a remove_span intent whose theme is bound to a clip in `clips` ({ id: { start, end } }) gets trim_to_speech; a change_state_to intent whose criterion measure is outlier_gaps gets one proposal per outlier gap.
 *  `words` is [{ start, end }] from whatever read the audio (no reader of audio exists here: the caller supplies it, and with none NOTHING is proposed). Nominations only: choosing one is the asker's observation and Penelope's DEF. */
export function weaveProposals(door, { clips = {}, words = null } = {}) {
  const out = { written: 0, skipped: 0, refused: 0, why: null };
  if (!door?.on) return { ...out, refused: 1, why: door?.why ?? "no door" };
  if (!Array.isArray(words) || !words.length) return { ...out, why: "no_words: no word timing was given, so nothing is proposed" };
  const es = door.ask([INTENT_KIND]); if (!es) return { ...out, refused: 1, why: door.counts?.lastReason ?? "could not read the log" };
  door.declare(PROPOSAL_KIND, PROPOSAL_CELL, "an edit the material's own distribution supports (trim to speech; gaps above the material's own fence): a nomination with its basis and its measured effect, never a decision");
  const latest = new Map(); for (const e of es) latest.set(e.addr, e);
  const put = (addr, body, of) => { const have = (door.fold({ kind: PROPOSAL_KIND, addr }) ?? []).find((x) => canon(x.body) === canon(body)); if (have) { out.skipped++; return; }
    const w = door.weave({ cell: PROPOSAL_CELL, kind: PROPOSAL_KIND, addr, body, of: [of], basis: { by: "janus", method: body.method, note: "a quantile of the material's own distribution; a nomination, not a decision" } }); if (w) out.written++; else { out.refused++; out.why = door.counts?.lastReason ?? "weave refused"; } };
  for (const [addr, e] of latest) {
    const b = e.body, key = addr.startsWith("intent:") ? addr.slice(7) : null; if (!key) continue;
    if (b.primitives?.length === 1 && b.primitives[0] === "remove_span" && b.theme?.bound && clips[b.theme.bound]) {
      const t = trimProposal(clips[b.theme.bound], words); if (t.remove.length) put(`proposal:${key}:0`, { intent: addr, primitive: "remove_span", clip: b.theme.bound, spans: t.remove, method: "trim_to_speech", basis: { pad: t.pad, why: t.why }, saves: r3(t.remove.reduce((a, x) => a + (x.to - x.from), 0)) }, e.id);
    }
    if (b.primitives?.length === 1 && b.primitives[0] === "change_state_to" && b.result?.criterion?.measure === "outlier_gaps") {
      const p = pacingProposals(words); p.proposals.forEach((x, n) => put(`proposal:${key}:${n}`, { intent: addr, primitive: "remove_span", clip: null, spans: [{ from: x.from, to: x.to - x.keep }], method: "outlier_gaps", basis: { fence: p.fence, median: p.median, keep: x.keep }, saves: x.saves }, e.id));
    }
  }
  return out;
}
