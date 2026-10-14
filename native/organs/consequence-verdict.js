// organs/consequence-verdict.js — janus tests WHAT FOLLOWS, on the REAL record.
//
// The reported verdict (EOConsequenceVerdict@1) is made real here as a thin, honest read over janus's
// own append-only reasoning record (reasoning-spiral.js), NOT a parallel ledger. What it decides and why:
//   earned      — standings the record holds as `supported` (deduced or witnessed, its premises supported)
//   withheld    — `unresolved` / `candidate` / `suspended` / `stale` / `unlicensed`: not measured, so the
//                 mind is earned-ONLY; a candidate is never counted until it re-earns with the face measured
//   defeated    — `refuted` (and projection refusals: unsupported_origin, premise_not_supported, …):
//                 PRESERVED on the record, never deleted (defeat is evidence), and it subtracts from the retained mind
// retainedMind  — earned − defeated (the retained referents)
//
// The falsifying control: a `supported` claim whose premises are not supported is NOT earned (the spiral's
// own premise_not_supported rule fires); a denied claim dropped from the log would raise retainedMind
// dishonestly — so this organ reads the log as-is and never edits it.
import { appendReasoning, reasoningAt } from "./reasoning-spiral.js";

export const CONSEQUENCE_SCHEMA = "EOConsequenceVerdict@1";
const WITHHELD = new Set(["unresolved", "candidate", "suspended", "stale", "unlicensed"]);

/** The consequence verdict of the reasoning log: what follows, and what the retained mind holds. */
export function consequenceVerdict(log = []) {
  const at = reasoningAt(log);
  const claims = Array.isArray(at.claims) ? at.claims : [];
  const earned = [], withheld = [], defeated = [];
  for (const c of claims) {
    if (!c || !c.id) continue;
    if (c.standing === "supported") earned.push(c.id);
    else if (WITHHELD.has(c.standing)) withheld.push(c.id);
    else defeated.push(c.id);   // refuted / refused: preserved, never deleted
  }
  return {
    schema: CONSEQUENCE_SCHEMA,
    earned, withheld, defeated,
    retainedMind: earned.length - defeated.length,
    byStanding: at.byStanding || {},
    refused: at.refused || [],
  };
}

export default consequenceVerdict;