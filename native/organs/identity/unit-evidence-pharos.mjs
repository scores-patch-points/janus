// unit-evidence-pharos.mjs — seam 2's Janus parts, read from and written to the shared log (CONTRACT B, C, H.3).
// No other repo is called, imported or named in code: the entries are the whole contract.
//
//   reads   text, pair-question, text-reading                  (seam 1, as pair-evidence-pharos.mjs)
//           clause-units        SEG·Figure  units:<sha16(text)>            (khora)    body { rule, units }
//           unit-request        DEF·Figure  unit-request:<pair sha>        (penelope) body { pair, directions }
//           opposition-request  DEF·Figure  opposition-request:<news sha>:<u> (penelope) body { news, u }
//           set-question        DEF·Figure  set:<name>                     (asker)    body { mode, texts | expected }
//           arrival             INS·Figure  arrival:<name>:<n>             (asker)    body { set, text, n }
//   writes  unit-news           CON·Figure  news:<news sha>          of [ unit-request, units G, units N, reading G, reading N ]
//           unit-opposition     CON·Figure  opposition:<news sha>:<u> of [ opposition-request, unit-news ]
//           set-correspondence  CON·Pattern correspondence:<name>:<n> of [ set-question, every member's units, arrival n ]
//
// REQUEST-DRIVEN. The model is asked only about what a Penelope request names: the units of N in a direction a
// unit-request lists (B.4), and the one unit an opposition-request names (C.2). Nothing is asked ahead, for a
// direction not requested, or for a unit not named. The set correspondence asks no model; it is written for every
// set at every membership, whatever was requested (H.3).
//
// RAW ONLY. Answers are woven as the model gave them; the only number made from them is the contract's count of
// answers equal to "yes" (B.5 counts.yes). No bound, quantile, threshold, "held", "opposed", "silent" or "same":
// those read answers under a rule, and the rule and the reading are Penelope's.
//
// News sha (CONTRACT 0): direction ab of pair (a, b) has ground a, news b, sha16(a \0 b) = the pair sha; direction ba
// has ground b, news a, sha16(b \0 a). One unit-news per ordered pair, however many requests or sets need it.
// Bodies carry no clock, run id or path, so a rerun that finds the same evidence weaves nothing new.
import { indexEntries, textsOf, sha16, TEXT_KIND, PAIR_KIND, READING_KIND } from './pair-evidence-pharos.mjs';
import { unitNews, checkUnits } from './unit-news.mjs';
import { setCorrespondence } from './set-correspondence.mjs';
import { MODEL, WORDING_NAMES, FALSITY_NAMES } from './unit-witness.mjs';

export const UNITS_KIND = 'clause-units';
export const UNIT_REQUEST_KIND = 'unit-request';
export const OPPOSITION_REQUEST_KIND = 'opposition-request';
export const SET_KIND = 'set-question';
export const ARRIVAL_KIND = 'arrival';
export const UNIT_NEWS_KIND = 'unit-news';
export const UNIT_NEWS_CELL = 'CON·Figure';
export const UNIT_OPPOSITION_KIND = 'unit-opposition';
export const UNIT_OPPOSITION_CELL = 'CON·Figure';
export const SET_CORRESPONDENCE_KIND = 'set-correspondence';
export const NEWS_READS = [TEXT_KIND, PAIR_KIND, READING_KIND, UNITS_KIND, UNIT_REQUEST_KIND, UNIT_NEWS_KIND];
export const OPPOSITION_READS = [TEXT_KIND, UNIT_NEWS_KIND, OPPOSITION_REQUEST_KIND, UNIT_OPPOSITION_KIND];
export const CORRESPONDENCE_READS = [READING_KIND, UNITS_KIND, SET_KIND, ARRIVAL_KIND, SET_CORRESPONDENCE_KIND];
export const SET_CORRESPONDENCE_CELL = 'CON·Pattern';
const TOKEN = /^[A-Za-z0-9._-]+$/;
const HEX16 = /^[0-9a-f]{16}$/;
const suffix = (addr, prefix) => (typeof addr === 'string' && addr.startsWith(prefix) ? addr.slice(prefix.length) : null);
const hexOf = (textAddr) => suffix(textAddr, 'text:');

/** a text's reading and clause-units from the log -> { reading, units, rows, unitList, rule } | { wait } | { skip } */
function sideOf(ix, textAddr) {
  const hex = hexOf(textAddr);
  if (!hex) return { skip: 'text address is not text:<sha16>' };
  const reading = ix.get(READING_KIND, `reading:${hex}`), units = ix.get(UNITS_KIND, `units:${hex}`);
  if (!reading || !units) return { wait: !reading ? 'reading' : 'clause-units' };
  const rows = reading.body?.rows, unitList = units.body?.units;
  const why = checkUnits(rows, unitList);
  if (why) return { skip: `units-unreadable: ${why}` };
  return { reading, units, rows, unitList, rule: units.body?.rule ?? null };
}

// ---- B. unit-news ------------------------------------------------------------------------------------------------

/**
 * planNews(entries) -> { todo: [{ req, sha, dir, ground, news, G, N, rule, gSide, nSide }], skipped: [{ at, why }], counts }.
 * Pure: which ordered pairs get a unit-news now. A direction already written, or already planned this pass by an
 * earlier request, is done; one whose readings or clause-units are missing waits; a rule mismatch is skipped.
 */
export function planNews(entries) {
  const ix = indexEntries(entries), todo = [], skipped = [], planned = new Set();
  const counts = { requests: 0, directions: 0, done: 0, waiting: 0, skipped: 0 };
  const skip = (at, why) => { skipped.push({ at, why }); counts.skipped += 1; };
  for (const req of ix.all(UNIT_REQUEST_KIND)) {
    counts.requests += 1;
    const sha = suffix(req.addr, 'unit-request:');
    const pq = ix.get(PAIR_KIND, req.body?.pair);
    const t = pq ? textsOf(ix, pq) : { why: 'pair-question missing' };
    if (!sha || t.why || t.sha !== sha) { skip(req.addr, `bad-request: ${t.why ?? 'pair does not match the request address'}`); continue; }
    const dirs = req.body?.directions;
    if (!Array.isArray(dirs) || !dirs.length || dirs.some((d) => d !== 'ab' && d !== 'ba')) { skip(req.addr, 'bad-request: directions must be a non-empty list of "ab" | "ba"'); continue; }
    for (const dir of [...new Set(dirs)]) {
      counts.directions += 1;
      const [ground, news, G, N] = dir === 'ab' ? [pq.body.a, pq.body.b, t.a, t.b] : [pq.body.b, pq.body.a, t.b, t.a];
      const nsha = sha16(G + '\u0000' + N);
      if (planned.has(nsha) || ix.get(UNIT_NEWS_KIND, `news:${nsha}`)) { counts.done += 1; continue; }
      const gSide = sideOf(ix, ground), nSide = sideOf(ix, news);
      if (gSide.skip || nSide.skip) { skip(`${req.addr} ${dir}`, gSide.skip ?? nSide.skip); continue; }
      if (gSide.wait || nSide.wait) { counts.waiting += 1; continue; }
      if (gSide.rule !== nSide.rule) { skip(`${req.addr} ${dir}`, `rule-mismatch: ${gSide.rule} vs ${nSide.rule}`); continue; }
      planned.add(nsha);
      todo.push({ req, sha: nsha, dir, ground, news, G, N, rule: gSide.rule, gSide, nSide });
    }
  }
  return { todo, skipped, counts };
}

/** the woven body of a unit-news: the contract's fields, nothing else */
export function newsBody({ ground, news, rule }, core, answers) {
  const units = core.units.map((x, k) => ({ ...x, held: { wordings: [...WORDING_NAMES], answers: answers[k] } }));
  const flat = answers.flat();
  return {
    ground, news, rule, model: MODEL, units, evidence: core.evidence, linkNull: core.linkNull,
    counts: { ...core.counts, yes: flat.filter((a) => a === 'yes').length, answers: flat.length },
  };
}

/**
 * weaveNews(door, witness, { evidence, basis }) -> { on, why, plan, woven, refused, lastReason, error }.
 * witness: makeUnitWitness(...) (only .held is used). evidence: () => { of, basis }, opened once and only when there is
 * a unit-news to write. A model error stops the pass; what was woven stays and the rest waits for a rerun.
 */
export async function weaveNews(door, witness, { evidence, basis = {} } = {}) {
  if (!door?.on) return { on: false, why: door?.why ?? 'no door', plan: null, woven: 0, refused: 0 };
  const all = door.ask(NEWS_READS);
  if (!all) return { on: true, why: `could not read the log: ${door.counts.lastReason}`, plan: null, woven: 0, refused: 0, error: 'fold failed' };
  const plan = planNews(all);
  const before = { ...door.counts };
  let error = null;
  if (plan.todo.length) {
    door.declare(UNIT_NEWS_KIND, UNIT_NEWS_CELL, 'per clause unit of the news text: identical content rows in the ground, shared keys per ground unit, mutual-best links with their redeal null, unsettled word pairs with raw word evidence both ways, and the raw answers of three wordings asking whether the ground holds the unit; counts only, no bound');
    const ev = evidence();
    for (const it of plan.todo) {
      const core = unitNews({ rows: it.gSide.rows, units: it.gSide.unitList }, { rows: it.nSide.rows, units: it.nSide.unitList }, ev.of, { seed: `unit-links:${it.sha}` });
      const answers = [];
      try { for (const x of core.units) answers.push(await witness.held(it.G, x.say)); } catch (e) { error = `${e?.message ?? e}`; break; }
      door.weave({ cell: UNIT_NEWS_CELL, kind: UNIT_NEWS_KIND, addr: `news:${it.sha}`,
        of: [it.req.id, it.gSide.units.id, it.nSide.units.id, it.gSide.reading.id, it.nSide.reading.id],
        body: newsBody(it, core, answers), basis: { organ: 'janus native/organs/identity/unit-news.mjs', evidence: ev.basis ?? null, ...basis } });
    }
  }
  return { on: true, why: door.why, plan, woven: door.counts.woven - before.woven, refused: door.counts.refused - before.refused, lastReason: door.counts.lastReason, error };
}

// ---- C. unit-opposition ------------------------------------------------------------------------------------------

/** planOppositions(entries) -> { todo: [{ req, news, sha, u, say, G }], skipped, counts }. Pure. */
export function planOppositions(entries) {
  const ix = indexEntries(entries), todo = [], skipped = [];
  const counts = { requests: 0, done: 0, waiting: 0, skipped: 0 };
  const skip = (at, why) => { skipped.push({ at, why }); counts.skipped += 1; };
  for (const req of ix.all(OPPOSITION_REQUEST_KIND)) {
    counts.requests += 1;
    const m = /^opposition-request:([0-9a-f]{16}):(\d+)$/.exec(req.addr ?? '');
    if (!m || req.body?.news !== `news:${m[1]}` || req.body?.u !== Number(m[2])) { skip(req.addr, 'bad-request: address, news and u do not agree'); continue; }
    const sha = m[1], u = Number(m[2]);
    if (ix.get(UNIT_OPPOSITION_KIND, `opposition:${sha}:${u}`)) { counts.done += 1; continue; }
    const news = ix.get(UNIT_NEWS_KIND, `news:${sha}`);
    if (!news) { counts.waiting += 1; continue; }
    const unit = (news.body?.units ?? []).find((x) => x.u === u);
    if (!unit) { skip(req.addr, 'no-such-unit'); continue; }
    const tg = ix.get(TEXT_KIND, news.body?.ground), tn = ix.get(TEXT_KIND, news.body?.news);
    const G = tg?.body?.text, N = tn?.body?.text;
    if (typeof G !== 'string' || typeof N !== 'string') { counts.waiting += 1; continue; }
    if (sha16(G + '\u0000' + N) !== sha) { skip(req.addr, 'news address does not match its texts'); continue; }
    todo.push({ req, news, sha, u, say: unit.say, G });
  }
  return { todo, skipped, counts };
}

/** weaveOppositions(door, witness) -> { on, why, plan, woven, refused, lastReason, error }. witness.opposed only. */
export async function weaveOppositions(door, witness, { basis = {} } = {}) {
  if (!door?.on) return { on: false, why: door?.why ?? 'no door', plan: null, woven: 0, refused: 0 };
  const all = door.ask(OPPOSITION_READS);
  if (!all) return { on: true, why: `could not read the log: ${door.counts.lastReason}`, plan: null, woven: 0, refused: 0, error: 'fold failed' };
  const plan = planOppositions(all);
  const before = { ...door.counts };
  let error = null;
  if (plan.todo.length) {
    door.declare(UNIT_OPPOSITION_KIND, UNIT_OPPOSITION_CELL, 'the raw answers of three falsity wordings asking whether the ground passage says one requested clause unit is false; testimony only, no verdict');
    for (const it of plan.todo) {
      let answers;
      try { answers = await witness.opposed(it.G, it.say); } catch (e) { error = `${e?.message ?? e}`; break; }
      door.weave({ cell: UNIT_OPPOSITION_CELL, kind: UNIT_OPPOSITION_KIND, addr: `opposition:${it.sha}:${it.u}`, of: [it.req.id, it.news.id],
        body: { ground: it.news.body.ground, news: it.news.body.news, u: it.u, say: it.say, model: MODEL, wordings: [...FALSITY_NAMES], answers },
        basis: { organ: 'janus native/organs/identity/unit-witness.mjs', ...basis } });
    }
  }
  return { on: true, why: door.why, plan, woven: door.counts.woven - before.woven, refused: door.counts.refused - before.refused, lastReason: door.counts.lastReason, error };
}

// ---- H.3 set-correspondence --------------------------------------------------------------------------------------

/**
 * the memberships of one set-question: static -> one, all its texts; arrivals -> one per consecutive arrival n,
 * members 1..n. -> { memberships: [{ n, texts, arrival }], why }
 */
export function membershipsOf(ix, sq) {
  const name = suffix(sq.addr, 'set:');
  if (!name || !TOKEN.test(name)) return { memberships: [], why: 'set address is not set:<plain token>' };
  const mode = sq.body?.mode;
  if (mode === 'static') {
    const texts = sq.body?.texts;
    if (!Array.isArray(texts) || !texts.length || texts.some((t) => !HEX16.test(hexOf(t) ?? ''))) return { memberships: [], why: 'static set needs texts: [text:<sha16>, ...]' };
    const uniq = [...new Set(texts)].sort();
    return { name, memberships: [{ n: uniq.length, texts: uniq, arrival: null }], why: uniq.length === texts.length ? null : 'a text is listed twice (counted once)' };
  }
  if (mode === 'arrivals') {
    const memberships = [], seen = [];
    for (let n = 1; ; n++) {
      const a = ix.get(ARRIVAL_KIND, `arrival:${name}:${n}`);
      if (!a) break;
      if (a.body?.set !== sq.addr || a.body?.n !== n || !HEX16.test(hexOf(a.body?.text) ?? '')) return { name, memberships, why: `arrival ${n} does not name this set, its n or a text address` };
      if (seen.includes(a.body.text)) return { name, memberships, why: `arrival ${n} repeats ${a.body.text}` };
      seen.push(a.body.text);
      memberships.push({ n, texts: [...seen].sort(), arrival: a });
    }
    return { name, memberships, why: null };
  }
  return { memberships: [], why: `unknown set mode ${String(mode)}` };
}

/** planCorrespondences(entries) -> { todo: [{ sq, name, n, arrival, sides }], skipped, counts }. Pure. */
export function planCorrespondences(entries) {
  const ix = indexEntries(entries), todo = [], skipped = [];
  const counts = { sets: 0, memberships: 0, done: 0, waiting: 0, skipped: 0 };
  const skip = (at, why) => { skipped.push({ at, why }); counts.skipped += 1; };
  for (const sq of ix.all(SET_KIND)) {
    counts.sets += 1;
    const ms = membershipsOf(ix, sq);
    if (ms.why) skip(sq.addr, ms.why);
    for (const { n, texts, arrival } of ms.memberships) {
      counts.memberships += 1;
      if (ix.get(SET_CORRESPONDENCE_KIND, `correspondence:${ms.name}:${n}`)) { counts.done += 1; continue; }
      const sides = texts.map((t) => ({ text: t, ...sideOf(ix, t) }));
      const bad = sides.find((s) => s.skip);
      if (bad) { skip(`correspondence:${ms.name}:${n}`, `${bad.text}: ${bad.skip}`); continue; }
      if (sides.some((s) => s.wait)) { counts.waiting += 1; continue; }
      const rules = [...new Set(sides.map((s) => s.rule))];
      if (rules.length > 1) { skip(`correspondence:${ms.name}:${n}`, `rule-mismatch: ${rules.join(' vs ')}`); continue; }
      todo.push({ sq, name: ms.name, n, arrival, sides, rule: rules[0] });
    }
  }
  return { todo, skipped, counts };
}

/** weaveCorrespondences(door) -> { on, why, plan, woven, refused, lastReason }. No model. */
export function weaveCorrespondences(door, { basis = {} } = {}) {
  if (!door?.on) return { on: false, why: door?.why ?? 'no door', plan: null, woven: 0, refused: 0 };
  const all = door.ask(CORRESPONDENCE_READS);
  if (!all) return { on: true, why: `could not read the log: ${door.counts.lastReason}`, plan: null, woven: 0, refused: 0, error: 'fold failed' };
  const plan = planCorrespondences(all);
  const before = { ...door.counts };
  if (plan.todo.length) {
    door.declare(SET_CORRESPONDENCE_KIND, SET_CORRESPONDENCE_CELL, 'the clause units of every member of a set, linked pair by pair by mutual-best shared content keys, with the components the links make, the texts each spans and a redeal null; geometry only, no class, no same');
    for (const it of plan.todo) {
      const g = setCorrespondence(it.sides.map((s) => ({ text: s.text, rows: s.rows, units: s.unitList })), { seed: `set-links:${it.name}:${it.n}` });
      door.weave({ cell: SET_CORRESPONDENCE_CELL, kind: SET_CORRESPONDENCE_KIND, addr: `correspondence:${it.name}:${it.n}`,
        of: [it.sq.id, ...it.sides.map((s) => s.units.id), ...(it.arrival ? [it.arrival.id] : [])],
        body: { set: it.sq.addr, members: g.members, rule: it.rule, links: g.links, components: g.components, counts: g.counts, null: g.null },
        basis: { organ: 'janus native/organs/identity/set-correspondence.mjs', ...basis } });
    }
  }
  return { on: true, why: door.why, plan, woven: door.counts.woven - before.woven, refused: door.counts.refused - before.refused, lastReason: door.counts.lastReason };
}
