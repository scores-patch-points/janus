// text-finder.mjs — the discrepancy finder for loose text. Pure.
//
// Two texts are the same, for a question, when no distinction survives that
// makes a difference to the answer. So the finder does not score likeness. It
// folds the pair under a declared ground, hunts for a distinction, and reports
// a standing with everything it searched.
//
//   The ground is handed in, with bylines (ground.mjs). It decides identity,
//   what is followed and what is accidental, time, absence, sufficiency and
//   the baseline, including the very words each reader is asked. Without a
//   ground, a question and a named adopter the finder refuses.
//
//   Likeness only nominates. An alignment says where two texts part; a
//   similarity score is recorded with its giver. Neither is read as "same",
//   and neither orders what is asked.
//
//   The fold runs from the head backward and only as far as the question
//   needs. The head is the whole of each text read against the other by the
//   reader the ground names: that is the accumulated answer, so many small
//   differences cannot pass one at a time. Only when the head says the texts
//   differ, or the ground asks for it, does the finder walk back to say where:
//   place by place where the texts align, part by part where they do not.
//
//   One draw is one standpoint. A place closed by the head's yes, or located
//   by elimination from the head's no, is reported on the head's standpoint
//   and adds none of its own. A separate standpoint needs a separate
//   examination: other givers, another reader, or another question.
//
//   A search that did not run says nothing. A branch the ground requires and
//   the finder did not reach is reported as "could not be said". Disagreement
//   between searches is reported as both; nothing here picks a winner.
//
//   The verdict is returned with its stop: the frontier reached, the ground,
//   the baseline, and who adopted it. It is an event for the log, revisable
//   by a later one. The finder does not write it anywhere.
//
// Every outside power is a named giver handed in: the readers of text (khora),
// the readers asked questions (models, as witnesses answering yes or no only),
// the similarity nose. Nothing here calls a model, reads a file, cuts text or
// holds a list of words.

import { readGround, readQuestion, KERNEL } from './text-ground.mjs';
import { huntFigures, huntNames, huntHunks, polarityLead, around } from './text-hunters.mjs';
import { substitute } from './text-align.mjs';
import { unitsOf } from './text-units.mjs';
import { within } from './text-tags.mjs';
import { standpoint, standingOf, verdict4, IN_WORDS } from './standing.mjs';

const squash = (s) => String(s).replace(/\s+/g, ' ').trim();
const uniq = (xs) => [...new Set(xs.filter(Boolean))];
const clean = (c) => { const { hunk, ...rest } = c; return rest; };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// A figure's own words with the marks written hard against it, read back off the text.
function withMarks(text, sp, marks) {
  let s = sp.start, e = sp.end; const m = String(marks ?? '');
  while (m && s > 0 && m.includes(text[s - 1])) s--;
  while (m && e < text.length && m.includes(text[e])) e++;
  return { text: text.slice(s, e), start: s, end: e };
}
const show = (c) => `«${c.a?.text ?? ''}»${c.a && c.b ? ' / ' : ''}${c.b ? `«${c.b.text}»` : ''}`.replace(/^«»/, '');

// Every draw on a reader is logged: which reader, asked what, answering what.
// `undefined`: no such reader was handed in, or it cannot answer this kind of
// question. `null`: it was asked and gave no usable answer. Neither is ever
// read as a yes or a no.
function ledger(readers, questions) {
  const draws = [];
  const ask = async (name, kind, args, note = {}) => {
    const r = readers?.[name];
    if (!r || typeof r[kind] !== 'function') return undefined;
    let answer = null;
    try { answer = (await r[kind]({ ...args, questions })) ?? null; } catch { answer = null; }
    if (answer !== 'yes' && answer !== 'no') answer = null;
    draws.push({ n: draws.length + 1, reader: name, by: r.by ?? name, kind, ...note, ...(args.part != null ? { part: args.part } : {}), ...(args.figure != null ? { figure: args.figure } : {}), ...(args.kind != null ? { named: args.kind } : {}), answer });
    return answer;
  };
  const by = (name) => (readers?.[name] ? (readers[name].by ?? `reader "${name}"`) : null);
  const missing = (name) => `reader "${name}", named by the ground, was not handed in`;
  return { draws, ask, by, missing };
}

// `a` and `b` are readings ({ text, language, tokens, amounts, names, parsed, by }) or,
// when a reader of text is handed in as `opts.read`, plain texts.
//   opts.ground     the ground: { name, events: [{ id, decides, by, at, body }] }
//   opts.question   the declared shape: { asks, by, of, directions?, layers?, kind? }
//   opts.adoptedBy  who adopts this ground for this reading
//   opts.readers    named readers of questions: { quick: {...}, deliberate: {...} }
//   opts.similarity optional nose: async (a, b) => ({ score, by })
//   opts.controls   optional statements from the same record, for arming an identity question
export async function find(a, b, opts = {}) {
  const head = { schema: 'FinderVerdict@2', kernel: KERNEL };
  const g = readGround(opts.ground);
  if (!g.ok) return { ...head, refused: g.refused };
  const q = readQuestion(opts.question);
  if (!q.ok) return { ...head, refused: q.refused };
  if (typeof opts.adoptedBy !== 'string' || !opts.adoptedBy.trim()) return { ...head, refused: ['no adoption: a ground applies only when a reader adopts it; name who adopts it (adoptedBy)'] };
  const ta = typeof a === 'string' ? a : String(a?.text ?? ''), tb = typeof b === 'string' ? b : String(b?.text ?? '');
  if (!ta.trim() || !tb.trim()) return { ...head, refused: ['an empty text: there is nothing to compare'] };
  if ((typeof a === 'string' || typeof b === 'string') && typeof opts.read !== 'function') return { ...head, refused: ['no reader of text handed in: the finder compares readings, it does not read'] };
  const lang = (side) => opts.languages?.[side] ?? opts.language;
  const Ra = typeof a === 'string' ? await opts.read(ta, { language: lang('a') }) : a;
  const Rb = typeof b === 'string' ? await opts.read(tb, { language: lang('b') }) : b;
  const G = g.G, Q = q.Q;
  const ctx = { G, Q, Ra, Rb, a: ta, b: tb, T: G.baseline.tests, L: ledger(opts.readers, G.baseline.questions), opts, standpoints: [], distinctions: [], pruned: [], searched: [], whole: {}, nominations: { similarity: null, alignment: null, leads: [] } };

  // Likeness nominates, and is never read again.
  if (typeof opts.similarity === 'function') {
    let s = null; try { s = await opts.similarity(ta, tb); } catch { s = null; }
    ctx.nominations.similarity = s ? { score: s.score, by: s.by } : null;
    ctx.searched.push({ branch: 'nominate/similarity', by: s?.by ?? 'similarity giver', reached: Boolean(s), looked: s ? 1 : 0, found: 0, why: s ? 'recorded only: a score never enters the standing' : 'the similarity giver gave no score' });
  } else ctx.searched.push({ branch: 'nominate/similarity', by: null, reached: false, looked: 0, found: 0, why: 'no similarity giver handed in' });

  if (Q.of === 'identity') await identity(ctx);
  else if (Q.of === 'kind') await kind(ctx);
  else await information(ctx);

  const standing = standingOf(ctx.standpoints), v4 = verdict4(ctx.standpoints);
  const frontier = ctx.searched.map((s) => ({ branch: s.branch, reached: Boolean(s.reached), ...(s.why ? { why: s.why } : {}), ...(s.open ? { open: s.open } : {}) }));
  return {
    ...head, question: Q, ground: { name: G.name, events: G.events }, adoptedBy: opts.adoptedBy,
    standing, verdict4: v4, inWords: IN_WORDS[standing],
    standpoints: ctx.standpoints, distinctions: ctx.distinctions.map(clean), pruned: ctx.pruned.map(clean),
    searched: ctx.searched, nominations: ctx.nominations, whole: ctx.whole, draws: ctx.L.draws, readers: { a: Ra.by, b: Rb.by },
    stop: { kind: 'stop', by: KERNEL, question: Q, ground: { name: G.name, events: G.events.map((e) => e.id) }, adoptedBy: opts.adoptedBy, standing, verdict4: v4, frontier, baseline: { tests: G.baseline.tests, questions: G.eventFor('baseline').id }, revisable: true, note: 'an event for the log: the finder returns it and does not write it' },
  };
}

// The same pair under several grounds. Two answers are not an error: the
// difference between them is a finding.
export async function findUnder(a, b, grounds, opts = {}) {
  const verdicts = [];
  for (const ground of grounds ?? []) verdicts.push(await find(a, b, { ...opts, ground }));
  const said = verdicts.map((v) => v.standing ?? 'refused');
  const differ = new Set(said).size > 1;
  return { schema: 'FinderUnderGrounds@1', verdicts, differ, finding: differ ? `the same pair stands differently under these grounds: ${verdicts.map((v, i) => `${v.ground?.name ?? `ground ${i + 1}`}: ${said[i]}`).join('; ')}` : null };
}

// What the ground requires and the finder did not reach is said out loud: silence there is not agreement.
function requireBranches(ctx, kindOfQuestion, reached) {
  const { G } = ctx;
  for (const need of G.sufficiency.required) {
    if ((need.startsWith('identity/') ? 'identity' : 'information') !== kindOfQuestion) continue;
    const r = reached[need] ?? { ok: false, why: 'nothing ran for this branch' };
    if (r.ok) continue;
    if (ctx.standpoints.some((s) => s.branch === need && s.says === 'inexpressible')) continue; // already said, by whoever could not answer
    ctx.standpoints.push(standpoint(need, 'inexpressible', `${KERNEL}; ${G.signed('sufficiency')}`, `required by the ground and not reached: ${r.why}`));
  }
}

// ---- "aligned in all information", or one text carrying the other ----------------

async function information(ctx) {
  const { G, Q, Ra, Rb, a, b, L, T } = ctx;
  const S = G.sufficiency, budget = S.budget;
  const dirs = [];
  if (Q.directions !== 'b-carries-a') dirs.push({ X: Ra, Y: Rb, x: 'a', y: 'b' }); // does a carry b: what b states, asked of a
  if (Q.directions !== 'a-carries-b') dirs.push({ X: Rb, Y: Ra, x: 'b', y: 'a' });
  const sides = new Set(dirs.map((d) => d.y)); // the sides whose content must be carried
  const dirOf = (side) => dirs.find((d) => d.y === side);

  if (squash(a) === squash(b)) {
    ctx.standpoints.push(standpoint('kernel/same-string', 'is', `${KERNEL}: string comparison`, `the two texts are the same string once spacing is squashed (${G.signed('dependency')} makes spacing accidental)`));
    ctx.searched.push({ branch: 'kernel/same-string', by: KERNEL, reached: true, looked: 1, found: 0 });
    return;
  }

  // The structural prune: a place that touches nothing in the question's declared shape cannot change the answer.
  // Two things only are pruned. A difference in a layer the question leaves out. And, for a one-way question, a figure
  // or a name that only the CARRYING text holds. A place where the texts part is never pruned by side: a word added to
  // the carrying text ("not", "only", "allegedly") can undo what it carries.
  const prune = (c) => {
    if (c.layer && !Q.layers.includes(c.layer)) return `a difference of ${c.layer}, which is outside the question's shape`;
    if (c.survives == null && c.side && (c.kind === 'figure' || c.kind === 'figure-unread' || c.kind === 'name') && !sides.has(c.side)) return `a ${c.kind === 'name' ? 'name' : 'figure'} only the carrying text holds; the question asks what side ${[...sides].join('')} states`;
    return null;
  };
  const keep = (list) => list.filter((c) => { const why = prune(c); if (why) ctx.pruned.push({ ...c, prunedBecause: why }); return !why; });

  // ---- mechanical hunters: they cost nothing and their finds are addressed ----
  const FG = huntFigures(Ra, Rb, { figures: G.identity.figures });
  const NM = huntNames(Ra, Rb);
  const HK = huntHunks(Ra, Rb, { accidental: G.dependency.accidental, minCoverage: S.align.minCoverage, mechanical: G.dependency.mechanical, figures: G.identity.figures });
  ctx.nominations.alignment = { coverage: HK.coverage ?? null, hunks: HK.hunks ?? null, reordered: Boolean(HK.reordered), readPlaceByPlace: Boolean(HK.ran) };
  const PL = polarityLead(Ra, Rb);
  if (PL.ran && PL.lead) ctx.nominations.leads.push({ lead: 'the two texts hold different numbers of negations (odd against even)', a: PL.a, b: PL.b, by: PL.by, note: 'a lead only: "did not refuse" and "agreed" differ this way and not in meaning' });

  const allHunks = HK.ran ? HK.candidates : [];
  // A figure inside a figure-for-figure hunk that the values DECIDED is that hunk. Where the values could not decide it,
  // the figures stand for the place: they keep their own question, and the place is not counted twice.
  const figureHunks = allHunks.filter((c) => c.kind === 'figure');
  let figs = keep(FG.candidates.filter((c) => !figureHunks.some((h) => h.survives != null && within(c[c.side], h[c.side]))));
  // A name with no equal stays a candidate of its own even where the texts align: the ground's identity rule says when
  // it is asked, and the place it sits in is asked about as a place besides.
  let names = keep(NM.candidates);
  let hunks = keep(allHunks);
  const parts = [];
  const mechAlive = [...hunks, ...figs].some((c) => c.survives === true);

  // ---- the head: each whole text, read against the other by the reader the ground names ----
  const wantWhole = Q.layers.includes('significance');
  const wholeRow = { branch: 'significance/whole', by: L.by(T.whole), reached: false, looked: 0, found: 0 };
  let settled = false, stoppedEarly = false;
  if (!wantWhole) wholeRow.why = "significance is outside the question's shape";
  else if (S.settledByMechanical && mechAlive) { settled = true; wholeRow.why = 'not asked: a mechanical difference already survives, so the answer could not change'; }
  else {
    for (const d of dirs) {
      const k = `${d.x}_says_${d.y}`;
      if (stoppedEarly) { ctx.whole[k] = 'not asked: the answer could not change'; d.skipped = true; continue; }
      const ans = await L.ask(T.whole, 'says', { passage: d.X.text, sentence: d.Y.text }, { ask: `${d.x} says ${d.y}`, whole: true });
      d.whole = ans; ctx.whole[k] = ans === undefined ? L.missing(T.whole) : ans;
      if (ans === 'yes' || ans === 'no') wholeRow.looked++;
      if (ans === 'no') { wholeRow.found++; if (S.stopAtFirstNo) stoppedEarly = true; }
    }
    const asked = dirs.filter((d) => !d.skipped);
    wholeRow.reached = asked.every((d) => d.whole === 'yes' || d.whole === 'no');
    if (!wholeRow.reached) wholeRow.why = asked.some((d) => d.whole === undefined) ? L.missing(T.whole) : 'the reader gave no answer';
  }
  const headNo = dirs.some((d) => d.whole === 'no');
  const headYes = wantWhole && !settled && dirs.every((d) => d.whole === 'yes');

  // When a whole text is not carried: is it opposed, or only silent? Asked of the reader the ground names for that.
  const negative = {};
  if (G.absence.negatives) for (const d of dirs) if (d.whole === 'no') {
    const dn = await L.ask(G.absence.negatives, 'denies', { passage: d.X.text, sentence: d.Y.text }, { ask: `${d.x} denies ${d.y}` });
    negative[d.y] = dn === 'yes' ? 'opposed' : dn === 'no' ? 'silent' : null;
  }

  // ---- how far to walk back ----
  const descend = !settled && (S.descend === 'always' || headNo || !headYes);
  const askIdentity = !settled && (G.identity.unmatched === 'always-asked' || descend);
  let asks = 0;

  if (settled) {
    for (const c of [...hunks, ...figs, ...names]) if (c.survives == null) c.settled = 'not asked: the answer could not change';
  } else {
    // A figure or a name with no equal. The ground's identity rule says when it is asked: always, or only on the walk back.
    if (askIdentity) for (const c of [...figs, ...names]) {
      if (c.survives != null) continue;
      if (asks >= budget.candidates) { c.open = 'beyond the ask budget'; continue; }
      asks++;
      const d = dirOf(c.side), sp = c[c.side], isName = c.kind === 'name';
      // A figure is shown with the sign or unit mark written against it: "-5" and "5%" are asked about as written.
      const fig = isName ? null : withMarks(d.Y.text, sp, c.marks);
      const near = isName ? null : around(d.Y, sp.start, sp.end, G.baseline.window.figure);
      const ans = isName
        ? await L.ask(T.thing, 'says', { passage: d.X.text, sentence: d.Y.text, part: sp.text }, { ask: `${d.x} says this name of ${d.y}` })
        : await L.ask(T.figure, 'figure', { passage: d.X.text, figure: fig.text, part: d.Y.text.slice(Math.min(near.start, fig.start), Math.max(near.end, fig.end)) }, { ask: `${d.x} gives this figure of ${d.y}` });
      const who = isName ? T.thing : T.figure;
      if (ans === 'yes' || ans === 'no') { c.survives = ans === 'no'; c.decidedBy = L.by(who); }
      else c.open = ans === undefined ? L.missing(who) : 'the reader gave no answer';
    }
    // A figure-for-figure place the values could not decide takes the answers given about the figures inside it.
    for (const h of hunks) {
      if (h.kind !== 'figure' || h.survives != null) continue;
      const inside = figs.filter((c) => within(c[c.side], h[c.side]));
      if (!inside.length) continue; // every figure in it was matched elsewhere: left to the walk below
      h.standsFor = 'the figures inside it, which were asked about one by one';
      if (inside.some((c) => c.survives === true)) h.survives = true;
      else if (inside.every((c) => c.survives === false)) h.survives = false;
      else if (inside.some((c) => c.open)) h.open = inside.find((c) => c.open).open;
      else continue; // the figures were not asked (the ground asks them only on the walk back): the place is treated like any other
      h.sameEvidence = true; // its figures already speak for it: it adds no standpoint of its own
      if (h.survives != null) h.decidedBy = uniq(inside.map((c) => c.decidedBy)).join(' | ');
    }

    const pending = hunks.filter((c) => c.survives == null && !c.open);
    if (!descend) {
      // The head carried both texts. Measured against the answer, nothing at these places changes it. They are the
      // head's own reading and are reported on its standpoint; and so with the figures and names the ground did not ask.
      const rest = [...pending, ...figs.filter((c) => c.survives == null && !c.open), ...names.filter((c) => c.survives == null && !c.open)];
      for (const c of rest) { c.survives = false; c.byHead = true; c.decidedBy = `${L.by(T.whole)}: read whole under this ground, nothing here changes the answer (${plural(rest.length, 'place')} read together)`; }
    } else {
      // Place by place, in the order the places stand in the text.
      const onePlace = HK.hunks === 1; // the first text with this place taken from the second IS the second text
      let hunkAsks = 0;
      for (const c of pending) {
        const pairIsMinimal = c.kind === 'order' || onePlace;
        if (pairIsMinimal && T.hunk === T.whole && (headNo || headYes)) {
          // The same reader has already read this very pair at the head. Asking again would be the same draw: the place is
          // decided by that reading, by elimination, and adds no standpoint of its own.
          if (headNo) { c.survives = true; c.byHead = true; c.decidedBy = `${L.by(T.whole)}: read whole; ${c.kind === 'order' ? 'the reordered text is not carried' : 'the texts part only here'}`; }
          else { c.survives = false; c.byHead = true; c.decidedBy = `${L.by(T.whole)}: read whole; ${c.kind === 'order' ? 'the reordering changes nothing' : 'the one place the texts part changes nothing'}`; }
          continue;
        }
        if (hunkAsks >= budget.hunks) { c.open = 'beyond the ask budget'; continue; }
        hunkAsks++;
        // The minimal pair: the first text with only this place taken from the second.
        const twin = pairIsMinimal ? b : substitute(a, c.hunk);
        const answers = [];
        for (const d of dirs) {
          const ans = d.y === 'b'
            ? await L.ask(T.hunk, 'says', { passage: a, sentence: twin }, { ask: 'a says a-with-this-place-from-b', place: c.b?.text ?? '', against: c.a?.text ?? '' })
            : await L.ask(T.hunk, 'says', { passage: twin, sentence: a }, { ask: 'a-with-this-place-from-b says a', place: c.b?.text ?? '', against: c.a?.text ?? '' });
          answers.push(ans);
          if (ans === 'no') break; // one direction not carried is a difference at this place
        }
        if (answers.includes('no')) { c.survives = true; c.decidedBy = L.by(T.hunk); }
        else if (answers.length === dirs.length && answers.every((x) => x === 'yes')) { c.survives = false; c.decidedBy = L.by(T.hunk); }
        else c.open = answers.includes(undefined) ? L.missing(T.hunk) : 'the reader gave no answer';
        if (!pairIsMinimal) c.testedAlone = 'this place was asked about with every other place left as in the first text; places can act together';
      }

      // Part by part, where the texts do not align: each text cut where its reader cut it, each part asked of the other.
      if (!HK.ran) for (const d of dirs) {
        const row = { branch: `parts/${d.y} asked of ${d.x}`, by: L.by(T.part), reached: false, looked: 0, found: 0 };
        ctx.searched.push(row);
        row.wanted = S.descend === 'always' || d.whole === 'no' || (!headNo && d.whole !== 'yes');
        if (!row.wanted) { row.why = d.whole === 'yes' ? 'not asked: this whole text was carried' : 'not asked: the answer could not change'; continue; }
        const U = unitsOf(d.Y);
        row.cut = U.cut; row.cutBy = U.by; row.leftOut = U.leftOut ?? 0;
        if (!U.units.length) { row.why = U.gap ?? 'the reader gave no parts'; continue; }
        const whole = squash(d.Y.text).length;
        const todo = U.units.filter((u) => squash(u.text).length < S.wholePartShare * whole); // a part that is the whole again was asked at the head
        let unanswered = 0, k = 0;
        for (; k < todo.length && k < budget.parts; k++) {
          const u = todo[k];
          const ans = await L.ask(T.part, 'says', { passage: d.X.text, sentence: d.Y.text, part: u.text }, { ask: `${d.x} says this part of ${d.y}` });
          if (ans === undefined) { row.why = L.missing(T.part); break; }
          const at = { text: u.text, start: u.start, end: u.end };
          if (ans === null) { unanswered++; parts.push({ layer: null, kind: 'part', side: d.y, [d.y]: at, role: u.role, by: U.by, survives: null, open: 'the reader gave no answer', why: 'a part asked about and not answered' }); continue; }
          row.looked++;
          if (ans === 'no') { row.found++; parts.push({ layer: null, kind: 'part', side: d.y, [d.y]: at, role: u.role, by: U.by, survives: true, decidedBy: L.by(T.part), why: `asked of ${d.x}: ${d.x} does not say this part of ${d.y}` }); }
        }
        const never = row.why ? todo.length - k : Math.max(0, todo.length - budget.parts);
        if (never > 0) parts.push({ layer: null, kind: 'parts-unasked', side: d.y, by: U.by, survives: null, open: row.why ?? 'beyond the ask budget', why: `${plural(never, 'part')} of ${d.y} never asked` });
        row.reached = !row.why && never === 0 && unanswered === 0 && todo.length > 0;
        if (!row.reached && !row.why) row.why = !todo.length ? 'every part was the whole text again' : never > 0 ? `${plural(never, 'part')} beyond the ask budget` : `${plural(unanswered, 'part')} not answered`;
      }

      // A surviving part is typed: a thing the other text never mentions is a difference of existence; a thing it
      // mentions and does not say the same of is a difference of structure. A part nobody typed stays untyped.
      let typed = 0;
      for (const c of parts) {
        if (c.kind !== 'part' || c.survives !== true) continue;
        const d = dirOf(c.side);
        const m = typed < budget.typing ? await L.ask(T.mentions, 'mentions', { passage: d.X.text, part: c[c.side].text }, { ask: `${d.x} mentions this part of ${d.y}` }) : undefined;
        if (typed < budget.typing) typed++;
        c.layer = m === 'no' ? 'existence' : m === 'yes' ? 'structure' : null;
        c.typedBy = m === 'yes' || m === 'no' ? `${L.by(T.mentions)}: ${d.x} ${m === 'no' ? 'never mentions it' : 'mentions it and does not say it'}` : 'not typed';
      }
    }
  }
  const keptParts = keep(parts);

  // ---- standpoints: who decided what; one examination, one standpoint ----
  const all = [...figs, ...names, ...hunks, ...keptParts];
  for (const c of all) c.signal = c.survives === true ? 'SIG' : c.survives === false ? 'NUL' : null;
  ctx.distinctions.push(...all);
  const isOpen = (c) => c.survives == null && !c.settled;
  const branchOf = (c) => (c.kind === 'figure' || c.kind === 'figure-unread' ? 'existence/figures' : c.side && c.kind === 'name' ? 'existence/names' : c.kind === 'part' || c.kind === 'parts-unasked' ? `${c.layer ?? 'untyped'}/parts` : `${c.layer}/hunks`);
  const label = (c) => `${c.kind} ${show(c)}`;
  const own = all.filter((c) => !c.byHead && !c.sameEvidence); // the head's own places, and a place its figures speak for, add no standpoint
  const groups = new Map();
  for (const c of own) { const k = branchOf(c); (groups.get(k) ?? groups.set(k, []).get(k)).push(c); }
  for (const [branch, list] of groups) {
    const alive = list.filter((c) => c.survives === true), open = list.filter(isOpen), closed = list.filter((c) => c.survives === false);
    if (alive.length) ctx.standpoints.push(standpoint(branch, 'is-not', uniq(alive.map((c) => c.decidedBy)).join(' | '), `${plural(alive.length, 'surviving difference')}: ${alive.map(label).join('; ')}`));
    if (open.length) ctx.standpoints.push(standpoint(branch, 'inexpressible', KERNEL, `${plural(open.length, 'place')} nominated and not decided: ${uniq(open.map((c) => c.open ?? 'no decision')).join('; ')}`));
    if (!alive.length && !open.length && closed.length) ctx.standpoints.push(standpoint(branch, 'is', uniq(closed.map((c) => c.decidedBy)).join(' | '), `${plural(closed.length, 'place')} examined, none changes the answer`));
  }
  // Searches that examined something and nominated nothing still say something, in the name of what examined it.
  if (Q.layers.includes('existence')) {
    if (FG.matched > 0 && !FG.candidates.length && !figureHunks.length) ctx.standpoints.push(standpoint('existence/figures', 'is', FG.by, `${plural(FG.matched, 'figure')} in each text, each with its equal in the other, by its digits and by the marks written against it; a unit or scale written as a word is not compared here (${G.signed('identity')})`));
    if (NM.bothOffer && !NM.gap && NM.matched > 0 && !NM.candidates.length) ctx.standpoints.push(standpoint('existence/names', 'is', `${NM.by}; ${G.signed('identity')}`, 'both readers offered names, and every name in each text is spelled in the other'));
  }
  if (Q.layers.includes('structure')) {
    if (HK.ran && HK.hunks === 0) ctx.standpoints.push(standpoint('structure/hunks', 'is', `${HK.by}; ${G.signed('dependency')}`, 'token for token the two texts are the same; they differ only in what the ground makes accidental'));
    for (const row of ctx.searched) if (row.branch.startsWith('parts/') && row.reached && row.found === 0) ctx.standpoints.push(standpoint('structure/parts', 'is', row.by, `every part asked (${row.looked}) was said: ${row.branch.slice(6)}${row.leftOut ? `; ${plural(row.leftOut, 'run')} with no content word not asked` : ''}`));
  }

  const headsOwn = all.filter((c) => c.byHead);
  if (wantWhole && !settled) {
    const who = L.by(T.whole);
    if (headNo) {
      const said = dirs.filter((d) => d.whole === 'no').map((d) => `${d.x} does not say ${d.y}${negative[d.y] === 'opposed' ? ' and is opposed to it' : negative[d.y] === 'silent' ? ' (silent, not opposed)' : ''}`);
      const eliminated = headsOwn.filter((c) => c.survives === true);
      const located = all.some((c) => c.survives === true);
      const where = eliminated.length ? `; located by elimination at ${eliminated.map(label).join('; ')}` : located ? '' : '; no located place accounts for it';
      ctx.standpoints.push(standpoint('significance/whole', 'is-not', who, `${said.join('; ')}${where}`, { negative, ...(Object.keys(negative).length ? { negativeBy: L.by(G.absence.negatives) } : {}) }));
    } else if (headYes) {
      const read = headsOwn.filter((c) => c.survives === false);
      ctx.standpoints.push(standpoint('significance/whole', 'is', who, `${dirs.length > 1 ? 'a reader who holds either text is told nothing new by the other, read whole' : `${dirs[0].x} read whole says ${dirs[0].y}`}${read.length ? `; ${plural(read.length, 'place')} where the texts part ${read.length === 1 ? 'was' : 'were'} read as part of this and not examined apart` : ''}`));
    } else if (who) ctx.standpoints.push(standpoint('significance/whole', 'inexpressible', who, wholeRow.why ?? 'the reader gave no answer'));
  }

  // ---- the frontier: what was reached, branch by branch ----
  const openIn = (list) => list.filter(isOpen).length;
  const tc = HK.tagChecks;
  ctx.searched.push(
    { branch: 'existence/figures', by: FG.by, reached: FG.looked > 0 && openIn(figs) === 0, looked: FG.looked, matched: FG.matched, found: figs.filter((c) => c.survives === true).length, ...(openIn(figs) ? { open: openIn(figs), why: 'figures nominated and not decided' } : FG.looked ? {} : { why: 'nothing to examine: no figure in either text' }) },
    { branch: 'existence/names', by: NM.by, reached: NM.bothOffer && !NM.gap && NM.looked > 0 && openIn(names) === 0, looked: NM.looked, matched: NM.matched, found: names.filter((c) => c.survives === true).length, ...(NM.gap ? { why: NM.gap } : openIn(names) ? { open: openIn(names), why: 'names nominated and not decided' } : {}) },
    { branch: 'structure/hunks', by: HK.by, reached: Boolean(HK.ran) && openIn(hunks) === 0, looked: HK.hunks ?? 0, found: hunks.filter((c) => c.survives === true).length, coverage: HK.coverage ?? null, ...(HK.gap ? { why: HK.gap } : openIn(hunks) ? { open: openIn(hunks), why: 'places nominated and not decided' } : {}) },
    { branch: 'structure/negation by the readers\' tags', by: null, reached: tc.negation.ran, looked: tc.negation.ran ? 1 : 0, found: hunks.filter((c) => c.kind === 'polarity').length, ...(tc.negation.ran ? {} : { why: tc.negation.why ?? HK.gap ?? 'the texts do not part anywhere' }) },
    { branch: 'structure/order by the readers\' tags', by: null, reached: tc.order.ran, looked: tc.order.ran ? 1 : 0, found: hunks.filter((c) => c.kind === 'order' && c.survives === true && !c.byHead).length, ...(tc.order.ran ? {} : { why: HK.reordered ? (tc.order.why ?? 'not run') : 'the texts are not a reordering of each other' }) },
    wholeRow,
    { branch: 'significance/reader-state change through the Fold (pathos)', by: null, reached: false, looked: 0, found: 0, why: 'not built: the whole-text reading by a named reader stands in for it' },
  );
  requireBranches(ctx, 'information', { 'significance/whole': { ok: wantWhole && (wholeRow.reached || settled), why: wholeRow.why ?? 'the whole texts were not read' } });
}

// ---- "the same invoice": one particular thing, agreeing or not ------------------

async function identity(ctx) {
  const { G, a, b, L, T, opts } = ctx;
  // Two copies of one sentence can still be about two things. Nothing is decided here by comparing strings.
  const who = L.by(T.about);
  const row = { branch: 'identity/about', by: who, reached: false, looked: 0, found: 0 };
  const armRow = { branch: 'identity/control', by: who, reached: false, looked: 0, found: 0 };
  ctx.searched.push(row, armRow);
  const orders = [{ passage: a, sentence: b, name: 'a as the passage' }, { passage: b, sentence: a, name: 'b as the passage' }];
  for (const o of orders) o.ans = await L.ask(T.about, 'about', { passage: o.passage, sentence: o.sentence }, { ask: `about one thing, ${o.name}` });
  if (orders.some((o) => o.ans === undefined)) {
    row.why = L.missing(T.about); armRow.why = row.why;
    ctx.standpoints.push(standpoint('identity/about', 'inexpressible', `${KERNEL}; ${G.signed('baseline')}`, row.why));
  } else {
    row.looked = orders.filter((o) => o.ans === 'yes' || o.ans === 'no').length; row.found = orders.filter((o) => o.ans === 'no').length;
    row.reached = row.looked === orders.length; if (!row.reached) row.why = 'the reader gave no answer in one order or both';
    // Each order is its own draw and its own standpoint. If they disagree, that is reported as both.
    for (const o of orders) ctx.standpoints.push(standpoint('identity/about', o.ans === 'yes' ? 'is' : o.ans === 'no' ? 'is-not' : 'inexpressible', who, `asked with ${o.name}: ${o.ans === 'yes' ? 'about one particular thing' : o.ans === 'no' ? 'not about one particular thing' : 'no answer'}`));
    // Armed with a statement from elsewhere in the asker's record: it should NOT be read as the same thing.
    const control = (opts.controls ?? []).find((c) => squash(c) && squash(c) !== squash(a) && squash(c) !== squash(b));
    if (!control) armRow.why = 'no control statement handed in: the reader was not shown to tell things apart';
    else {
      const arm = await L.ask(T.about, 'about', { passage: a, sentence: control }, { ask: 'a and a control about one thing', control: true });
      armRow.looked = arm === 'yes' || arm === 'no' ? 1 : 0; armRow.reached = armRow.looked === 1; armRow.toldApart = arm === 'no';
      if (!armRow.reached) armRow.why = 'the reader gave no answer about the control';
      // The control's answer is its own standpoint. It does not erase the direct answers; it stands beside them.
      if (arm === 'yes' && orders.some((o) => o.ans === 'yes')) ctx.standpoints.push(standpoint('identity/control', 'inexpressible', who, 'the reader also called an unrelated control statement the same thing: its yes is not telling things apart here'));
    }
  }
  requireBranches(ctx, 'identity', { 'identity/control': { ok: armRow.reached, why: armRow.why ?? 'the control was not asked' } });
}

// ---- "both are invoices": each is of the kind the asker named -------------------

async function kind(ctx) {
  const { G, Q, a, b, L, T } = ctx;
  const who = L.by(T.kind);
  const row = { branch: 'kind/named', by: who, reached: false, looked: 0, found: 0, note: `kind named by the asker (${Q.by}): "${Q.kind}"; not armed` };
  ctx.searched.push(row);
  // Two copies of one text are still each asked about (once): being the same string says nothing about their kind.
  const f = await L.ask(T.kind, 'kind', { passage: a, kind: Q.kind }, { ask: 'a is of the kind' });
  if (f === undefined) { row.why = L.missing(T.kind); ctx.standpoints.push(standpoint('kind/named', 'inexpressible', `${KERNEL}; ${G.signed('baseline')}`, row.why)); return; }
  const h = squash(a) === squash(b) ? f : await L.ask(T.kind, 'kind', { passage: b, kind: Q.kind }, { ask: 'b is of the kind' });
  row.looked = [f, h].filter((x) => x === 'yes' || x === 'no').length; row.found = [f, h].filter((x) => x === 'no').length;
  if (f === 'yes' && h === 'yes') { row.reached = true; ctx.standpoints.push(standpoint('kind/named', 'is', who, `both read as: ${Q.kind}`)); }
  else if (f === 'no' || h === 'no') { row.reached = true; ctx.standpoints.push(standpoint('kind/named', 'is-not', who, `${[f === 'no' ? 'the first' : null, h === 'no' ? 'the second' : null].filter(Boolean).join(' and ')} not read as: ${Q.kind}`)); }
  else { row.why = 'the reader gave no answer'; ctx.standpoints.push(standpoint('kind/named', 'inexpressible', who, row.why)); }
}

// For scoring against a yes/no label only. The verdict itself is the standing.
export const strictlySame = (v) => v?.standing === 'asti';
