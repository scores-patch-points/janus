// organs/claim-links.mjs: a CLAIM as pharos entries, built only from the operators (no "fact" primitive). A claim is Ground, Figure, Pattern (khora kernel/gfp-claim.js):
//   being    INS·Figure   a thing exists (kind `being`, addr `being:<name>`)
//   claim    DEF·Pattern  the relation with its POLARITY, a declared nature of this statement (kind `claim`, addr `claim:<n>`, body { rel, polarity })
//   bond     CON·Figure   the Figure: a link from the subject being to the value being (kind `bond`, addr = subject, body { to, claim }, of: [the claim entry's id])
//   within   CON·Figure   containment between beings (kind `within`, addr = the contained being, body { to })
// A relation is a KIND, not a column; the polarity is read from the Pattern entry, never guessed from a bond. Absence (NUL) is not denial: a negated claim is a claim with polarity "-".
// Pure over the injected pharos library `P` (the one door); it writes nothing but entries.
export const KINDS = Object.freeze({ being: "INS·Figure", claim: "DEF·Pattern", bond: "CON·Figure", within: "CON·Figure" });
/** declare the four kinds (idempotent: a kind already declared is left alone) */
export function declareKinds(P, h) {
  for (const [name, cell] of Object.entries(KINDS)) { try { P.weave(h, { cell: "DEF·Figure", kind: "kind", addr: `kind:${name}`, body: { name, cell } }); } catch (e) { if (!/EXISTS|DECLARED|SAME/i.test(`${e?.code} ${e?.message}`)) throw e; } }
}
/** weaveClaims(P, h, claims, containers): claims = [{ rel, a, b, polarity }], containers = { child: parent }. Returns { beings, claims, within } counts. */
export function weaveClaims(P, h, claims, containers = {}) {
  declareKinds(P, h); const beings = new Set(); let n = 0, w = 0;
  const be = (name) => { if (!beings.has(name)) { beings.add(name); P.weave(h, { cell: "INS·Figure", kind: "being", addr: `being:${name}`, body: { name } }); } };
  claims.forEach((c, i) => {
    if (c.a == null || c.b == null || !c.rel) return;
    be(c.a); be(c.b);
    const cl = P.weave(h, { cell: "DEF·Pattern", kind: "claim", addr: `claim:${i}`, body: { rel: c.rel, polarity: c.polarity === "-" ? "-" : "+" } });
    P.weave(h, { cell: "CON·Figure", kind: "bond", addr: `being:${c.a}`, body: { to: `being:${c.b}`, claim: `claim:${i}` }, of: [cl.id] }); n++;
  });
  for (const [child, parent] of Object.entries(containers)) { be(child); be(parent); P.weave(h, { cell: "CON·Figure", kind: "within", addr: `being:${child}`, body: { to: `being:${parent}` } }); w++; }
  return { beings: beings.size, claims: n, within: w };
}
