// organs/probe-answers.mjs: the producer of `probe-answer` entries (the kind Penelope's perspective judge reads by kind; the shape was a PROPOSED contract with no writer until now):
//   INS·Figure   kind probe-answer   addr answer:<pair sha16>:<side>:<probe>   body { pair, side, probe, value, addr, referent?, why? }   of: [the bond entries the value was read from]
// The answer is what the claim-links of one side say about the asked-about being for one probe (a relation): read by an EOQL expression over claim-links (SEG cuts, CON joins, REC projects; the ground
// containment is closed by P-FIX), never by a model and never by a word list. A side is a GROUND (a document or a passage of it): only claims whose ground is inside the side's ground are read.
//   one value -> that value; several distinct values -> a sorted JSON array (the difference is visible, never merged); none -> null with why "silent" (a hole is an entry; silence is never agreement).
//   a value that is a referent carries referent: true, so the judge compares it only through a licensed bridge (per-document referents are not equal because their strings are).
// A negated claim is not a value: absence is not denial. Pure over the injected EOQL module E and handle; returns entry inputs, writes nothing (the caller weaves them through its door).
import { closure } from "./constraint-eoql.mjs";
const q = (s) => { if (/["\\\n]/.test(s)) throw new TypeError(`probe-answers: a name may not contain quotes, backslashes or newlines: ${s}`); return `"${s}"`; };
const nm = (x) => String(x).replace(/^being:/, "");
/** the rows one side gives one probe: value, the bond id, the claim address, the claim's ground and whether the value is a referent */
const readSide = (E, handle, { about, where, probe }) => {
  const H = closure("holds_in"), W = q(`where:${where}`);
  const base = `REC(EVA(CON(SEG(sources; kinds: ["bond"]); as: "a"; to: SEG(sources; kinds: ["claim"]); on: a.claim = b._addr; join: "inner"; to_as: "b"); where: a._addr = ${q(`being:${about}`)} AND b.rel = ${q(probe)} AND b.polarity = "+"); set: {v: a.to, bid: a._id, cl: b._addr, g: b.ground, obj: b.object}; pick: ["v", "bid", "cl", "g", "obj"])`;
  const text = `REC(EVA(CON(${base}; as: "x"; to: ${H}; on: x.g = k.c AND k.p = ${W}; join: "left"; to_as: "k"); where: x.g = ${W} OR k.c is not null); set: {v: x.v, bid: x.bid, cl: x.cl, obj: x.obj}; pick: ["v", "bid", "cl", "obj"])`;
  return E.run(handle, text, { params: {} }).rows ?? [];
};
/** probeAnswers(E, handle, { pair, sides: { a: { about, where }, b: { about, where } }, probes: [name] }) -> [{ cell, kind, addr, body, of }] */
export function probeAnswers(E, handle, { pair, sides, probes }) {
  if (typeof pair !== "string" || !pair.startsWith("pair:")) throw new TypeError("probeAnswers: pair is the pair-question address, pair:<sha16>");
  const sha = pair.slice(5), out = [];
  for (const side of ["a", "b"]) for (const probe of probes) {
    const rows = readSide(E, handle, { ...sides[side], probe }), vals = [...new Set(rows.map((r) => nm(r.v)))].sort(), ids = [...new Set(rows.map((r) => r.bid))].sort();
    const body = { pair, side, probe, value: vals.length === 0 ? null : vals.length === 1 ? vals[0] : JSON.stringify(vals), addr: rows.length ? [...new Set(rows.map((r) => r.cl))].sort()[0] : `answer:${sha}:${side}:${probe}` };
    if (vals.length === 0) body.why = "silent: no positive claim of this relation about this being inside this ground";
    else if (rows.some((r) => r.obj !== "literal")) body.referent = true;
    out.push({ cell: "INS·Figure", kind: "probe-answer", addr: `answer:${sha}:${side}:${probe}`, body, of: ids });
  }
  return out;
}
