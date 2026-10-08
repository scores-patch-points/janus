// organs/ruliad.js — THE RULIAD: the field the weft folds into. janus Relates what the record says about relations.
//
// The weft (khora) is the reading log; its attestations (`weftAttestations`, the single seam) are folded HERE into the
// hyperlexicon field — composition affordances standing `candidate`, giver `the weft`, witnesses = the weft addresses.
// Every field row is therefore a compression of the log that re-expands by address (`reopen`) — the holograph property.
//
// THE LAW, stated here as the wall: RULES ARE EITHER GIVEN OR EXTRACTED — NO REVEALED LAWS WITH NO GIVERS.
//   · extracted — what this organ folds from the weft (observed adjacency, witnesses=addresses, standing `candidate`);
//   · given     — what `giveRule` admits, and only with a NAMED giver, bound to a charter or stamped chemistry
//                 (`giveHyperlexiconAffordance` throws without a giver; `licenseRows` is the wall over the board).
//   · revealed  — a row with neither is refused. A bare "I know this" with no witness and no giver licences nothing.
//
// One parser, one direction: this module imports khora's weft seam and kernel — never a second reading of weft.jsonl,
// never a copy (THE-SPINE.md; the closure never imports the reader). janus Relates; khora Differentiates; the weft
// stays kind-free. Kinds are this side's decision, injected as `kindFor` when induced.
import { weftAttestations, reopen, WEFT_ATTESTATION_SCHEMA } from "../../../khora/native/the-fold/weft.js";
import { createHyperlexicon, giveHyperlexiconAffordance, licenseStanding, pairKey } from "../../../khora/native/kernel/hyperlexicon.js";

export { reopen, weftAttestations, WEFT_ATTESTATION_SCHEMA, pairKey };

export const EXTRACTED_GIVER = "the weft";
export const RULIAD_SCHEMA = "RuliadField@1";

const freeze = Object.freeze;

/** The field name the row keys on: the kind when the ruliad has induced one for the end, else the surface. */
const endName = (end, kindFor) => (kindFor?.(end?.surface, end) ?? null) || end?.surface;

/**
 * Fold the weft's attestations into the hyperlexicon field. PURE.
 * @param weft the weft (array of `WeftEntry@1` passes) — consumed only through `weftAttestations`
 * @param asOf pass-seq cursor (fold the past)
 * @param kindFor optional kind induction: `(surface, end) -> kindId` — the ruliad owns kinds; a kind key is used when induced
 * @returns { hyperlexicon, stats } — `hyperlexicon` is the field (composition affordances, standing candidate,
 *          giver `the weft`, witnesses = addresses), `stats` counts what the fold saw
 */
export function fieldFromWeft(weft, { asOf = Infinity, kindFor = null } = {}) {
  const pairs = new Map();
  const categories = new Map();
  const labels = new Map();
  let attestations = 0;
  let unresolved = 0;

  for (const a of weftAttestations(weft, { asOf })) {
    if (!a?.label || !a?.left?.surface || !a?.right?.surface) continue;
    attestations += 1;
    const l = endName(a.left, kindFor);
    const r = endName(a.right, kindFor);
    const key = pairKey(l, r);
    let row = pairs.get(key);
    if (!row) {
      row = {
        left: l, right: r, labels: new Map(), witnesses: new Set(),
        leftRefs: new Set(), rightRefs: new Set(), standingOf: new Set(),
      };
      pairs.set(key, row);
    }
    row.labels.set(a.label, (row.labels.get(a.label) ?? 0) + 1);
    if (a.witness) row.witnesses.add(a.witness);
    if (a.left?.ref) row.leftRefs.add(a.left.ref);
    if (a.right?.ref) row.rightRefs.add(a.right.ref);
    if (a.category) categories.set(a.category, (categories.get(a.category) ?? 0) + 1);
    labels.set(a.label, (labels.get(a.label) ?? 0) + 1);
    if (a.left?.standing !== "referent" || a.right?.standing !== "referent") unresolved += 1;
  }

  const composition = [];
  for (const row of pairs.values()) {
    composition.push({
      left: row.left,
      right: row.right,
      standing: "candidate",
      giver: EXTRACTED_GIVER,
      witnesses: [...row.witnesses].sort(),
      meta: {
        observed: true,
        attestations: [...row.labels.values()].reduce((a, b) => a + b, 0),
        labels: Object.fromEntries([...row.labels.entries()].sort((a, b) => b[1] - a[1])),
        leftRefs: [...row.leftRefs],
        rightRefs: [...row.rightRefs],
      },
    });
  }

  const hyperlexicon = createHyperlexicon({ composition });
  const distinctWitnesses = new Set();
  for (const row of Object.values(hyperlexicon.composition)) for (const w of row.witnesses ?? []) distinctWitnesses.add(w);

  return freeze({
    schema: RULIAD_SCHEMA,
    hyperlexicon,
    stats: freeze({
      schema: "RuliadStats@1",
      source: EXTRACTED_GIVER,
      attestations,
      unresolvedEnds: unresolved,
      pairs: composition.length,
      distinctLabels: labels.size,
      distinctWitnesses: distinctWitnesses.size,
      byLabel: freeze(Object.fromEntries([...labels.entries()].sort((a, b) => b[1] - a[1]))),
      byCategory: freeze(Object.fromEntries([...categories.entries()].sort((a, b) => b[1] - a[1]))),
    }),
  });
}

/** The GIVEN lane: admit a declared rule only with a named giver. Throws without one ("NO REVEALED LAWS WITH NO GIVERS"). */
export function giveRule(field, { left, right, giver, binding = null, witnesses = [], meta = {} } = {}) {
  const hl = field?.hyperlexicon ?? field ?? createHyperlexicon();
  return giveHyperlexiconAffordance(hl, { left, right, giver, binding, witnesses, meta });
}

/** THE WALL over the whole board: every composition row's standing, licensed or refused, with why. */
export function licenseRows(field, charter = null) {
  const hl = field?.hyperlexicon ?? field ?? createHyperlexicon();
  return Object.values(hl.composition).map((row) => ({ ...row, license: licenseStanding(row, charter) }));
}