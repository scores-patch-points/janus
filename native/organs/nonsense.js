// organs/nonsense.js — JANUS CATCHES NON-SENSE BY KIND: what kinds of things
// can be said coherently about which referents.
//
// Janus induces KINDS over the read (kind-induction.js, company — never a
// wordlist). Those kinds are enacted here as the SELECTIONAL frame: an act, in
// the material, is performed by a population of agents; a referent's kind is
// how much the record attests it as an actor and how its acts distribute. Three
// verdicts, each from the material's own counts, each falsifiable:
//
//   one-shot-agent  the subject performs this act exactly once in the whole
//                   read and is not a name — 'step offered contrast': the
//                   material attests NO other predication on it as an actor,
//                   so the kind to which it belongs cannot say such things.
//   inverted-role   an ASYMMETRIC act (overlap of its agents with its patients
//                   is low) binds a PATIENT who is herself a high-volume agent
//                   of that act — the reader seated a speaker as the spoken-of
//                   ('anna says prince').
//   self-undo       s === o on an act with ≈0 reflexive attestation.
//
// PURE. `induceKinds` is janus's own (the SAME inducer the box uses, so the
// kinds here are the box's kinds); the seam supplies the edges and, for the
// name seat, the fold's own name-signal set (disclosure only).
import { induceKinds } from "./kind-induction.js";

export const NONSENSE_SCHEMA = "JanusNonsense@1";
const col = (x) => String(x ?? "").trim().toLowerCase();

/** roleVolume(edges) -> { agentsOf, patentsOf, patientsOf, actsOf, names }
 *  every count is the material's own. */
export function roleVolume(edges = []) {
  const agentsOf = new Map();   // verb -> Set<subject>
  const patientsOf = new Map(); // verb -> Set<object>
  const actsOf = new Map();     // ref  -> number of times it ACTS
  for (const e of edges) {
    if (!e.s || !e.v) continue;
    if (!agentsOf.has(col(e.v))) agentsOf.set(col(e.v), new Set());
    agentsOf.get(col(e.v)).add(col(e.s));
    actsOf.set(col(e.s), (actsOf.get(col(e.s)) ?? 0) + 1);
    if (e.o) {
      if (!patientsOf.has(col(e.v))) patientsOf.set(col(e.v), new Set());
      patientsOf.get(col(e.v)).add(col(e.o));
    }
  }
  return { agentsOf, patientsOf, actsOf };
}

export function senseOf(edges = [], { induceKinds = null, nameSignals = null } = {}) {
  const { agentsOf, patientsOf, actsOf } = roleVolume(edges);
  const names = nameSignals instanceof Set ? nameSignals : new Set();
  const keyOf = (e) => `${col(e.s)}\x00${col(e.v)}\x00${e.o ? col(e.o) : ""}`;
  const rkeyOf = (e) => `${e.o ? col(e.o) : ""}\x00${col(e.v)}\x00${col(e.s)}`;
  const keys = new Set(edges.map(keyOf));
  const reciprocal = new Map(); // verb -> rate (exact reverse present / edges)
  const tot = new Map();
  for (const e of edges) {
    tot.set(col(e.v), (tot.get(col(e.v)) ?? 0) + 1);
    if (e.s && e.o && col(e.s) < col(e.o) && keys.has(rkeyOf(e))) reciprocal.set(col(e.v), (reciprocal.get(col(e.v)) ?? 0) + 1);
  }
  for (const v of tot.keys()) reciprocal.set(v, (reciprocal.get(v) ?? 0) / tot.get(v));
  // induce kinds the way the box does — disclosed; the verdicts below rest on
  // volume, ride the same inducer's company when it fires.
  let kindNotes = null;
  if (typeof induceKinds === "function") {
    try { kindNotes = induceKinds(edges.map((e) => e.s).filter(Boolean)).length; } catch { kindNotes = null; }
  }
  const verdicts = new Map();
  const nonsense = [];
  for (const e of edges) {
    const s = col(e.s), v = col(e.v), o = e.o ? col(e.o) : null;
    let why = null;
    const agents = agentsOf.get(v) ?? new Set();
    const actVol = actsOf.get(s) ?? 0;
    if (s === o) { why = "self-undo"; }
    else if (actVol === 1 && !names.has(s) && agents.size >= 2) { why = "one-shot-agent"; }
    else if (o && keys.has(rkeyOf(e))) {
      const asym = (reciprocal.get(v) ?? 1) < 0.2;
      if (asym) why = "inverted-role"; // both directions bound while the act drifts one way — at least one is the tag's mis-bind
    }
    verdicts.set(`${s}\x00${v}\x00${o ?? ""}`, { sense: why ? "nonsense" : "sound", because: why ?? "the record holds these roles" });
    if (why) nonsense.push({ s, v, o, at: e.at, because: why });
  }
  return { schema: NONSENSE_SCHEMA, kindNotes, verdicts, nonsense,
    kept: edges.filter((e) => (verdicts.get(`${col(e.s)}\x00${col(e.v)}\x00${e.o ? col(e.o) : ""}`)?.sense ?? "sound") === "sound") };
}

export default { senseOf, roleVolume, NONSENSE_SCHEMA };