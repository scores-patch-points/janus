// organs/fold-claims.js — janus's derivations, appended to the fold's claim store (FoldRecord@1) at their own addresses.
//
// janus Relates: what follows from the record. The surface (the chat, a weave) keeps an APPEND-ONLY claim store at holon addresses
// (khora/native/the-fold/fold-record.js). A derivation is one more claim in it — lane "d", `/t<turn>/d<i>` — whose basis names the
// premises it rests on and the source addresses those stand on, so the chain  derived claim → premises → source bytes  is one read
// of the store, and a contradiction found on turn 3 is still there on turn 9 (accrued, not recomputed).
//
// Pure: the sibling contract is imported, never copied (the closure never imports the reader — II.3). Nothing is rewritten: the claim's
// ARG1 is the derived note's own object; the verb is its relation. A model's conclusion is never a claim here — only `derived: true` rows
// from derivation.js ever pass.
import { claimAt, appendClaims, claimsAt, turnAddress } from "../../../khora/native/the-fold/fold-record.js";

export { appendClaims, claimsAt, turnAddress };

/** `derived` = derivation.js `derive(...)`'s `derived` rows: { id, subject, verb, object, depth, paths, premises, provenance, landed }.
 *  A row with no subject, verb or object is not a claim. Rows that landed "unchanged" this pass are skipped (already in the store). */
export function derivedClaims(turn, derived = []) {
  const out = [];
  for (const r of derived || []) {
    if (!r || r.landed === "unchanged" || !r.subject || !r.verb || !r.object) continue;
    const c = claimAt(turn, out.length + 1, String(r.verb), String(r.object), {
      derived: true, derivedId: r.id ?? null, subject: String(r.subject), depth: r.depth ?? null, paths: r.paths ?? null,
      premises: [...(r.premises || [])], provenance: [...(r.provenance || [])],
    }, { lane: "d", arg0: String(r.subject) });
    if (c) out.push(c);
  }
  return out;
}

/** The store after this pass's derivations are appended. A derivation already stored under the same derivedId is not stored twice (re-derived ≠ new). */
export function appendDerived(store, turn, derived) {
  const have = new Set((store || []).map((c) => c.basis?.derivedId).filter(Boolean));
  return appendClaims(store, derivedClaims(turn, derived).filter((c) => !have.has(c.basis.derivedId)));
}
