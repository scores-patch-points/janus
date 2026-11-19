// organs/gate-evidence.mjs: janus is the RESEARCHER: it leaves EVIDENCE in the shared log and never a verdict. Penelope convicts.
// Division (the person, 2026-11-14 and today): janus does the geometry and the finding; penelope does the calculus: she declares the bound (does a difference that rests on a
// learned rule count? how many agreeing keys are enough?), judges (EVA) and re-judges (REC) over what janus left. So nothing here says "same", "different", "contradicted"
// or "unbound" as a conclusion: it writes WHAT WAS FOUND, with the two witnessing assertions and the standing of the rule behind each difference, as DEF at Figure.
//
//   difference  two assertions on one rule that cannot both stand: the rule's kind and STANDING (given by a named giver, or a learned candidate with its evidence, or the
//               conflict rests on an unwitnessed assertion), and the two assertions that witness it. A given rule on witnessed assertions is what khora's exclusion may convict on;
//               that is Penelope's call to make under her bound, so the standing travels with the difference and is never applied here.
//   agreement   two assertions on one relation that say the same thing (a candidate for an agreeing key; strength is hers to compute)
//   hole        something that could not be compared or asked: incomparable values (a year against a day in another calendar, sibling grounds), a relation one side never states,
//               a frame that cannot ask (no shared kind, no rule declared, register ahead of the cursor): the hunger list's raw material
//   change      different values at disjoint times: change, not two referents
// Janus may SYNTHESIZE (SYN: an emergent whole from parts) and may not JUDGE (EVA). The synthesis is the CANDIDATE MERGED WORLD: the two referents' assertions composed into one whole, each assertion
// still labelled with the side it came from and never re-id'd. HELIX ORDER (NUL SIG INS SEG CON SYN DEF EVA REC; Penelope's PRIMITIVES-IN-EOT): a thing reads only things born at or before its own
// operator, so SYN comes first and the differences, agreements and holes are DEFs that cite the world they were found in (`of`); EVA, the judgement, is hers and comes after. SYN at Ground is the
// empty desert cell, so the world is SYN at Pattern (Network, Composing).
// PURE: no regex, no clock, no log access in evidenceOf; writeEvidence is the only function that touches a door, and it is told the door.
import crypto from "node:crypto";
export const EVIDENCE_SCHEMA = "GateEvidence@1";
export const KINDS = Object.freeze({ "merged-world": "SYN·Pattern", difference: "DEF·Figure", agreement: "DEF·Figure", hole: "DEF·Figure", change: "DEF·Figure" });
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
/** an assertion as a witness: the id, the value, and the ground it holds in when the adapter wrapped it ({ v, where, when }) */
const witness = (x) => { if (!isObj(x)) return null; const v = x.value; const wrapped = isObj(v) && "v" in v; return { id: x.id ?? null, value: wrapped ? v.v : (v ?? null), ...(wrapped && v.where != null ? { where: v.where } : {}), ...(wrapped && v.when != null ? { when: v.when } : {}), ...(x.seq != null ? { seq: x.seq } : {}) }; };
// a bound with no limit is Infinity in the gate and cannot be a number in the log (pharos refuses a non-finite number): null means NO LIMIT on that side
const fin = (n) => (typeof n === "number" && Number.isFinite(n) ? n : null);
const ruleOf = (c) => ({ kind: c.base != null ? "range" : "one-valued", standing: c.standing === "given" ? "given" : "candidate", giver: c.giver ?? null, evidence: c.evidence ?? null, onKind: c.kind ?? null, ...(c.base != null ? { rel: c.rel, base: c.base, min: fin(c.min), max: fin(c.max) } : {}) });

/**
 * evidenceOf(result, { a, b, witnessed }) -> { schema, pair: [a, b], frame, findings: [...], counts }, from one judge() result of the merge gate (or of khora's identity-exclusion).
 * The result's own verdict word and reason are NOT carried as a conclusion: a reach reason (the frame could not ask) becomes a hole.
 */
export function evidenceOf(result, { a, b, witnessed = null } = {}) {
  if (!isObj(result)) throw new TypeError("evidenceOf: needs a judge() result");
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) throw new TypeError("evidenceOf: needs the two referents a and b");
  const findings = [], at = (c, via) => ({ type: "difference", rel: c.rel, base: c.base ?? null, via, rule: ruleOf(c), witness: { a: witness(c.a), b: witness(c.b) } });
  // `witnessed(assertion)` is the caller's own test; with it, "witnessed" is COMPUTED here for both sides of every conflict. Without it the result's own word is read (a result that carries a proof was convicted on witnessed assertions)
  const viaOf = (c, fallback) => (typeof witnessed === "function" ? (witnessed(c.a) && witnessed(c.b) ? "witnessed" : "unwitnessed") : fallback);
  for (const c of result.proof ?? []) findings.push(at(c, viaOf(c, "witnessed")));
  for (const c of result.raised ?? []) findings.push(at(c, viaOf(c, c.raisedAs === "unwitnessed_conflict" ? "unwitnessed" : "witnessed")));
  for (const g of result.agreed ?? []) findings.push({ type: "agreement", rel: g.rel, witness: { a: witness(g.a), b: witness(g.b) } });
  for (const g of result.incomparable ?? []) findings.push({ type: "hole", why: "incomparable", rel: g.rel, ...(g.base != null ? { base: g.base } : {}), witness: { a: witness(g.a), b: witness(g.b) } });
  for (const rel of result.order?.find((s) => s.step === "values")?.unasserted ?? []) findings.push({ type: "hole", why: "unasserted", rel });
  for (const rel of result.changed ?? []) findings.push({ type: "change", rel });
  // a range rule's own incomparable and held pairs live only in the step trace (named "rel-base"); carried as the name, never split
  const range = result.order?.find((x) => x.step === "range");
  for (const r of range?.incomparable ?? []) findings.push({ type: "hole", why: "incomparable", range: r });
  for (const r of range?.held ?? []) findings.push({ type: "agreement", range: r });
  if (result.reason && !(result.raised?.length) && !(result.proof?.length) && ["kind_unknown", "no_shared_kind", "no_functional_relation_declared", "register_ahead_of_cursor"].includes(result.reason)) findings.push({ type: "hole", why: result.reason });
  findings.sort((x, y) => (x.type + (x.rel ?? "") + (x.range ?? "") + (x.why ?? "")).localeCompare(y.type + (y.rel ?? "") + (y.range ?? "") + (y.why ?? "")));
  const n = (t, f = () => true) => findings.filter((x) => x.type === t && f(x)).length;
  return Object.freeze({ schema: EVIDENCE_SCHEMA, pair: [a, b], frame: result.frame ?? null, findings: Object.freeze(findings),
    counts: Object.freeze({ differences: n("difference"), givenRule: n("difference", (x) => x.rule.standing === "given"), candidateRule: n("difference", (x) => x.rule.standing === "candidate"), unwitnessed: n("difference", (x) => x.via === "unwitnessed"), agreements: n("agreement"), holes: n("hole"), changes: n("change") }) });
}
/** synthesisOf({ a, b }, assertionsOf) -> the candidate merged world: the union of both referents' assertions, each kept with its side. Composed, not judged; order-independent. */
export function synthesisOf({ a, b } = {}, assertionsOf) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) throw new TypeError("synthesisOf: needs the two referents a and b");
  if (typeof assertionsOf !== "function") throw new TypeError("synthesisOf: assertionsOf must be supplied");
  const side = (who, s) => (assertionsOf(who) ?? []).map((x) => ({ side: s, rel: x.rel, ...witness(x) }));
  const assertions = [...side(a, "a"), ...side(b, "b")].sort((x, y) => (x.side + x.rel + String(x.id)).localeCompare(y.side + y.rel + String(y.id)));
  const rels = [...new Set(assertions.map((x) => x.rel))].sort();
  return Object.freeze({ schema: EVIDENCE_SCHEMA, type: "merged-world", pair: [a, b], assertions: Object.freeze(assertions), counts: Object.freeze({ a: assertions.filter((x) => x.side === "a").length, b: assertions.filter((x) => x.side === "b").length, relations: rels.length, sharedRelations: rels.filter((r) => assertions.some((x) => x.rel === r && x.side === "a") && assertions.some((x) => x.rel === r && x.side === "b")).length }) });
}
const sha16 = (o) => crypto.createHash("sha256").update(JSON.stringify(o), "utf8").digest("hex").slice(0, 16);
/** the entries for the shared log: one per finding, DEF at Figure, no verdict. addr is content-derived, so the same finding written twice is one address. */
export function entriesOf(evidence, { by = "janus.gate" } = {}) {
  return evidence.findings.map((f) => ({ cell: KINDS[f.type], kind: f.type, addr: `${f.type}:${sha16([evidence.pair, f])}`, body: { by, pair: evidence.pair, frame: evidence.frame, ...f } }));
}
/** writeEvidence(door, evidence) -> { written, refused, why }: declares the four kinds once, then weaves each finding. A door that is off writes nothing and says why. */
export function writeEvidence(door, evidence, world = null) {
  if (!door?.on) return { written: 0, refused: evidence.findings.length + (world ? 1 : 0), why: door?.why ?? "no door" };
  for (const [kind, cell] of Object.entries(KINDS)) door.declare(kind, cell, "janus's evidence: a difference, agreement, hole or change it found, with its witnesses; no verdict");
  let written = 0, refused = 0, of = [], worldId = null;
  // the world first (SYN), then every finding citing it (DEF reads SYN): the helix order, written as the log's own `of`
  if (world) { const w = door.weave({ cell: KINDS["merged-world"], kind: "merged-world", addr: `merged-world:${sha16(world.pair)}`, body: { by: "janus.gate", pair: world.pair, assertions: world.assertions, counts: world.counts } }); if (w) { written++; worldId = w.id; of = [w.id]; } else refused++; }
  for (const e of entriesOf(evidence)) { if (door.weave(of.length ? { ...e, of } : e)) written++; else refused++; }
  return { written, refused, worldId, why: refused ? door.counts?.lastReason ?? "weave refused" : null };
}
