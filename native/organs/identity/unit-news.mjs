// unit-news.mjs — news each way, one clause unit at a time (seam 2, CONTRACT B.2 and B.3; 2026-11-15).
// For an ordered pair (ground G, news N), per clause unit u of N: which of u's content rows have an identical
// key among G's content rows, how many distinct content keys u shares with each unit of G, the word pairs that
// identity does not settle (with their word evidence both ways, raw), and u's mutual-strictly-best link into G,
// with a null that redeals each text's content rows among its own units. Janus's geometry, counts only: no
// bound, no quantile, no threshold, no "held", no "same". Whether a share is enough is Penelope's.
//
//   unitNews(G, N, evidence, { seed, redeals }) -> { units, evidence, linkNull, counts }
//   G, N      { rows, units }: a text-reading's rows (each { key, upos, ... }) and its clause-units' units
//             (each { u, say, content, ... }; content = indexes into rows, the parser's CONTENT tags, Khora's cut)
//   evidence  (x, y) -> WORDEVIDENCE; asked once per distinct (nw, gw) in each direction, never for identical keys
//   seed      the link null's seed: "unit-links:<news sha>" (CONTRACT B.3); redeals 50
//
// The testimony (B.4, "held") is not here: it needs a model and is added by the weaver (unit-evidence-pharos.mjs).
// A unit's content is its OWN rows only: borrowed rows and args belong to other units (CONTRACT B.1).
import { rng } from '../hyperlexicon/word-evidence.mjs';

export const LINK_REDEALS = 50;

/** why a { rows, units } cannot be read (an index out of range, no content list), or null. Pure. */
export function checkUnits(rows, units) {
  if (!Array.isArray(rows)) return 'rows are not a list';
  if (!Array.isArray(units)) return 'units are not a list';
  for (const x of units) {
    if (!Number.isInteger(x?.u)) return 'a unit has no index';
    if (!Array.isArray(x.content)) return `unit ${x.u} has no content list`;
    for (const i of x.content) if (!Number.isInteger(i) || i < 0 || i >= rows.length) return `unit ${x.u} names row ${i}, not in the reading`;
  }
  return null;
}

/** the content row indexes of a text, every unit's own content, ascending */
export const contentRowsOf = (units) => [...new Set(units.flatMap((x) => x.content))].sort((p, q) => p - q);

/** distinct keys of a list of row indexes */
const keySet = (rows, idx) => new Set(idx.map((i) => rows[i].key));
const sharedCount = (A, B) => { let n = 0; for (const k of A) if (B.has(k)) n += 1; return n; };

/** best[i] = the index into `others` with the strictly largest shared count (>= 1), else -1 */
function bests(sets, others) {
  return sets.map((S) => {
    let best = -1, top = 0, tie = false;
    others.forEach((O, k) => { const c = sharedCount(S, O); if (c > top) { top = c; best = k; tie = false; } else if (c === top && c > 0) tie = true; });
    return top >= 1 && !tie ? best : -1;
  });
}

/**
 * mutualLinks(nSets, gSets) -> [k into gSets | -1] per entry of nSets: mutual strictly best (CONTRACT B.3).
 * Parameter free: nothing is tuned. Symmetric: swapping the two sides gives the same links, read the other way.
 */
export function mutualLinks(nSets, gSets) {
  const bn = bests(nSets, gSets), bg = bests(gSets, nSets);
  return bn.map((v, k) => (v >= 0 && bg[v] === k ? v : -1));
}

/** deal the content rows of a text back among its own units, keeping each unit's number of content rows. Uses r. */
export function redeal(units, r) {
  const all = units.flatMap((x) => x.content), order = [...all];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }   // word-evidence.mjs's shuffle
  let at = 0;
  return units.map((x) => { const got = order.slice(at, at + x.content.length); at += x.content.length; return got; });
}

/** the link null of B.3: per redeal, G's rows dealt first then N's, from one generator seeded by `seed`; -> linked counts */
export function linkNull(G, N, { seed, redeals = LINK_REDEALS }) {
  if (typeof seed !== 'string' || !seed) throw new TypeError('linkNull needs a seed string');
  const r = rng(seed), linked = [];
  for (let k = 0; k < redeals; k++) {
    const g = redeal(G.units, r).map((idx) => keySet(G.rows, idx)), n = redeal(N.units, r).map((idx) => keySet(N.rows, idx));
    linked.push(mutualLinks(n, g).filter((v) => v >= 0).length);
  }
  return { seed, redeals, linked };
}

/** unitNews(G, N, evidence, { seed, redeals }) -> the mechanical half of a unit-news body. Pure apart from `evidence`. */
export function unitNews(G, N, evidence, { seed, redeals = LINK_REDEALS } = {}) {
  for (const [name, X] of [['G', G], ['N', N]]) { const why = checkUnits(X?.rows, X?.units); if (why) throw new TypeError(`unitNews ${name}: ${why}`); }
  if (typeof evidence !== 'function') throw new TypeError('unitNews needs an evidence function');
  const gRows = contentRowsOf(G.units), nRows = contentRowsOf(N.units);
  const gKeys = keySet(G.rows, gRows), nKeys = keySet(N.rows, nRows);
  const unmatchedG = gRows.filter((i) => !nKeys.has(G.rows[i].key));
  const gSets = G.units.map((v) => keySet(G.rows, v.content)), nSets = N.units.map((x) => keySet(N.rows, x.content));
  const links = mutualLinks(nSets, gSets);
  const table = {}, ask = (nw, gw) => { const k = nw + '\u0000' + gw; if (!(k in table)) table[k] = { ng: evidence(nw, gw), gn: evidence(gw, nw) }; };
  let identicalRows = 0, wordPairs = 0;
  const units = N.units.map((x, k) => {
    const own = [...x.content].sort((p, q) => p - q);
    const identical = [];
    for (const j of own) { const is = gRows.filter((i) => G.rows[i].key === N.rows[j].key); if (is.length) { identical.push([j, is]); identicalRows += 1; } }
    const byUnit = [];
    G.units.forEach((v, m) => { const c = sharedCount(nSets[k], gSets[m]); if (c > 0) byUnit.push([v.u, c]); });
    byUnit.sort((p, q) => p[0] - q[0]);
    const pairs = [];
    for (const j of own) {
      if (gKeys.has(N.rows[j].key)) continue;
      for (const i of unmatchedG) { const nw = N.rows[j].key, gw = G.rows[i].key; pairs.push({ j, i, nw, gw }); ask(nw, gw); }
    }
    wordPairs += pairs.length;
    return { u: x.u, say: x.say ?? null, content: own, identical, byUnit, link: links[k] >= 0 ? G.units[links[k]].u : null, pairs };
  });
  return {
    units, evidence: table, linkNull: linkNull(G, N, { seed, redeals }),
    counts: { units: units.length, contentRows: nRows.length, identicalRows, linked: units.filter((x) => x.link !== null).length, wordPairs },
  };
}
