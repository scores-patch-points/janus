// antlib.mjs: the pieces of the ant colony of PREREG-ANT-COLONY-SURPRISE (stamp in its .sha256short): programs over a token stream, the dependency-order guard, the ants' walk over khora's own stigmergy functions, the search-aware ceiling's permuted copy, and the gold-agreement report.
// A PROGRAM is an ordered list of moves: `cut:<s>` (operator SEG) splits s off the end of every current token ending with s; `join:<s>` (operator CON) re-attaches a standalone piece that an earlier cut:<s> produced to its left neighbour.
// THE DEPENDENCY ORDER (guard on): all SEG moves before any CON move; join:<s> only after cut:<s> in the same program; no move twice. Guard off: any move in any order, no move twice.
// No regex, no word list, no model. Gold tokens are read ONLY by goldF1. Constants are labelled: MIN, DEPTH, STOP, EXPLORE are ARBITRARY CONSTANTS of ours (EXPLORE borrowed from structure-swarm.js).
import { routeOrderFor, deposit } from "../../../khora/native/kernel/stigmergy.js";
export const MIN = 20, DEPTH = 4, STOP = 0.25, EXPLORE = 0.35, OPS = Object.freeze({ cut: "SEG", join: "CON" }), ORDER = Object.freeze({ SEG: 3, CON: 4 });   // helix positions: NUL 0 SIG 1 INS 2 SEG 3 CON 4 SYN 5 DEF 6 EVA 7 REC 8
export const kindOf = (m) => m.slice(0, m.indexOf(":")), argOf = (m) => m.slice(m.indexOf(":") + 1), opOf = (m) => OPS[kindOf(m)];
const hasLetter = (t) => [...t].some((c) => c.toLowerCase() !== c.toUpperCase());
export const items = (tokens) => tokens.map((t) => ({ t, tag: null, a: 0, b: t.length }));
export function cut(its, s) { const sl = [...s].length, out = []; for (const it of its) { if (!it.t.endsWith(s) || it.t.length <= s.length) { out.push(it); continue; } const cs = [...it.t]; if (cs.length > sl && hasLetter(it.t)) { const stem = cs.slice(0, cs.length - sl).join(""); out.push({ t: stem, tag: it.tag, a: it.a, b: it.a + stem.length }, { t: s, tag: s, a: it.a + stem.length, b: it.b }); } else out.push(it); } return out; }
export function join(its, s) { const out = []; for (const it of its) { if (it.tag === s && out.length) { const p = out.pop(); out.push({ t: p.t + it.t, tag: null, a: p.a, b: it.b }); } else out.push(it); } return out; }
export const apply = (its, spec) => spec.reduce((cur, m) => (kindOf(m) === "cut" ? cut(cur, argOf(m)) : join(cur, argOf(m))), its);
/** the moves a program may take next. guard on: the helix order; guard off: anything unused. */
export function allowed(spec, routes, guard) {
  const used = new Set(spec); let pool = routes.filter((r) => !used.has(r)); if (!guard) return pool;
  const cuts = new Set(spec.filter((m) => kindOf(m) === "cut").map(argOf)), hasJoin = spec.some((m) => kindOf(m) === "join");
  return pool.filter((r) => (kindOf(r) === "cut" ? !hasJoin : cuts.has(argOf(r))));
}
/** one ant: walk start -> move* by the learned order of the head (or uniformly, for the twin). rng and now are injected. */
export function walk(trails, { routes, rng, now, tried, guard, useTrails }) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const spec = [];
    for (let d = 0; d < DEPTH; d++) {
      const pool = allowed(spec, routes, guard); if (!pool.length) break;
      const head = spec.length ? `prog|after:${spec[spec.length - 1]}` : "prog|start"; let step;
      if (useTrails) { const order = routeOrderFor(trails, head, { now, routes: pool, rng }).filter((r) => pool.includes(r)); step = rng() < EXPLORE || attempt > 6 ? order[Math.floor(rng() * order.length)] : order[0]; } else step = pool[Math.floor(rng() * pool.length)];
      spec.push(step); if (rng() < STOP) break;
    }
    if (spec.length && !tried.has(spec.join(" > "))) return spec;
  }
  return null;
}
export const layTrail = (trails, spec, ok, i, now) => { let t = trails, prev = null; if (!ok) return t; for (const m of spec) { t = deposit(t, { head: prev ? `prog|after:${prev}` : "prog|start", route: m, ok: true, ms: i, at: now }); prev = m; } return t; };
export const lcg = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
/** the search-aware ceiling's null: every token's characters permuted (seeded): word-internal structure destroyed, the shape of the stream kept */
export function permuteTokens(tokens, seed) { const r = lcg(seed); return tokens.map((t) => { const c = [...t]; for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c.join(""); }); }
/** candidate moves from the learning stream: every word-final string of 1 to 4 characters ending at least MIN distinct types and firing at least MIN times */
export function candidateMoves(tokens) {
  const types = new Map(); for (const w of new Set(tokens)) { const c = [...w]; if (!hasLetter(w)) continue; for (let k = 1; k <= 4 && k < c.length; k++) { const s = c.slice(-k).join(""); types.set(s, (types.get(s) ?? 0) + 1); } }
  const out = []; for (const [s, n] of types) { if (n < MIN) continue; let fires = 0; for (const w of tokens) if (w.endsWith(s) && [...w].length > [...s].length) fires++; if (fires >= MIN) out.push(s); } out.sort();
  return [...out.map((s) => `cut:${s}`), ...out.map((s) => `join:${s}`)];
}
/** GOLD AGREEMENT (the only place gold tokens are read): token-boundary precision, recall, F1 of a program on a treebank's raw sentences against its gold tokenization */
export function goldF1(sentences, spec, tokenize) {
  const bset = (sp) => { const s = new Set(); for (const [a, b] of sp) { s.add(a); s.add(b); } return s; }; const T = [0, 0, 0];
  for (const { raw, gold } of sentences) {
    let cur = 0, gs = []; let ok = true; for (const f of gold) { const at = raw.indexOf(f, cur); if (at < 0) { ok = false; break; } gs.push([at, at + f.length]); cur = at + f.length; } if (!ok) continue;
    const base = tokenize(raw); let c2 = 0; const its = []; ok = true; for (const w of base) { const at = raw.indexOf(w, c2); if (at < 0) { ok = false; break; } its.push({ t: w, tag: null, a: at, b: at + w.length }); c2 = at + w.length; } if (!ok) continue;
    const pb = bset(apply(its, spec).map((x) => [x.a, x.b])), gb = bset(gs); let tp = 0; for (const b of pb) if (gb.has(b)) tp++; T[0] += tp; T[1] += pb.size; T[2] += gb.size;
  }
  const P = T[0] / T[1], R = T[0] / T[2]; return { P, R, F1: (2 * P * R) / (P + R) };
}
