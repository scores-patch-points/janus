// univlib.mjs: PREREG-UNIVERSES (stamp in its .sha256short). Universes of a sentence: complete valid trees differing only at forked tokens. Pure functions; no regex, no word list, no model.
export const CORE = new Set(["nsubj", "obj", "iobj", "csubj", "ccomp", "xcomp"]), MOD = new Set(["obl", "nmod", "advcl", "acl", "advmod", "amod", "appos", "nummod"]);
export const family = (rel) => { const b = String(rel).split(":")[0]; return CORE.has(b) ? "CORE" : MOD.has(b) ? "MOD" : "OTHER"; };
/** heads: 1-based head per token (index i = token i+1), 0 = root. A tree has exactly one root and no cycle. */
export function validTree(heads) {
  let roots = 0; for (const h of heads) if (h === 0) roots++; if (roots !== 1) return false;
  const state = new Array(heads.length).fill(0);   // 0 new, 1 on path, 2 done
  for (let s = 0; s < heads.length; s++) { if (state[s]) continue; const path = []; let i = s; while (i >= 0 && state[i] === 0) { state[i] = 1; path.push(i); i = heads[i] === 0 ? -1 : heads[i] - 1; } if (i >= 0 && state[i] === 1) return false; for (const p of path) state[p] = 2; }
  return true;
}
/** forks: [{ i, A: {head, rel}, B: {head, rel}, pA }] ; base: head array for all other tokens. returns every assignment (bit k = 1 means B) with its head array, validity and weight */
export function universes(base, forks, weightOf = (f) => f.pA) {
  const out = [], n = forks.length;
  for (let mask = 0; mask < (1 << n); mask++) { const heads = base.slice(); let w = 1; forks.forEach((f, k) => { const useB = (mask >> k) & 1; heads[f.i] = useB ? f.B.head : f.A.head; const pa = weightOf(f); w *= useB ? 1 - pa : pa; }); out.push({ mask, heads, valid: validTree(heads), w }); }
  const z = out.filter((u) => u.valid).reduce((a, u) => a + u.w, 0); for (const u of out) u.p = u.valid && z > 0 ? u.w / z : 0;
  return out;
}
/** marginal weight that fork k takes B across valid universes */
export const marginalB = (us, k) => us.reduce((a, u) => a + (u.valid && (u.mask >> k) & 1 ? u.p : 0), 0);
