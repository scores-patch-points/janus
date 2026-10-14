// Janus — the consequential reasoning spiral. Pure; no parser, model or file IO.
// The log is the record; this module projects standing at a cursor. A verdict
// is an attestation supplied by a named test instrument, NOT a truth oracle.
// Revisions invalidate downstream judgments without erasing their history.

export const REASONING_SPIRAL_SCHEMA = 'ReasoningSpiral@1';
const METHODS = new Set(['deduction', 'perturbation', 'prediction', 'testimony']);
const VERDICTS = new Set(['supported', 'refuted', 'unresolved']);
const addr = (x) => {
  if (typeof x !== 'string') return false;
  const m = x.match(/^([^#\s]+)#(\d+)-(\d+)$/);
  if (!m) return false;
  const from = Number(m[2]), to = Number(m[3]);
  return Number.isSafeInteger(from) && Number.isSafeInteger(to) && to > from;
};

// The append-only log must have value semantics, including nested metadata.
// Reject Map/Set/Date/functions: Object.freeze(Map) does not freeze its entries.
function jsonValue(x, seen = new Set()) {
  if (x === null || typeof x === 'string' || typeof x === 'boolean') return;
  if (typeof x === 'number' && Number.isFinite(x)) return;
  if (typeof x !== 'object' || seen.has(x)) throw new TypeError('reasoning event must be acyclic JSON data');
  if (!Array.isArray(x) && Object.getPrototypeOf(x) !== Object.prototype && Object.getPrototypeOf(x) !== null)
    throw new TypeError('reasoning event must contain plain data, not mutable exotic objects');
  seen.add(x);
  for (const k of Object.keys(x)) jsonValue(x[k], seen);
  seen.delete(x);
}
function frozen(x) {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) {
    for (const k of Object.keys(x)) frozen(x[k]);
    Object.freeze(x);
  }
  return x;
}
const unique = (xs) => [...new Set(Array.isArray(xs) ? xs : [])];
const trimmed = (x) => typeof x === 'string' ? x.trim() : '';

/** Append is immutable. An attempted illegal move remains in the log and is
 * refused by projection; nothing is silently dropped or retrospectively edited. */
export function appendReasoning(log = [], event = {}) {
  if (!Array.isArray(log)) throw new TypeError('appendReasoning: log must be an array');
  // The caller still owns its original objects. Freeze our own copies so that
  // a late mutation cannot retroactively alter what the ledger witnessed.
  jsonValue(event);
  const copy = structuredClone(event);
  if (copy.premises) copy.premises = unique(copy.premises);
  if (copy.witnesses) copy.witnesses = unique(copy.witnesses);
  return [...log, frozen({ ...copy, schema: REASONING_SPIRAL_SCHEMA, seq: log.length })];
}

/** Project the standing of all propositions at a log cursor, as of N events.
 * A supported assessment remains conditional on ALL its premise revisions.
 * A withdrawn premise SUSPENDS descendants; a restored but changed premise
 * makes old derived assessments STALE until checked again. */
export function reasoningAt(log = [], { asOf = Infinity } = {}) {
  const nodes = new Map();
  const refused = [];
  const input = log.slice(0, asOf);
  const deny = (e, why) => refused.push({ seq: e.seq, id: e.id ?? null, why });

  const status = (id, path = new Set()) => {
    const n = nodes.get(id);
    if (!n) return { standing: 'missing', because: [id] };
    if (path.has(id)) return { standing: 'cyclic', because: [...path, id] };
    if (!n.low.ok) return { standing: 'unlicensed', because: [n.low.reason] };
    if (n.withdrawn) return { standing: 'withdrawn', because: [n.withdrawal] };
    if (!n.assessment) return { standing: 'candidate', because: [] };
    // ALL assessments have premises, including refutations. Old denials are
    // not eternally correct after their supporting premises have changed.
    const next = new Set(path); next.add(id);
    for (const premise of n.premises) {
      const p = status(premise, next);
      if (p.standing !== 'supported') return { standing: 'suspended', because: [`${premise}: ${p.standing}`] };
      if (n.assessment.premiseEpochs[premise] !== nodes.get(premise).epoch) {
        return { standing: 'stale', because: [`${premise}: premise changed since assessment`] };
      }
    }
    if (n.assessment.verdict === 'refuted') return { standing: 'refuted', because: [n.assessment.basis] };
    if (n.assessment.verdict === 'unresolved') return { standing: 'unresolved', because: [n.assessment.basis] };
    // A named giver may license an AXIOM; it does not witness a worldly fact.
    if (n.giver && !n.premises.length && !(n.assessment.witnesses ?? []).length)
      return { standing: 'licensed', because: ['given by ' + n.giver + '; not empirically witnessed'] };
    return { standing: 'supported', because: [n.assessment.basis] };
  };

  for (const e of input) {
    const id = trimmed(e.id);
    if (!id) { deny(e, 'missing_id'); continue; }
    if (e.kind === 'propose') {
      if (nodes.has(id)) { deny(e, 'duplicate_proposal'); continue; }
      const p = unique(e.premises).filter((x) => trimmed(x));
      const witnesses = unique(e.witnesses);
      const relation = e.relation;
      const valid = relation && ['subject', 'verb', 'object'].every((k) => trimmed(relation[k]));
      const forWhom = trimmed(e.forWhom);
      const low = !valid ? { ok: false, reason: 'missing_relation' }
        : !forWhom ? { ok: false, reason: 'missing_for_whom' }
        : p.includes(id) ? { ok: false, reason: 'self_premise' }
        : witnesses.some((x) => !addr(x)) ? { ok: false, reason: 'witness_not_addressed' }
        : !p.length && !witnesses.length && !trimmed(e.giver) ? { ok: false, reason: 'no_ground_or_named_giver' }
        : { ok: true, reason: 'has_a_ground_to_test' };
      nodes.set(id, { id, relation, forWhom, premises: p, witnesses, giver: trimmed(e.giver) || null,
        low, epoch: 0, assessment: null, withdrawn: false, withdrawal: null, proposedAt: e.seq });
      continue;
    }
    const n = nodes.get(id);
    if (!n) { deny(e, 'unknown_claim'); continue; }
    if (e.kind === 'withdraw' || e.kind === 'reopen') {
      if (!trimmed(e.basis)) { deny(e, 'missing_basis'); continue; }
      n.withdrawn = e.kind === 'withdraw';
      n.withdrawal = e.kind === 'withdraw' ? trimmed(e.basis) : null;
      n.assessment = null;
      n.epoch += 1;
      continue;
    }
    if (e.kind !== 'assess') { deny(e, 'unknown_act'); continue; }
    if (!VERDICTS.has(e.verdict) || !METHODS.has(e.method) || !trimmed(e.by) || !trimmed(e.basis)) {
      deny(e, 'assessment_requires_verdict_method_instrument_basis'); continue;
    }
    if (!n.low.ok) { deny(e, 'low_gate_failed'); continue; }
    if (n.withdrawn) { deny(e, 'withdrawn_claim_must_be_reopened'); continue; }
    const witnessList = unique(e.witnesses ?? n.witnesses);
    if (witnessList.some((w) => !addr(w))) { deny(e, 'assessment_witness_not_addressed'); continue; }
    if (e.verdict === 'supported' && e.method === 'testimony' && !witnessList.length) {
      deny(e, 'testimony_without_witness'); continue;
    }
    if (e.verdict === 'supported' && e.method === 'deduction' && !trimmed(e.license)) {
      deny(e, 'deduction_without_named_license'); continue;
    }
    if (e.verdict === 'supported' && !n.premises.length && !witnessList.length && !n.giver) {
      deny(e, 'unsupported_origin'); continue;
    }
    if (e.verdict === 'supported' && n.premises.some((p) => status(p).standing !== 'supported')) {
      deny(e, 'premise_not_supported'); continue;
    }
    const premiseEpochs = Object.fromEntries(n.premises.map((p) => [p, nodes.get(p)?.epoch ?? null]));
    n.assessment = { verdict: e.verdict, method: e.method, by: e.by, basis: e.basis,
      license: trimmed(e.license) || null, witnesses: witnessList, premiseEpochs, assessedAt: e.seq };
    n.epoch += 1;
  }
  const claims = [...nodes.values()].map((n) => ({ ...n, ...status(n.id), witnesses: [...n.witnesses], premises: [...n.premises] }));
  const byStanding = {};
  for (const n of claims) byStanding[n.standing] = (byStanding[n.standing] ?? 0) + 1;
  return { schema: REASONING_SPIRAL_SCHEMA, events: input.length, claims, byStanding, refused,
    openings: claims.filter((n) => ['candidate', 'suspended', 'stale', 'unresolved', 'unlicensed'].includes(n.standing))
      .map((n) => ({ id: n.id, standing: n.standing, question: n.standing === 'stale'
        ? 'Recheck this inference against its revised premises' : n.standing === 'suspended'
          ? 'Which dependency must be restored or independently replaced?' : n.standing === 'unlicensed'
            ? 'What witnessed source or named giver licenses this?' : 'What would verify or falsify this claim?' })) };
}

/** One bounded cycle: nominated claims → low gate → injected instrument's
 * falsifiable assessment → high gate. An absent instrument is a NAMED VOID,
 * not a synthetic supported verdict. Downstream state is always reprojected. */
export async function reasoningRound(log = [], proposals = [], { assess = null } = {}) {
  let out = log;
  for (const proposal of proposals) {
    out = appendReasoning(out, { kind: 'propose', ...proposal });
    const current = reasoningAt(out).claims.find((x) => x.id === proposal.id);
    if (!current?.low.ok || typeof assess !== 'function') continue;
    const verdict = await assess(current, reasoningAt(out));
    if (verdict && typeof verdict === 'object') {
      // An injected instrument can suggest only a verdict, never an event
      // type, identity, schema or log position. Keep the author of the claim.
      const { method, by, basis, license, witnesses } = verdict;
      out = appendReasoning(out, { kind: 'assess', id: current.id,
        ...Object.fromEntries(Object.entries({ verdict: verdict.verdict, method, by, basis, license, witnesses })
          .filter(([, value]) => value !== undefined)) });
    }
  }
  return { log: out, fold: reasoningAt(out) };
}
