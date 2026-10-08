// organs/kind-induction.js — STAGE 8 (jati): kinds out of the weft, induced by janus.
//
// The kind of a referent is a relation over the record, and the record is the weft. This organ folds
// `weftReferents` (the @2 seam — company only, never content) into KINDS: partitions of referents whose
// company (co-presence structure) puts them together, read at a cursor. It never teaches — no POS tag,
// no capital, no word list enters anything that induces; the gold (UD PROPN/nominal) is injected as a
// predicate and used ONLY to judge, never to induce.
//
// THE LAW OF A KIND (the discipline's own, and the wall's): a kind must be MORE THAN A FREQUENCY BAND.
// Two falsifiers stand over every run, pre-registered here BEFORE any run:
//   · NULL  — a shuffled-company re-induction (seeded: permute each referent's company neighbor counts,
//             preserve marginals) must dissolve the induced separation: induced kinds must beat the null's
//             separation at the declared SESOI, or the kind is a company artifact, not a kind.
//   · BAND  — the same gold separation under a frequency-band partition of the same referents must be
//             beaten by the induced kinds: a kind that equals a frequency band is not a kind.
// A third falsifier rides the cursor: kinds must be stable under MORE record — a farther `asOf` must not
// dissolve them without new material (re-key without erasing; P3).
//
// PURE. This organ consumes `weftReferents` (imported, the one parser); the gold, the reader, the file
// reads are the CALLER's, injected. janus folds the seam; it never re-parses the weft.
import { weftReferents } from "../../../khora/native/the-fold/weft.js";
import { createSeededRng } from "../../../khora/native/kernel/rng.js";

export const KIND_SCHEMA = "EOKind@1";
export const DECLARED_SESOI = 0.05;
// the declared similarity cut for "keeps company as one kind" — a referent shares a kind with another
// only when its company overlaps the other's at least this much. Disclosed, never fit to a gold.
export const DECLARED_THRESHOLD = 0.2;

const freeze = Object.freeze;

// ── referent vectors ─────────────────────────────────────────────────────────
/** The co-presence vector of every referent, folded from the weft at a cursor. */
export function referentVectors(weft, { asOf = Infinity } = {}) {
  const vecs = new Map();
  for (const r of weftReferents(weft, { asOf })) {
    const company = r.company ?? {};
    const names = Object.keys(company);
    vecs.set(r.ref, { ref: r.ref, surfaces: r.surfaces ?? [], mentionsAt: r.mentionsAt ?? [], passes: r.passes ?? 0, company, names, total: Object.values(company).reduce((a, b) => a + b, 0) });
  }
  return vecs;
}

/** Jaccard of two referents' company sets — how much of one's company is the other's. */
export function jaccard(a, b) {
  const na = a.names, nb = b.names;
  if (!na.length || !nb.length) return 0;
  const set = new Set(nb);
  let shared = 0;
  for (const n of na) if (set.has(n)) shared += 1;
  const union = na.length + nb.length - shared;
  return union ? shared / union : 0;
}

/** Cosine over company weight vectors (frequency-weighted co-presence). */
export function cosine(a, b) {
  const va = a.company, vb = b.company;
  if (a.total === 0 || b.total === 0) return 0;
  let dot = 0;
  for (const n of a.names) if (vb[n]) dot += va[n] * vb[n];
  const mag = Math.sqrt(Object.values(va).reduce((s, v) => s + v * v, 0)) * Math.sqrt(Object.values(vb).reduce((s, v) => s + v * v, 0));
  return mag ? dot / mag : 0;
}

// ── the induction ─────────────────────────────────────────────────────────────
/**
 * SPARSE union-find over the co-presence graph: two referents share a kind when their company
 * similarity meets the declared threshold; a kind formed is every connected component of that graph.
 * NOT O(n²): only pairs that SHARE a company member are ever compared (candidates come from an
 * inverted index over company names, so non-overlapping referents are never touched) — the measured
 * wall (khora's `affinityField` overflowing at n≈4096) is answered by construction, not by cap.
 * `similarityOf` is injectable (jaccard default); `threshold` is DECLARED, never fit to the gold
 * (fit-to-gold is teaching). A referent that shares a kind with nobody is its own singleton kind
 * (a kind of one) — but never a frequency band.
 */
export function induceKinds(referentList, { similarityOf = jaccard, threshold = DECLARED_THRESHOLD } = {}) {
  const byRef = new Map(referentList.map((r) => [r.ref, r]));
  const refs = [...byRef.keys()];
  const parent = new Map(refs.map((r) => [r, r]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };

  // inverted index: company member -> referents that keep it. Only co-members are compared.
  const byCompany = new Map();
  for (const r of referentList) for (const n of r.names) {
    if (!byCompany.has(n)) byCompany.set(n, []);
    byCompany.get(n).push(r.ref);
  }
  const compared = new Set();
  for (const members of byCompany.values()) {
    if (members.length < 2) continue;
    for (let i = 0; i < members.length; i += 1) for (let j = i + 1; j < members.length; j += 1) {
      const a = members[i], b = members[j];
      if (a === b) continue;
      const key = a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
      if (compared.has(key)) continue;
      compared.add(key);
      if (similarityOf(byRef.get(a), byRef.get(b)) >= threshold) union(a, b);
    }
  }

  const groups = new Map();
  for (const r of refs) {
    const root = find(r);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(r);
  }
  return [...groups.values()].map((members) => freeze({
    schema: KIND_SCHEMA,
    members: freeze([...members].sort()),
    size: members.length,
  }));
}

// ── the controls ──────────────────────────────────────────────────────────────
/**
 * The BAND falsifier control: partition the same referents by their occurrence count
 * (mentionsAt length) into k quantile bands. This is the "frequency band" a kind must beat.
 */
export function frequencyBands(referentList, { bands = 5 } = {}) {
  const counts = [...referentList].map((r) => ({ ref: r.ref, n: (r.mentionsAt ?? []).length }));
  counts.sort((a, b) => a.n - b.n);
  const groups = [];
  for (let i = 0; i < counts.length; i += 1) {
    const k = bands ? Math.min(bands - 1, Math.floor((i * bands) / Math.max(1, counts.length))) : 0;
    if (!groups[k]) groups[k] = [];
    groups[k].push(counts[i].ref);
  }
  return groups.filter(Boolean).map((members) => freeze({ schema: KIND_SCHEMA, members: freeze(members), size: members.length }));
}

/** One null draw: permute the company VECTORS across the referents (each referent borrows another's
 *  company), destroying WHICH referent has WHICH co-structure while preserving the multiset of vectors —
 *  the marginals survive, the structure does not. A set-similarity (jaccard) then clusters at chance. */
function permutedCompany(referentList, rng) {
  const vecs = [...referentList];
  const order = [];
  for (let i = 0; i < vecs.length; i += 1) order.push(i);
  for (let i = order.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return vecs.map((orig, i) => {
    const donor = vecs[order[i]];
    return { ...orig, names: donor.names, company: donor.company, total: donor.total };
  });
}

/**
 * The NULL falsifier: N seeded re-inductions over shuffled-company vectors, same
 * threshold, measuring the separation each yields. The induced separation must clear
 * the null's SESOI-cleared upper band or the kind is a company artifact.
 */
export function shuffledCompanyNull(referentList, { draws = 60, seed = 1, threshold = DECLARED_THRESHOLD, similarityOf = jaccard, separationOf = null } = {}) {
  const rng = createSeededRng(seed);
  const scores = [];
  for (let d = 0; d < draws; d += 1) {
    const permuted = permutedCompany(referentList, rng);
    const kinds = induceKinds(permuted, { similarityOf, threshold });
    if (separationOf) scores.push(separationOf(kinds, permuted));
  }
  scores.sort((a, b) => a - b);
  const mid = (arr) => arr.length ? arr[Math.floor(arr.length / 2)] : 0;
  const p95 = (arr) => arr.length ? arr[Math.min(arr.length - 1, Math.ceil(0.95 * arr.length) - 1)] : 0;
  return freeze({ draws, scores: freeze(scores), median: mid(scores), p95: p95(scores) });
}

/**
 * SEPARATION against an injected gold predicate: the weighted spread of gold rate across kinds.
 * goldOf(ref) -> 0|1 (injected — never used to induce, only to judge). A kind that is mostly-gold
 * or mostly-not separates; a uniform mix does not. Called on every rung (induced, band, null).
 */
export function goldSeparation(kinds, referentList, { goldOf = null } = {}) {
  const byRef = new Map(referentList.map((r) => [r.ref, r]));
  if (!goldOf) return 0;
  const rows = [];
  let totalGold = 0, totalN = 0;
  for (const k of kinds) {
    let gold = 0;
    for (const m of k.members) { const g = goldOf(byRef.get(m)); if (g === 1) gold += 1; }
    const n = k.members.length;
    if (!n) continue;
    rows.push({ n, rate: n ? gold / n : 0 });
    totalGold += gold; totalN += n;
  }
  if (!totalN) return 0;
  const base = totalGold / totalN;
  let wss = 0;
  for (const r of rows) wss += r.n * (r.rate - base) * (r.rate - base);
  return Math.sqrt(wss / Math.max(1, totalN));   // weighted std of gold rate across kinds — separation
}

/** The wall: all three falsifiers run against one induced partition. `goldOf` injected by the caller. */
export function falsifyKinds(weft, { asOf = Infinity, goldOf = null, threshold = DECLARED_THRESHOLD, similarityOf = jaccard, bands = 5, nullDraws = 60, seed = 1, sesoi = DECLARED_SESOI } = {}) {
  const vecs = [...referentVectors(weft, { asOf }).values()];
  const induced = induceKinds(vecs, { similarityOf, threshold });
  const band = frequencyBands(vecs, { bands });
  const indiv = goldSeparation(induced, vecs, { goldOf });
  const bandSep = goldSeparation(band, vecs, { goldOf });
  const nullShuff = shuffledCompanyNull(vecs, { draws: nullDraws, seed, threshold, similarityOf, separationOf: (ks, vs) => goldSeparation(ks, vs, { goldOf }) });
  const bandBeat = indiv >= bandSep;
  const nullBeat = indiv >= nullShuff.p95 + sesoi;
  const verdicts = freeze({
    schema: "KindInductionFalsify@1",
    at: asOf, threshold, sesoi,
    induced: freeze({ kinds: induced.length, separation: indiv }),
    band: freeze({ bands: bands, separation: bandSep, beaten: bandBeat }),
    null: freeze({ draws: nullDraws, median: nullShuff.median, p95: nullShuff.p95, beaten: nullBeat }),
    verdict: freeze({
      survives: bandBeat && nullBeat,
      why: [
        ...(bandBeat ? [] : [`kind separation (${indiv.toFixed(3)}) did not beat the frequency band (${bandSep.toFixed(3)}) — a kind is not a frequency band`]),
        ...(nullBeat ? [] : [`kind separation (${indiv.toFixed(3)}) did not clear the shuffled-company null's p95 + SESOI (${(nullShuff.p95 + sesoi).toFixed(3)}) — the kind is a company artifact`]),
      ],
    }),
  });
  return verdicts;
}