// organs/claim-links.mjs: a CLAIM as pharos entries, built only from the operators (no "fact" primitive). A claim is Ground, Figure, Pattern (khora kernel/gfp-claim.js):
//   being    INS·Figure   a thing exists (kind `being`, addr `being:<name>`)
//   claim    DEF·Pattern  the relation with its POLARITY, a declared nature of this statement (kind `claim`, addr `claim:<n>`, body { rel, polarity })
//   bond     CON·Figure   the Figure: a link from the subject being to the value being (kind `bond`, addr = subject, body { to, claim }, of: [the claim entry's id])
//   within   CON·Figure   containment between beings (kind `within`, addr = the contained being, body { to })
//   ground   SEG·Ground   WHERE a claim holds, and WHEN: two axes of ground, `where:<name>` and `when:<name>` (a time is a ground, not a number: no arithmetic). `where:*` and `when:*` are the roots (holds everywhere, always).
//   holds_in CON·Figure   containment between grounds (addr = the inner ground, body { to }); a ground with no declared parent is inside its axis root. Two claims meet only where their grounds OVERLAP (equal, or one holds the other); siblings never meet.
// A relation is a KIND, not a column; the polarity is read from the Pattern entry, never guessed from a bond. Absence (NUL) is not denial: a negated claim is a claim with polarity "-".
// Pure over the injected pharos library `P` (the one door); it writes nothing but entries.
export const KINDS = Object.freeze({ being: "INS·Figure", claim: "DEF·Pattern", bond: "CON·Figure", within: "CON·Figure", ground: "SEG·Ground", holds_in: "CON·Figure" });
export const ROOT = Object.freeze({ where: "where:*", when: "when:*" });
/** declare the four kinds (idempotent: a kind already declared is left alone) */
export function declareKinds(P, h) {
  for (const [name, cell] of Object.entries(KINDS)) { try { P.weave(h, { cell: "DEF·Figure", kind: "kind", addr: `kind:${name}`, body: { name, cell } }); } catch (e) { if (!/EXISTS|DECLARED|SAME/i.test(`${e?.code} ${e?.message}`)) throw e; } }
}
/** weaveClaims(P, h, claims, containers, grounds): claims = [{ rel, a, b, polarity, object, where, when }] (where/when default to the roots; object is "referent" or "literal", default referent), containers = { child: parent } (beings),
 *  grounds = { where: { child: parent }, when: { child: parent } } (a ground with no parent is inside its root). Returns counts. */
export function weaveClaims(P, h, claims, containers = {}, grounds = {}) {
  declareKinds(P, h); const beings = new Set(), gr = new Map(); let n = 0, w = 0; const positions = [];
  const be = (name) => { if (!beings.has(name)) { beings.add(name); P.weave(h, { cell: "INS·Figure", kind: "being", addr: `being:${name}`, body: { name } }); } };
  const ground = (axis, name) => {                                    // a ground exists once; a non-root ground is held by its declared parent, else by the root
    const addr = name === "*" ? ROOT[axis] : `${axis}:${name}`; if (gr.has(addr)) return gr.get(addr);
    const e = P.weave(h, { cell: "SEG·Ground", kind: "ground", addr, body: { axis, name } }); gr.set(addr, e.id);
    if (name !== "*") { const parent = (grounds[axis] ?? {})[name]; const pa = ground(axis, parent ?? "*"); P.weave(h, { cell: "CON·Figure", kind: "holds_in", addr, body: { to: parent == null ? ROOT[axis] : `${axis}:${parent}` }, of: [e.id, gr.get(parent == null ? ROOT[axis] : `${axis}:${parent}`)] }); }
    return e.id;
  };
  claims.forEach((c, i) => {
    if (c.a == null || c.b == null || !c.rel) return;
    be(c.a); be(c.b);
    const gw = c.where ?? "*", gt = c.when ?? "*", gid = ground("where", gw), tid = ground("when", gt);
    const cl = P.weave(h, { cell: "DEF·Pattern", kind: "claim", addr: `claim:${i}`, body: { rel: c.rel, polarity: c.polarity === "-" ? "-" : "+", object: c.object === "literal" ? "literal" : "referent", ground: gw === "*" ? ROOT.where : `where:${gw}`, when: gt === "*" ? ROOT.when : `when:${gt}` }, of: [gid, tid] });
    P.weave(h, { cell: "CON·Figure", kind: "bond", addr: `being:${c.a}`, body: { to: `being:${c.b}`, claim: `claim:${i}` }, of: [cl.id] }); n++; positions.push(P.entries(h).length);
  });
  for (const [child, parent] of Object.entries(containers)) { be(child); be(parent); P.weave(h, { cell: "CON·Figure", kind: "within", addr: `being:${child}`, body: { to: `being:${parent}` } }); w++; }
  return { beings: beings.size, claims: n, within: w, grounds: gr.size, positions };      // positions[i] = the log position after claim i: a causal cut for `asof`
}
