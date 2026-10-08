import test from "node:test";
import assert from "node:assert/strict";
import { appendPass } from "../../../khora/native/the-fold/weft.js";
import {
  referentVectors, induceKinds, frequencyBands, goldSeparation, shuffledCompanyNull, falsifyKinds, jaccard, cosine,
} from "./kind-induction.js";

// ── fixture: two planted kinds — A (gold=1), B (gold=0) — company SEPARATED of structure ──
const GROUPS = {
  A: ["a1", "a2", "a3", "a4", "a5", "a6"],   // gold
  B: ["b1", "b2", "b3", "b4", "b5", "b6"],   // not gold
};
// varied mention counts so a FREQUENCY band cannot separate gold from not-gold
const MENTIONS = { a1: 40, a2: 3, a3: 12, a4: 5, a5: 25, a6: 2, b1: 38, b2: 4, b3: 11, b4: 6, b5: 22, b6: 1 };

const rel = (relation, a, b) => ({ relation, scope: { byteOffset: 0 }, participants: [{ ref: a, surface: a, standing: "referent" }, { ref: b, surface: b, standing: "referent" }] });

function fixtureWeft() {
  let w = [];
  // 6 passes. In each, a reading pairs members WITHIN each group (covings of the group's company);
  // crosses are few, so the groups' vectors stay nearly disjoint and internally coherent.
  for (let pass = 0; pass < 6; pass += 1) {
    const relations = [];
    for (const g of ["A", "B"]) {
      const members = GROUPS[g];
      for (let i = 0; i < members.length; i += 1) for (let j = i + 1; j < members.length; j += 1) {
        if ((i + j + pass) % 3 === 0) relations.push(rel("keeps-company", members[i], members[j]));
      }
    }
    relations.push(rel("touches", GROUPS.A[0], GROUPS.B[0]));  // ONE cross for the whole fixture — groups stay company-disjoint
    w = appendPass(w, { address: `p${pass}.txt`, category: "x", cast: GROUP_CAST(pass), relations });
  }
  return w;
}
// casts give each referent its declared mention count ONCE (on its first pass)
const GROUP_CAST = (pass) => {
  const cast = [];
  for (const g of ["A", "B"]) {
    const m = GROUPS[g][pass] ?? null;
    if (!m) continue;
    const at = Array.from({ length: MENTIONS[m] }, (_, k) => k);
    cast.push({ ref: m, surface: m, allSurfaces: [m], mentionsAt: at });
  }
  return cast;
};

const goldOf = (v) => (String(v?.ref ?? v).startsWith("a") ? 1 : 0);

test("the induction recovers the planted kinds from COMPANY structure alone (never frequency)", () => {
  const weft = fixtureWeft();
  const vecs = [...referentVectors(weft).values()];
  const kinds = induceKinds(vecs, { threshold: 0.2 });
  assert.ok(kinds.length >= 2, `expected at least the two planted kinds, got ${kinds.length}`);
  const big = kinds.filter((k) => k.size >= 4);
  assert.ok(big.length >= 2, "two kinds of size >= 4");
  const aBig = big.find((k) => k.members.every((m) => m.startsWith("a")));
  const bBig = big.find((k) => k.members.every((m) => m.startsWith("b")));
  assert.ok(aBig && bBig, `the big kinds must each be pure A or pure B, got ${JSON.stringify(big.map((k) => k.members))}`);
});

test("a kind is more than a frequency band: induced separation beats the band and the shuffled-company null", () => {
  const weft = fixtureWeft();
  const v = falsifyKinds(weft, { goldOf, threshold: 0.2, nullDraws: 40, seed: 7 });
  assert.equal(v.verdict.survives, true, v.verdict.why.join(" | "));
  assert.ok(v.induced.separation > v.band.separation, `induced ${v.induced.separation} must beat band ${v.band.separation}`);
  assert.ok(v.induced.separation > v.null.p95 + v.sesoi, `induced ${v.induced.separation} must clear null p95 ${v.null.p95} + SESOI`);
});

test("the null is built to fail: a gold that does NOT track the structure is dissolved (the falsifier fires)", () => {
  const weft = fixtureWeft();
  // a gold predicate blind to company — orthogonal to the induced groups
  const blindGold = (v) => (String(v?.ref ?? v).length % 2 === 0 ? 1 : 0);
  const v = falsifyKinds(weft, { goldOf: blindGold, threshold: 0.2, nullDraws: 60, seed: 3 });
  // random gold: induced separation cannot be separated from the chance band of separation it shows
  assert.ok(v.null.beaten === false || Math.abs(v.induced.separation - v.null.p95) < 0.08,
    `blind gold must not clear the null: induced ${v.induced.separation} vs p95 ${v.null.p95}`);
});

test("band vs induced on a near-flat gold: a frequency band that catches gold is not a kind", () => {
  const weft = fixtureWeft();
  // gold = exactly the high-frequency members (a1, a5, b1, b5) — the band CAN separate this
  const freqGold = (v) => ([40, 25, 38, 22].includes(v?.mentionsAt?.length ?? -1) ? 1 : 0);
  const vecs = [...referentVectors(weft).values()];
  const induced = induceKinds(vecs, { threshold: 0.2 });
  const band = frequencyBands(vecs, { bands: 5 });
  const iSep = goldSeparation(induced, vecs, { goldOf: freqGold });
  const bSep = goldSeparation(band, vecs, { goldOf: freqGold });
  // the band finds it (frequency is the gold here), the company-kind shouldn't outperform it
  assert.ok(bSep > iSep - 1e-6, `band ${bSep} should capture a frequency-shaped gold at least as well as kind ${iSep}`);
});

test("similiarity measures agree on disjoint vs shared company", () => {
  const xy = { names: ["x", "y"], company: { x: 2, y: 3 }, total: 5 };
  const shared = { names: ["x", "y", "z"], company: { x: 2, y: 3, z: 1 }, total: 6 };
  const apart = { names: ["w", "q"], company: { w: 1, q: 4 }, total: 5 };
  assert.ok(jaccard(xy, shared) > 0 && jaccard(xy, shared) > jaccard(xy, apart));
  assert.ok(cosine(xy, shared) > cosine(xy, apart));
  assert.equal(jaccard(xy, apart), 0);
});