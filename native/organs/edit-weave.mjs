// organs/edit-weave.mjs: THE EDIT REQUEST, READ FROM THE PHAROS AND WRITTEN BACK AS STRUCTURE. The whole path, repos never calling each other:
//   khora (the-fold/pharos-framed.mjs) reads the text through its canonical door and writes  text, text-codec, text-reading  (by kind)
//   janus  eot-weave.mjs reads those by kind, decodes the text through the codec the read ran under, and writes  text-eot  (SYN·Pattern)
//   janus  THIS FILE reads text-eot by kind and writes, per sentence,  edit-intent  (CON·Figure): what the sentence asks, what it still lacks (typed gaps), nothing chosen
// Janus structures; it never edits and never decides: an intent is an observation with its gaps. Accepting a proposal or a criterion is a DEF by a person (Penelope's cell); applying it is the editor's (Slate/Proteus).
// The sentence went through the SAME codec as everything else (rule 11), and the act prior arrives as DATA (`act`, the ActPrior@1 forms), loaded by the caller: janus imports no other repo here.
import { intentOf } from "./edit-intent.mjs";
export const INTENT_KIND = "edit-intent", INTENT_CELL = "CON·Figure";
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}` : JSON.stringify(v));
/** weaveEdits(door, { act, selection, salient, criteria, params, only }) -> { written, skipped, refused, why, intents } — one edit-intent per sentence of every text-eot, addr `intent:<sha16>#<i>`, of [the text-eot entry]. */
export function weaveEdits(door, { act = null, selection = null, salient = null, criteria = {}, params = {}, only = null } = {}) {
  const out = { written: 0, skipped: 0, refused: 0, why: null, intents: [] };
  if (!door?.on) return { ...out, refused: 1, why: door?.why ?? "no door" };
  const es = door.ask(["text-eot"]); if (!es) return { ...out, refused: 1, why: door.counts?.lastReason ?? "could not read the log" };
  door.declare(INTENT_KIND, INTENT_CELL, "what one sentence asks of an editor, read from its EOT: the verb and its act-prior standing, the theme and what it points at, the primitives, and every missing thing as a typed gap; nothing chosen, nothing applied");
  const latest = new Map(); for (const e of es) latest.set(e.addr, e);
  for (const [addr, e] of latest) {
    const sha = addr.startsWith("eot:") ? addr.slice(4) : null; if (!sha || (only && !only.includes(sha))) continue;
    e.body.records.forEach((rec, i) => {
      const intent = intentOf(rec, { act, selection, salient, criteria, params }), body = { sentence: i, text: rec.surface?.text ?? null, codec: e.body.codec, ...intent };
      const a = `intent:${sha}#${i}`, have = (door.fold({ kind: INTENT_KIND, addr: a }) ?? []).find((x) => canon(x.body) === canon(body));
      out.intents.push({ addr: a, status: intent.status, verb: intent.verb });
      if (have) { out.skipped++; return; }
      const w = door.weave({ cell: INTENT_CELL, kind: INTENT_KIND, addr: a, body, of: [e.id], basis: { by: "janus", note: "read from the EOT by structure and the VerbNet act prior; an observation with its gaps, not a decision and not an edit" } });
      if (w) out.written++; else { out.refused++; out.why = door.counts?.lastReason ?? "weave refused"; }
    });
  }
  return out;
}
