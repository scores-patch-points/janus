// janus/native/organs/consequence.js — THE CONSEQUENCE ORGAN (2026-10-11).
// Janus TESTS WHAT FOLLOWS FROM THE RECORD: this is the face that turns a
// retained prediction and a held-out record into the verdict that EARNs or
// DEFEATS a Hyperlexicon row (khora's routeReadingOutcome consumes it
// verbatim). The bar is the battery's own, pre-registered, never fitted:
//   success  = effect(top-quartile vs rest) >= 0.15  AND  selection-aware
//              shuffle pValue <= 0.05 (500 draws, permuting the prediction
//              score while holding the outcome assignment fixed — the same
//              content-vs-shell discipline as every falsifier, now the logic's
//              own voice).
// Pure; reads injected, never imported (janus's seam). Base (rng) crossed from
// the khora as sibling — the sanctioned no-duplication pattern.
import { createSeededRng, shuffled } from "../../../khora/native/kernel/rng.js";

export const CONSEQUENCE_SCHEMA = "EOConsequenceVerdict@1";
export const CONSEQUENCE_BAR = Object.freeze({ effect: 0.15, alpha: 0.05, shuffles: 500 });

const freeze = (v) => Object.freeze(v);
const rngAt = (seed) => { let s = (seed | 0) + 0x6D2B79F5; return () => { s = (s + 0x6D2B79F5) >>> 0; let q = s; q = Math.imul(q ^ (q >>> 15), q | 1); q ^= q + Math.imul(q ^ (q >>> 7), q | 61); return ((q ^ (q >>> 14)) >>> 0) / 4294967296; }; };

function effectOf(scores, ys) {
  const n = scores.length;
  // RANK-BASED top-quarter split: avoids value-threshold class collapse when
  // scores are bimodal/tie-heavy (a threshold at the floor tier would put
  // everyone in the positive class and silence the negative — the degenerate
  // class bug the battery has caught before). Ties broken deterministically by
  // index; the result is a comparison of the top quarter vs the rest.
  const order = scores.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const k = Math.max(1, Math.floor(n * 0.25));
  const pos = [], neg = [];
  order.forEach(([, i], r) => (r < k ? pos : neg).push(ys[i]));
  if (!pos.length || !neg.length) return 0;
  const ph = pos.reduce((a, b) => a + b, 0) / pos.length;
  const qh = neg.reduce((a, b) => a + b, 0) / neg.length;
  return ph - qh;
}

/**
 * consequenceVerdict — the verdict on a retained prediction.
 *   predictOf  ref -> predicted score (0..1) for the outcome
 *   actualOf   ref -> 1 | 0 (the held-out appearance/consequence)
 *   refs       the evaluated population
 *   method     the consequence name, e.g. "held_out_future"
 * Returns { schema, method, success, effect, pValue, at, witness }.
 */
export function consequenceVerdict({ predictOf, actualOf, refs, method = "held_out_consequence", seed = 1, witness = "janus:consequence@1" } = {}) {
  if (!refs?.length || typeof predictOf !== "function" || typeof actualOf !== "function") {
    throw new TypeError("consequenceVerdict requires refs[], predictOf(ref), actualOf(ref)");
  }
  const scores = refs.map(predictOf);
  const ys = refs.map(actualOf);
  const effect = effectOf(scores, ys);

  const { shuffles } = CONSEQUENCE_BAR;
  let beats = 0;
  for (let k = 0; k < shuffles; k += 1) {
    const perm = shuffled(scores, rngAt(seed * 7919 + k));
    if (effectOf(perm, ys) >= effect) beats += 1;
  }
  const pValue = (beats + 1) / (shuffles + 1);
  const success = effect >= CONSEQUENCE_BAR.effect && pValue <= CONSEQUENCE_BAR.alpha;

  return freeze({
    schema: CONSEQUENCE_SCHEMA,
    method,
    success,
    effect,
    pValue,
    n: refs.length,
    at: new Date().toISOString(),
    witness,
    bar: freeze({ ...CONSEQUENCE_BAR }),
  });
}

export default { CONSEQUENCE_SCHEMA, CONSEQUENCE_BAR, consequenceVerdict };