// score-scene-kin.mjs — PREREG-SCENE-MODEL: score the scene model against the scene-lens gold (a self:model opinion), beside the plain arm, the second binder, the paragraph-only variant and the controls. Deterministic, no model, no network.
//   node score-scene-kin.mjs --text <text> --ledger <KinLedger.json> --gold <gold.json> --out <results.json>
// Arms: PLAIN (category A statements tied to the ledger as the foldcode build does), T2 (the second binder: the page layer), S1, S2, S3 (the scene model at tiers 1 to 3; S3 is the REGISTERED model the bars judge), A0 (S3's rules with the scene cut to the paragraph and the one before).
// Controls over the ends S3 binds on the unbound statements: C1 chance in the paragraph-and-one-before pool, C2 deranged ends, C1S chance in the statement's SCENE pool, C3 swapped ends (the mutant), SC the shuffled-scene control (at every paragraph start the scene state of a paragraph of ANOTHER scene replaces the real one).
// Seeded (mulberry32, 20261028), 1000 draws.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extract } from "./extract-kin.mjs";
import { loadPriors } from "./bind-kin2.mjs";
import { prepare, apply, segment, sceneKin, SCENE_REASONS, PARAMS } from "./scene-kin.mjs";
import { validateGold } from "./validate-gold-scene.mjs";
import { GAP_KINDS } from "../../native/organs/kinship.js";

export const SEED = 20261028, DRAWS = 1000;
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pct = (xs, p) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))]; };
const ratio = (a, b) => (b ? a / b : null);
const END = ["holder", "possessor"];

/** The whole scoring over one window; pure (same inputs, same output). */
export function score({ text, ledger, gold, priors }) {
  const buf = Buffer.from(text);
  const extraction = extract({ text, lang: "ru", lexicon: priors.lexicon, namePartsRu: priors.nameParts });
  const problems = validateGold({ gold, text, ledger, extraction }); if (problems.length) throw new Error(`the gold is malformed:\n${problems.slice(0, 20).join("\n")}`);
  const beings = new Set(ledger.referents.filter((r) => r.standing === "referent").map((r) => r.id));
  const nameSpans = ledger.spans.filter((s) => s.kind === "name" && s.ref && beings.has(s.ref));
  // ---- PLAIN arm: category A only, ends by the nearest ledger names (the foldcode build's rule)
  const closest = (cands, key) => cands.slice().sort((a, b) => key(a) - key(b) || (b.bytes[1] - b.bytes[0]) - (a.bytes[1] - a.bytes[0]) || a.bytes[0] - b.bytes[0])[0] ?? null;
  const plain = extraction.stmts.map((s) => {
    const rec = { holder: { ref: null }, possessor: { ref: null } }; if (s.cat !== "A") return rec;
    const [lo, hi] = s.span, [tLo, tHi] = s.termAt;
    const h = closest(nameSpans.filter((x) => x.bytes[1] > lo && x.bytes[1] <= tLo), (x) => tLo - x.bytes[1]);
    const p = closest(nameSpans.filter((x) => x.bytes[0] >= tHi && x.bytes[0] < hi), (x) => x.bytes[0] - tHi);
    if (!h || !p || h.ref === p.ref) return rec;
    rec.holder = { ref: h.ref, rule: "plain-A" }; rec.possessor = { ref: p.ref, rule: "plain-A" }; return rec;
  });
  // ---- the scene arms
  const P = prepare({ text, ledger, extraction, priors }), scenes = segment(P);
  const real3 = apply(P, { tier: 3, scenes }), s1r = apply(P, { tier: 1, scenes }), s2r = apply(P, { tier: 2, scenes }), a0r = apply(P, { tier: 3, mode: "paragraph", scenes }), t2r = P.base;
  const asArm = (b) => b.statements.map((s) => ({ holder: s.holder, possessor: s.possessor }));
  const arms = { plain, t2: asArm(t2r), s1: asArm(s1r), s2: asArm(s2r), s3: asArm(real3), a0: asArm(a0r) };
  // ---- candidate pools for the chance controls
  const lines = text.split("\n"), lineStart = []; { let p = 0; for (const l of lines) { lineStart.push(p); p += l.length + 1; } }
  const pn = []; { let n = -1; for (const l of lines) { if (l.trim()) n++; pn.push(n); } }
  const lineOfChar = (c) => { let lo = 0, hi = lineStart.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (lineStart[m] <= c) lo = m; else hi = m - 1; } return lo; };
  const charOfByte = (b) => buf.subarray(0, b).toString("utf8").length;
  const refsByPnum = new Map(); for (const sp of nameSpans) { const k = pn[lineOfChar(sp.at[0])]; (refsByPnum.get(k) ?? refsByPnum.set(k, new Set()).get(k)).add(sp.ref); }
  const pool = extraction.stmts.map((s) => { const k = pn[lineOfChar(charOfByte(s.termAt[0]))]; return [...new Set([...(refsByPnum.get(k - 1) ?? []), ...(refsByPnum.get(k) ?? [])])].sort(); });
  const paraOfStmt = P.base.statements.map((s) => P.toks[P.tokAtByte.get(s.termAt[0])].pi);
  const sceneOfPara = new Array(P.paras.length); for (const sc of scenes) for (let k = sc.from; k <= sc.to; k++) sceneOfPara[k] = sc;
  const beingsInPara = P.paras.map(() => new Set()); for (const t of P.toks) if (t.pi >= 0 && t.mention && t.mention.first === t.i) beingsInPara[t.pi].add(t.mention.ref);
  const scenePool = paraOfStmt.map((pi) => { const sc = sceneOfPara[pi], set = new Set(); for (let k = sc.from; k <= pi; k++) for (const r of beingsInPara[k]) set.add(r); return [...set].sort(); });
  // ---- scoring of one arm over a subset of statements
  const goldOf = (i, end) => gold.statements[i][end];
  function metrics(arm, subset) {
    let bound = 0, correct = 0, wrong = 0, goldBound = 0, nullBound = 0, facts = 0, factsCorrect = 0, goldFacts = 0;
    for (const i of subset) {
      const h = arm[i].holder.ref ?? null, p = arm[i].possessor.ref ?? null;
      for (const end of END) { const b = arm[i][end].ref ?? null, g = goldOf(i, end).ref; if (g) goldBound++; if (b) { bound++; if (b === g) correct++; else { wrong++; if (!g) nullBound++; } } }
      if (goldOf(i, "holder").ref && goldOf(i, "possessor").ref) goldFacts++;
      if (h && p && h !== p) { facts++; if (h === goldOf(i, "holder").ref && p === goldOf(i, "possessor").ref) factsCorrect++; }
    }
    return { statements: subset.length, bound, correct, wrong, wrong_where_gold_has_no_referent: nullBound, gold_bound: goldBound, precision: ratio(correct, bound), recall: ratio(correct, goldBound), facts, facts_correct: factsCorrect, gold_facts: goldFacts, fact_precision: ratio(factsCorrect, facts), fact_recall: ratio(factsCorrect, goldFacts) };
  }
  const all = extraction.stmts.map((_, i) => i), unbound = all.filter((i) => extraction.stmts[i].cat !== "A");
  // ---- controls
  const rng = mulberry32(SEED), s3arm = arms.s3;
  const boundEnds = []; for (const i of unbound) for (const end of END) if (s3arm[i][end].ref) boundEnds.push({ i, end });
  const dist = (build) => { const out = { precision: [], recall: [], fact_precision: [], correct: [] }; for (let d = 0; d < DRAWS; d++) { const arm = build(); const m = metrics(arm, unbound); out.precision.push(m.precision ?? 0); out.recall.push(m.recall ?? 0); out.fact_precision.push(m.fact_precision ?? 0); out.correct.push(m.correct); } return out; };
  const empty = () => all.map(() => ({ holder: { ref: null }, possessor: { ref: null } }));
  const drawFrom = (poolOf) => () => { const arm = empty(); for (const { i, end } of boundEnds) { const Pl = poolOf[i]; if (!Pl.length) continue; const ref = Pl[Math.floor(rng() * Pl.length)]; if (end === "possessor" && arm[i].holder.ref === ref) continue; arm[i][end] = { ref }; } return arm; };
  const c1 = dist(drawFrom(pool)), c1s = dist(drawFrom(scenePool));
  const c2 = dist(() => { const arm = empty(); for (const end of END) { const mine = boundEnds.filter((x) => x.end === end); const refs = mine.map((x) => s3arm[x.i][end].ref); for (let k = refs.length - 1; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [refs[k], refs[j]] = [refs[j], refs[k]]; } mine.forEach((x, k) => { arm[x.i][end] = { ref: refs[k] }; }); } return arm; });
  const swapped = s3arm.map((s) => ({ holder: s.possessor, possessor: s.holder }));
  // the shuffled-scene control: every paragraph takes, at its start, the scene state of a uniformly drawn paragraph of ANOTHER scene
  const scCtl = { precision: [], correct: [], fact_precision: [] }, scAssessable = scenes.length >= 2;
  if (scAssessable) for (let d = 0; d < DRAWS; d++) {
    const sigma = P.paras.map((_, k) => { const other = []; for (const sc of scenes) if (sc !== sceneOfPara[k]) for (let q = sc.from; q <= sc.to; q++) other.push(q); return other[Math.floor(rng() * other.length)]; });
    const m = metrics(asArm(apply(P, { tier: 3, mode: "shuffled", scenes, sigma, snaps0: real3.snaps })), unbound); scCtl.precision.push(m.precision ?? 0); scCtl.correct.push(m.correct); scCtl.fact_precision.push(m.fact_precision ?? 0);
  }
  const summary = (d) => ({ draws: d.length, mean: d.length ? d.reduce((a, b) => a + b, 0) / d.length : null, p95: d.length ? pct(d, 0.95) : null, p99: d.length ? pct(d, 0.99) : null, max: d.length ? Math.max(...d) : null });
  const controls = { seed: SEED, C1_chance_in_paragraph_pool: { precision: summary(c1.precision), recall: summary(c1.recall), fact_precision: summary(c1.fact_precision) }, C2_deranged: { precision: summary(c2.precision), recall: summary(c2.recall), fact_precision: summary(c2.fact_precision) },
    C1S_chance_in_scene_pool: { precision: summary(c1s.precision), recall: summary(c1s.recall), fact_precision: summary(c1s.fact_precision) }, C3_swapped_ends: metrics(swapped, unbound), SC_shuffled_scene: { assessable: scAssessable, precision: summary(scCtl.precision), correct_ends: summary(scCtl.correct), fact_precision: summary(scCtl.fact_precision) } };
  // ---- breakdowns for S3 over the unbound statements
  const byRule = {}, byGoldKind = {}, byGoldDirection = {}, gapReasons = {}, goldNull = {};
  for (const i of unbound) for (const end of END) {
    const b = real3.statements[i][end], g = goldOf(i, end);
    if (b.ref) { const r = (byRule[b.rule] ??= { bound: 0, correct: 0, wrong_where_gold_has_no_referent: 0 }); r.bound++; if (b.ref === g.ref) r.correct++; else if (!g.ref) r.wrong_where_gold_has_no_referent++; }
    else { const r = (gapReasons[b.gap] ??= { gaps: 0, gold_bound: 0 }); r.gaps++; if (g.ref) r.gold_bound++; }
    if (g.ref) { const k = (byGoldKind[g.kind] ??= { gold_bound: 0, s3_correct: 0, t2_correct: 0, a0_correct: 0 }); k.gold_bound++; if (b.ref === g.ref) k.s3_correct++; if (arms.t2[i][end].ref === g.ref) k.t2_correct++; if (arms.a0[i][end].ref === g.ref) k.a0_correct++;
      const d = (byGoldDirection[g.direction] ??= { gold_bound: 0, s3_correct: 0 }); d.gold_bound++; if (b.ref === g.ref) d.s3_correct++; }
    else goldNull[g.why] = (goldNull[g.why] ?? 0) + 1;
  }
  // ---- the ceiling: statements with both ends nameable in the scene, and those a backward-reading rule could reach
  const both = all.filter((i) => goldOf(i, "holder").ref && goldOf(i, "possessor").ref), bothBackward = both.filter((i) => END.every((e) => goldOf(i, e).direction !== "after"));
  const ceiling = { statements: all.length, gold_ends_bound: all.reduce((a, i) => a + END.filter((e) => goldOf(i, e).ref).length, 0), gold_ends: all.length * 2, both_ends_bound: both.length, both_ends_bound_no_forward_reference: bothBackward.length, both_ends_bound_unbound_statements: both.filter((i) => unbound.includes(i)).length };
  // ---- scene boundaries, report only: the mechanical scene starts against the labelled ones
  const mech = scenes.slice(1).map((s) => s.from), lab = gold.scene_breaks, within = (a, b, tol) => a.filter((x) => b.some((y) => Math.abs(x - y) <= tol)).length;
  const sceneReport = { mechanical_scenes: scenes.length, labelled_scenes: lab.length + 1, mechanical_breaks_exact_in_gold: within(mech, lab, 0), mechanical_breaks_within_1_of_gold: within(mech, lab, 1), gold_breaks_exact_in_mechanical: within(lab, mech, 0), gold_breaks_within_1_in_mechanical: within(lab, mech, 1), mechanical_breaks: mech.length, gold_breaks: lab.length, W: PARAMS.W };
  // ---- integrity checks (B4, B7) over every emitted fact and every statement of S3
  const integrity = { facts_checked: 0, witness_contains_term: 0, ends_inside_witness: 0, giver_standing_ok: 0, ends_are_ledger_beings: 0, statements: real3.statements.length, gaps_typed: 0, statements_with_gap_match: 0 };
  for (const s of real3.statements) {
    if (s.fact) { integrity.facts_checked++; const [a, b] = s.fact.witness.split("#")[1].split("-").map(Number);
      if (a <= s.termAt[0] && s.termAt[1] <= b && buf.subarray(a, b).toString("utf8").includes(buf.subarray(s.termAt[0], s.termAt[1]).toString("utf8"))) integrity.witness_contains_term++;
      if (END.every((e) => s[e].mention[0] >= a && s[e].mention[1] <= b)) integrity.ends_inside_witness++;
      if (/^text:ru\|rule:[A-Z0-9+-]+$/.test(s.fact.giver) && real3.specs.every((x) => x.standing === "candidate")) integrity.giver_standing_ok++;
      if (END.every((e) => beings.has(s[e].ref))) integrity.ends_are_ledger_beings++; }
    const unboundEnds = END.filter((e) => !s[e].ref).length;
    if (s.gaps.length === unboundEnds) integrity.statements_with_gap_match++;
    for (const g of s.gaps) if (Object.hasOwn(GAP_KINDS, g.kind) && SCENE_REASONS.includes(g.why)) integrity.gaps_typed++;
  }
  integrity.total_gaps = real3.statements.reduce((a, s) => a + s.gaps.length, 0);
  // ---- the bars (PREREG-SCENE-MODEL section 4); `unassessed` is a result, not a pass
  const m3 = metrics(arms.s3, unbound), mAll3 = metrics(arms.s3, all), mAllPlain = metrics(arms.plain, all);
  const nullP95 = (k) => Math.max(controls.C1_chance_in_paragraph_pool[k].p95, controls.C2_deranged[k].p95, controls.C1S_chance_in_scene_pool[k].p95);
  const bar = (id, name, pass, detail, assessable = true) => ({ id, name, result: !assessable ? "unassessed" : pass ? "pass" : "fail", ...detail });
  const bars = [
    bar("B1", "end precision beats all three chance controls and the declared budget (2 of 3)", m3.precision !== null && m3.precision > nullP95("precision") && m3.precision >= 2 / 3, { precision: m3.precision, null_p95: nullP95("precision"), budget: 2 / 3, bound: m3.bound }, m3.bound >= 10 && nullP95("precision") < 1),
    bar("B2", "the model ties more correct ends than the plain arm over all statements, and its recall beats the scene-pool chance control", mAll3.correct > mAllPlain.correct && m3.recall !== null && m3.recall > controls.C1S_chance_in_scene_pool.recall.p95, { model_correct_all: mAll3.correct, plain_correct_all: mAllPlain.correct, recall_unbound: m3.recall, null_p95: controls.C1S_chance_in_scene_pool.recall.p95, gold_bound_unbound: m3.gold_bound }, m3.gold_bound >= 10),
    bar("B3", "emitted facts: both ends right at least half the time and beyond all three nulls, and more correct two-ended facts than the plain arm over all statements", m3.fact_precision !== null && m3.fact_precision >= 0.5 && m3.fact_precision > nullP95("fact_precision") && mAll3.facts_correct > mAllPlain.facts_correct, { fact_precision: m3.fact_precision, facts: m3.facts, null_p95: nullP95("fact_precision"), correct_facts_all: mAll3.facts_correct, plain_correct_facts_all: mAllPlain.facts_correct }, m3.facts >= 3 && nullP95("fact_precision") < 1),
    bar("B4", "every emitted fact is witnessed (term and ends inside a byte span that reads back), has giver text:ru|rule:... and standing candidate, and ends that are ledger beings", integrity.facts_checked === integrity.witness_contains_term && integrity.facts_checked === integrity.ends_inside_witness && integrity.facts_checked === integrity.giver_standing_ok && integrity.facts_checked === integrity.ends_are_ledger_beings, { integrity }, integrity.facts_checked > 0),
    bar("B7", "every unbound end is a typed gap (kind of kinship.js, reason of the closed set), none silent", integrity.statements_with_gap_match === integrity.statements && integrity.gaps_typed === integrity.total_gaps, { integrity }),
    bar("B9", "mutant C3 (swapped ends) falls below the B1 precision threshold: the bar can fire", controls.C3_swapped_ends.precision === null || controls.C3_swapped_ends.precision < Math.max(nullP95("precision"), 2 / 3), { c3_precision: controls.C3_swapped_ends.precision, threshold: Math.max(nullP95("precision"), 2 / 3) }, controls.C3_swapped_ends.bound >= 3),
    bar("B10", "the shuffled-scene control: the model's precision and its correct ends exceed the control's p95 (the scene, not the rules alone, ties the ends)", scAssessable && m3.precision !== null && m3.precision > controls.SC_shuffled_scene.precision.p95 && m3.correct > controls.SC_shuffled_scene.correct_ends.p95, { precision: m3.precision, sc_precision_p95: controls.SC_shuffled_scene.precision.p95, correct: m3.correct, sc_correct_p95: controls.SC_shuffled_scene.correct_ends.p95 }, scAssessable && m3.bound >= 10),
  ];
  return { schema: "SceneKinScore@1", window: gold.window, gold: { holder: gold.holder, lens: gold.lens, opinion: gold.opinion, note: "every number below is measured against a self:model opinion (a model context that never saw the scene model), not a giver" },
    text_sha256: crypto.createHash("sha256").update(buf).digest("hex"), params: PARAMS, statements: { total: all.length, unbound: unbound.length, plain_categories: extraction.stmts.reduce((m, s) => ((m[s.cat] = (m[s.cat] ?? 0) + 1), m), {}) },
    arms: Object.fromEntries(Object.keys(arms).map((k) => [k, { all: metrics(arms[k], all), unbound: metrics(arms[k], unbound) }])), controls,
    s3_breakdown: { by_rule: byRule, by_gold_kind: byGoldKind, by_gold_direction: byGoldDirection, gap_reasons: gapReasons, gold_without_referent: goldNull }, ceiling, scene_report: sceneReport, bars,
    binder: { s3_counts: real3.counts, s2_counts: s2r.counts, s1_counts: s1r.counts, t2_counts: t2r.counts },
    statements_detail: real3.statements.map((s) => ({ i: s.i, term: s.term, plain: s.plain, scene: gold.statements[s.i].scene, holder: s.holder.ref ? { ref: s.holder.ref, rule: s.holder.rule } : { gap: s.holder.gap }, possessor: s.possessor.ref ? { ref: s.possessor.ref, rule: s.possessor.rule } : { gap: s.possessor.gap }, gold: { holder: gold.statements[s.i].holder.ref, possessor: gold.statements[s.i].possessor.ref }, fact: s.fact?.giver ?? null })),
    s3_output_sha256: crypto.createHash("sha256").update(JSON.stringify({ ...real3, snaps: undefined })).digest("hex") };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
  const here = path.dirname(fileURLToPath(import.meta.url)), priors = loadPriors(arg("priors", path.join(here, "..", "..", "priors")));
  const text = fs.readFileSync(arg("text"), "utf8"), ledger = JSON.parse(fs.readFileSync(arg("ledger"), "utf8")), gold = JSON.parse(fs.readFileSync(arg("gold"), "utf8"));
  const a = JSON.stringify(score({ text, ledger, gold, priors }), null, 1), b = JSON.stringify(score({ text, ledger, gold, priors }), null, 1);
  const extraction = extract({ text, lang: "ru", lexicon: priors.lexicon, namePartsRu: priors.nameParts });
  const r1 = JSON.stringify(sceneKin({ text, ledger, extraction, priors })), r2 = JSON.stringify(sceneKin({ text, ledger, extraction, priors }));
  const res = JSON.parse(a); res.determinism = { scorer_runs: 2, scorer_identical: a === b, scorer_sha256: crypto.createHash("sha256").update(a).digest("hex"), model_runs: 2, model_identical: r1 === r2, model_output_sha256: crypto.createHash("sha256").update(r1).digest("hex") };
  fs.writeFileSync(arg("out"), JSON.stringify(res, null, 1) + "\n");
  const f = (x) => (x === null || x === undefined ? "—" : x.toFixed(3)), A = res.arms;
  console.log(`unbound ${res.statements.unbound}/${res.statements.total}; plain bound ${A.plain.unbound.bound}; T2 bound ${A.t2.unbound.bound} correct ${A.t2.unbound.correct}; S3 bound ${A.s3.unbound.bound} correct ${A.s3.unbound.correct} prec ${f(A.s3.unbound.precision)} rec ${f(A.s3.unbound.recall)} facts ${A.s3.unbound.facts}/${A.s3.unbound.gold_facts} right ${A.s3.unbound.facts_correct}; A0 bound ${A.a0.unbound.bound} correct ${A.a0.unbound.correct}`);
  console.log(`C1 p95 ${f(res.controls.C1_chance_in_paragraph_pool.precision.p95)}; C2 p95 ${f(res.controls.C2_deranged.precision.p95)}; C1S p95 ${f(res.controls.C1S_chance_in_scene_pool.precision.p95)}; C3 ${f(res.controls.C3_swapped_ends.precision)}; SC p95 ${f(res.controls.SC_shuffled_scene.precision.p95)}; determinism ${res.determinism.scorer_identical && res.determinism.model_identical}`);
  console.log(res.bars.map((x) => `${x.id}:${x.result}`).join("  "));
}
