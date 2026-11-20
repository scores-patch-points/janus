// organs/claim-assertions.mjs: claims (the shape claim-links.mjs weaves: { rel, a, b, polarity, where?, when? }) as the assertions merge-gate.mjs reads.
// A claim says what a being has; a GROUND says where and when it holds (two axes, each a holds_in tree: where: {child: parent}, when: {child: parent}). A time is a ground, not
// a number, so there is no arithmetic here. Two claims MEET only where their grounds overlap on BOTH axes (equal, or one holds the other); a claim with no ground holds everywhere
// and always, so it meets all. Values that do not meet are INCOMPARABLE (sameValue/difference answer null): sibling times or places are change, never a conflict.
// A negated claim ("-") is not an assertion: absence is not denial and a denial is not a value, so it is left out of what a being asserts.
// The being key is INJECTED: per-document referents are bridged by a license, not by string equality (the caller's beingKey decides).
const holds = (tree, up, down) => { let c = down, n = 0; while (c != null && n++ < 64) { if (c === up) return true; c = tree[c]; } return false; };
/** do two grounds overlap on one axis? an absent ground is the root: it meets everything */
export const overlaps = (tree = {}, g1, g2) => g1 == null || g2 == null || g1 === g2 || holds(tree, g1, g2) || holds(tree, g2, g1);
export const meet = (grounds = {}) => (u, w) => overlaps(grounds.where, u.where, w.where) && overlaps(grounds.when, u.when, w.when);
/**
 * assertionsFromClaims(claims, { beingKey, grounds, sameValue, difference }) -> { referents, assertionsOf, sameValue, difference }
 *   assertionsOf(ref) -> [{ rel, value: { v, where, when, source }, id, ref }]
 * `source` is PROVENANCE: which document (an address) or host a claim was read from, given by the caller on the claim. It is NOT the ground: a ground says where or when a claim HOLDS and decides which claims MEET; two documents must be comparable, so a document is never a ground here. Independence is counted over sources: two claims from one source are ONE witness.   (ref is true unless the claim says otherwise: it is a witness flag for the gate)
 * The returned sameValue and difference wrap the caller's value comparison (default ===, and no difference): they answer null when the two values' grounds do not meet.
 */
export function assertionsFromClaims(claims = [], { beingKey = (x) => x, grounds = {}, sameValue = (u, v) => u === v, difference = () => null } = {}) {
  const meets = meet(grounds), by = new Map();
  claims.forEach((c, i) => {
    if (c.polarity === "-") return;
    const k = beingKey(c.a); if (!by.has(k)) by.set(k, []);
    by.get(k).push({ rel: c.rel, value: { v: beingKey(c.b), where: c.where ?? null, when: c.when ?? null, source: c.source ?? null }, id: `c${i}`, ref: c.ref ?? true });
  });
  const wrap = (f) => (u, w, ...rest) => (meets(u, w) ? f(u.v, w.v, ...rest) : null);
  return Object.freeze({ referents: [...by.keys()].sort(), assertionsOf: (r) => by.get(r) ?? [], sameValue: wrap(sameValue), difference: wrap(difference) });
}
