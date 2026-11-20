// organs/claims-to-hyperedges.mjs: the claims (SEG·Pattern with a bond, from claims-from-rows) as the stack's own material, EOHyperedge@1: an ordered pair of referent ends, a relation, a witness, a position. This is MATERIAL PRESENT: what the text said, witnessed at its sentence.
// A composition of two such edges through a shared referent (hire(Maria, Victor) then live_in(Victor, York)) is a chain SITE: present in the material. Whether the chain may be USED (read as "where the person Maria hired lives") is not in the material: it needs a GIVEN affordance, a prior with a named giver (khora kernel/hyperlexicon.js). Experience may nominate; only a giver licenses.
// Pure, no model, no network, no regex. A claim with a literal object, a negative polarity, or a missing end makes no edge (a literal is not a referent to bridge through; a negation is not a relation that composes); each is counted, never silently dropped.
export function toHyperedges(claims, { doc = "doc" } = {}) {
  const edges = [], skipped = { literal: 0, negative: 0, incomplete: 0 };
  claims.forEach((c, i) => {
    if (c.a == null || c.b == null || !c.rel) { skipped.incomplete++; return; }
    if (c.polarity === "-") { skipped.negative++; return; }
    if (c.object === "literal") { skipped.literal++; return; }
    const seq = Number(String(c.at ?? "").slice(1)); const ref = (x) => Object.freeze({ standing: "referent", ref: x });
    edges.push(Object.freeze({ schema: "EOHyperedge@1", id: `edge:${i}`, relation: c.rel, participants: Object.freeze([ref(c.a), ref(c.b)]), witness: `${doc}#${c.at ?? i}`, scope: Object.freeze({ sequencePosition: Number.isFinite(seq) ? seq : i }), eo: Object.freeze({ grain: "Figure" }) }));
  });
  return { edges, skipped };
}
