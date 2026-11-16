// set-correspondence.mjs — the geometry of three or more bodies (seam 2, CONTRACT H.3; 2026-11-15).
// Nodes: every clause unit of every member text. Edges: for every unordered pair of members, the mutual strictly
// best links of unit-news.mjs (distinct shared content keys), computed between them. Components by union-find, each
// with the texts it spans. Counts, and a null that redeals each member's content rows among its own units.
//
// Janus connects; it does not group. A component is where links run, not a class: a ring (x~y, y~z, x and z
// unlinked) is one component and is reported with its links as they are, never closed into x~z and never split.
// Whether any of it is "the same" is Penelope's, from her own pair calls (CONTRACT H.4), not from these links.
//
//   setCorrespondence(members, { seed, redeals }) -> { members, links, components, counts, null }
//   members  [{ text: "text:<sha16>", rows, units }], any order: they are taken in text-address order, so the
//            result is a function of WHO is in the set, never of the order they arrived in (CONTRACT I.3)
//   seed     "set-links:<name>:<n>"; redeals 50
import { rng } from '../hyperlexicon/word-evidence.mjs';
import { checkUnits, mutualLinks, redeal, LINK_REDEALS } from './unit-news.mjs';

const keySet = (rows, idx) => new Set(idx.map((i) => rows[i].key));
const sharedCount = (A, B) => { let n = 0; for (const k of A) if (B.has(k)) n += 1; return n; };
const byAddr = (p, q) => (p.text < q.text ? -1 : p.text > q.text ? 1 : 0);

/** links and components over per-member key sets (sets[m][k] = the key set of member m's k-th unit) */
function geometry(sets) {
  const links = [];
  for (let x = 0; x < sets.length; x++) for (let y = x + 1; y < sets.length; y++) {
    mutualLinks(sets[x], sets[y]).forEach((ky, kx) => { if (ky >= 0) links.push([x, kx, y, ky, sharedCount(sets[x][kx], sets[y][ky])]); });
  }
  // union-find over nodes "m:k"
  const id = new Map(), parent = [];
  sets.forEach((S, m) => S.forEach((_, k) => { id.set(`${m}:${k}`, parent.length); parent.push(parent.length); }));
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (const [x, kx, y, ky] of links) { const a = find(id.get(`${x}:${kx}`)), b = find(id.get(`${y}:${ky}`)); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); }
  const groups = new Map();
  sets.forEach((S, m) => S.forEach((_, k) => { const r = find(id.get(`${m}:${k}`)); if (!groups.has(r)) groups.set(r, []); groups.get(r).push([m, k]); }));
  const components = [...groups.values()];   // nodes are visited in (member, unit) order, so each list and the list of lists are in that order
  const byTexts = {};
  for (const c of components) { const k = new Set(c.map(([m]) => m)).size; byTexts[k] = (byTexts[k] ?? 0) + 1; }
  return { links, components, byTexts };
}

/** setCorrespondence(members, { seed, redeals }) -> the set-correspondence body's geometry. Pure. */
export function setCorrespondence(members, { seed, redeals = LINK_REDEALS } = {}) {
  if (!Array.isArray(members)) throw new TypeError('setCorrespondence needs a member list');
  if (typeof seed !== 'string' || !seed) throw new TypeError('setCorrespondence needs a seed string');
  const M = [...members].sort(byAddr);
  for (let m = 1; m < M.length; m++) if (M[m].text === M[m - 1].text) throw new TypeError(`member ${M[m].text} is listed twice`);
  for (const X of M) { const why = checkUnits(X.rows, X.units); if (why) throw new TypeError(`${X.text}: ${why}`); }
  const sets = M.map((X) => X.units.map((x) => keySet(X.rows, x.content)));
  const g = geometry(sets);
  const node = (m, k) => ({ text: M[m].text, u: M[m].units[k].u });
  const links = g.links.map(([x, kx, y, ky, shared]) => ({ x: node(x, kx), y: node(y, ky), shared }));
  const components = g.components.map((c) => ({ units: c.map(([m, k]) => node(m, k)), texts: [...new Set(c.map(([m]) => M[m].text))], size: c.length }));
  const linked = new Set(g.links.flatMap(([x, kx, y, ky]) => [`${x}:${kx}`, `${y}:${ky}`]));
  const multi = g.components.filter((c) => new Set(c.map(([m]) => m)).size < c.length).length;
  // the null: per redeal, each member's content rows dealt among its own units, members in address order, one generator
  const r = rng(seed), nullLinks = [], nullByTexts = [];
  for (let t = 0; t < redeals; t++) {
    const dealt = M.map((X) => redeal(X.units, r).map((idx) => keySet(X.rows, idx)));
    const h = geometry(dealt);
    nullLinks.push(h.links.length); nullByTexts.push(h.byTexts);
  }
  return {
    members: M.map((X) => X.text), links, components,
    counts: { units: sets.reduce((s, S) => s + S.length, 0), linkedUnits: linked.size, components: components.length, singletons: components.filter((c) => c.size === 1).length, byTexts: g.byTexts, multi },
    null: { seed, redeals, links: nullLinks, byTexts: nullByTexts },
  };
}
