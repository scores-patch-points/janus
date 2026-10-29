// score-kind-kin.mjs — PREREG-KIND-KIN: score the kind-induction arm K against the scene-lens gold (a self:model opinion) with POLARITY labels, beside the plain arm, the second binder, the scene model S3 (the same window, the same gold: the comparison) and the ablations.
//   node score-kind-kin.mjs --text <text> --ledger <KinLedger.json> --gold <gold.json> --beings <KinStoreBeings.json> --polarity <PolarityLexicon.json> --kin-rows <KinStoreRows.json> --out <results.json>
// Arms: PLAIN, T2 (the page layer), S3 (the scene model, scene-model-5's registered arm), K (REGISTERED: the company-induced kinds, a sex gate that spares a being of unknown sex, polarity read), KG0 (K without the kind gate), KP0 (K reading no polarity).
// Controls over the ends K binds on the unbound statements: C1 chance in the paragraph-and-one-before pool, C2 deranged ends, C1K chance among the person-kind beings (the induced roster), C3 swapped ends (the mutant), SK the shuffled-KIND control (the kind records permuted among the beings, the same rules and gate applied).
// Seeded (mulberry32, 20261029), 1000 draws.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extract } from "./extract-kin.mjs";
import { loadPriors } from "./bind-kin2.mjs";
import { prepare, apply, segment } from "./scene-kin.mjs";
import { prepareKind, applyKind, kindKin, KIND_REASONS, PARAMS } from "./kind-kin.mjs";
import { validateGold2 } from "./validate-gold-scene2.mjs";
import { GAP_KINDS } from "../../native/organs/kinship.js";

export const SEED = 20261029, DRAWS = 1000, REGISTERED = Object.freeze({ gate: true, sexStrict: false, polarityOn: true });
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pct = (xs, p) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))]; };
const ratio = (a, b) => (b ? a / b : null);
const END = ["holder", "possessor"];

export function score({ text, ledger, gold, priors, beingRows, polarity, kinRows }) {
  const buf = Buffer.from(text);
  const extraction = extract({ text, lang: "ru", lexicon: priors.lexicon, namePartsRu: priors.nameParts });
  const problems = validateGold2({ gold, text, ledger, extraction }); if (problems.length) throw new Error(`the gold is malformed:\n${problems.slice(0, 20).join("\n")}`);
  const beings = new Set(ledger.referents.filter((r) => r.standing === "referent").map((r) => r.id));
  const nameSpans = ledger.spans.filter((s) => s.kind === "name" && s.ref && beings.has(s.ref));
  const closest = (cands, key) => cands.slice().sort((a, b) => key(a) - key(b) || (b.bytes[1] - b.bytes[0]) - (a.bytes[1] - a.bytes[0]) || a.bytes[0] - b.bytes[0])[0] ?? null;
  const plain = extraction.stmts.map((s) => {
    const rec = { holder: { ref: null }, possessor: { ref: null } }; if (s.cat !== "A") return rec;
    const [lo, hi] = s.span, [tLo, tHi] = s.termAt;
    const h = closest(nameSpans.filter((x) => x.bytes[1] > lo && x.bytes[1] <= tLo), (x) => tLo - x.bytes[1]), p = closest(nameSpans.filter((x) => x.bytes[0] >= tHi && x.bytes[0] < hi), (x) => x.bytes[0] - tHi);
    if (!h || !p || h.ref === p.ref) return rec;
    rec.holder = { ref: h.ref, rule: "plain-A" }; rec.possessor = { ref: p.ref, rule: "plain-A" }; return rec;
  });
  const K = prepareKind({ text, ledger, extraction, priors, beingRows, polarity, kinRows }), P = prepare({ text, ledger, extraction, priors });
  const kReal = applyKind(K, REGISTERED), kg0 = applyKind(K, { ...REGISTERED, gate: false }), kp0 = applyKind(K, { ...REGISTERED, polarityOn: false }), s3 = apply(P, { tier: 3, scenes: segment(P) });
  const asArm = (b) => b.statements.map((s) => ({ holder: s.holder, possessor: s.possessor }));
  const arms = { plain, t2: asArm(P.base), s3: asArm(s3), k: asArm(kReal), kg0: asArm(kg0), kp0: asArm(kp0) };
  // ---- pools for the chance controls
  const lines = text.split("\n"), lineStart = []; { let p = 0; for (const l of lines) { lineStart.push(p); p += l.length + 1; } }
  const pn = []; { let n = -1; for (const l of lines) { if (l.trim()) n++; pn.push(n); } }
  const lineOfChar = (c) => { let lo = 0, hi = lineStart.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (lineStart[m] <= c) lo = m; else hi = m - 1; } return lo; };
  const charOfByte = (b) => buf.subarray(0, b).toString("utf8").length;
  const refsByPnum = new Map(); for (const sp of nameSpans) { const k = pn[lineOfChar(sp.at[0])]; (refsByPnum.get(k) ?? refsByPnum.set(k, new Set()).get(k)).add(sp.ref); }
  const pool = extraction.stmts.map((s) => { const k = pn[lineOfChar(charOfByte(s.termAt[0]))]; return [...new Set([...(refsByPnum.get(k - 1) ?? []), ...(refsByPnum.get(k) ?? [])])].sort(); });
  const roster = [...K.kinds].filter(([, v]) => v.person).map(([r]) => r).sort(), rosterPool = extraction.stmts.map(() => roster);
  const goldOf = (i, end) => gold.statements[i][end];
  function metrics(arm, subset) {
    let bound = 0, correct = 0, wrong = 0, goldBound = 0, nullBound = 0, facts = 0, factsCorrect = 0, goldFacts = 0;
    for (const i of subset) {
      const h = arm[i].holder.ref ?? null, p = arm[i].possessor.ref ?? null;
      for (const end of END) { const b = arm[i][end].ref ?? null, g = goldOf(i, end).ref; if (g) goldBound++; if (b) { bound++; if (b === g) correct++; else { wrong++; if (!g) nullBound++; } } }
      if (goldOf(i, "holder").ref && goldOf(i, "possessor").ref) goldFacts++;
      if (h && p && h !== p && arm[i].fact !== false) { facts++; if (h === goldOf(i, "holder").ref && p === goldOf(i, "possessor").ref) factsCorrect++; }
    }
    return { statements: subset.length, bound, correct, wrong, wrong_where_gold_has_no_referent: nullBound, gold_bound: goldBound, precision: ratio(correct, bound), recall: ratio(correct, goldBound), facts, facts_correct: factsCorrect, gold_facts: goldFacts, fact_precision: ratio(factsCorrect, facts), fact_recall: ratio(factsCorrect, goldFacts) };
  }
  // a fact is an emitted fact: arms from the binders carry `fact`, the chance arms carry none (every two-ended statement counts, as in the earlier scorers)
  const withFacts = (res) => res.statements.map((s) => ({ holder: s.holder, possessor: s.possessor, fact: s.fact ? true : false }));
  arms.k = withFacts(kReal); arms.kg0 = withFacts(kg0); arms.kp0 = withFacts(kp0);
  for (const k of ["plain", "t2", "s3"]) arms[k] = arms[k].map((s, i) => ({ ...s, fact: s.holder.ref && s.possessor.ref ? true : false }));
  const all = extraction.stmts.map((_, i) => i), unbound = all.filter((i) => extraction.stmts[i].cat !== "A");
  const rng = mulberry32(SEED), karm = arms.k, boundEnds = []; for (const i of unbound) for (const end of END) if (karm[i][end].ref) boundEnds.push({ i, end });
  const dist = (build) => { const out = { precision: [], recall: [], fact_precision: [], correct: [] }; for (let d = 0; d < DRAWS; d++) { const m = metrics(build(), unbound); out.precision.push(m.precision ?? 0); out.recall.push(m.recall ?? 0); out.fact_precision.push(m.fact_precision ?? 0); out.correct.push(m.correct); } return out; };
  const empty = () => all.map(() => ({ holder: { ref: null }, possessor: { ref: null } }));
  const drawFrom = (poolOf) => () => { const arm = empty(); for (const { i, end } of boundEnds) { const Pl = poolOf[i]; if (!Pl.length) continue; const ref = Pl[Math.floor(rng() * Pl.length)]; if (end === "possessor" && arm[i].holder.ref === ref) continue; arm[i][end] = { ref }; } return arm; };
  const c1 = dist(drawFrom(pool)), c1k = dist(drawFrom(rosterPool));
  const c2 = dist(() => { const arm = empty(); for (const end of END) { const mine = boundEnds.filter((x) => x.end === end); const refs = mine.map((x) => karm[x.i][end].ref); for (let k = refs.length - 1; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [refs[k], refs[j]] = [refs[j], refs[k]]; } mine.forEach((x, k) => { arm[x.i][end] = { ref: refs[k] }; }); } return arm; });
  const swapped = karm.map((s) => ({ holder: s.possessor, possessor: s.holder, fact: s.fact }));
  // the shuffled-kind control: the induced kind records permuted among the beings (the multiset kept), the same rules and gates applied
  const kindRefs = [...K.kinds.keys()].sort(), sk = { precision: [], correct: [], fact_precision: [] }, skAssessable = roster.length >= 1 && roster.length < kindRefs.length;
  if (skAssessable) for (let d = 0; d < DRAWS; d++) { const perm = kindRefs.slice(); for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    const kindMap = new Map(kindRefs.map((r, i) => [r, K.kinds.get(perm[i])])); const m = metrics(withFacts(applyKind(K, { ...REGISTERED, kindMap })), unbound); sk.precision.push(m.precision ?? 0); sk.correct.push(m.correct); sk.fact_precision.push(m.fact_precision ?? 0); }
  const summary = (d) => ({ draws: d.length, mean: d.length ? d.reduce((a, b) => a + b, 0) / d.length : null, p95: d.length ? pct(d, 0.95) : null, p99: d.length ? pct(d, 0.99) : null, max: d.length ? Math.max(...d) : null });
  const controls = { seed: SEED, C1_chance_in_paragraph_pool: { precision: summary(c1.precision), recall: summary(c1.recall), fact_precision: summary(c1.fact_precision) }, C2_deranged: { precision: summary(c2.precision), recall: summary(c2.recall), fact_precision: summary(c2.fact_precision) },
    C1K_chance_among_person_kinds: { roster: roster.length, precision: summary(c1k.precision), recall: summary(c1k.recall), fact_precision: summary(c1k.fact_precision) }, C3_swapped_ends: metrics(swapped, unbound),
    SK_shuffled_kind: { assessable: skAssessable, precision: summary(sk.precision), correct_ends: summary(sk.correct), fact_precision: summary(sk.fact_precision) } };
  // ---- breakdowns, ceiling, polarity
  const byRule = {}, byGoldKind = {}, byGoldDirection = {}, gapReasons = {}, goldNull = {};
  for (const i of unbound) for (const end of END) {
    const b = kReal.statements[i][end], g = goldOf(i, end);
    if (b.ref) { const r = (byRule[b.rule] ??= { bound: 0, correct: 0, wrong_where_gold_has_no_referent: 0 }); r.bound++; if (b.ref === g.ref) r.correct++; else if (!g.ref) r.wrong_where_gold_has_no_referent++; }
    else { const r = (gapReasons[b.gap] ??= { gaps: 0, gold_bound: 0 }); r.gaps++; if (g.ref) r.gold_bound++; }
    if (g.ref) { const k = (byGoldKind[g.kind] ??= { gold_bound: 0, k_correct: 0, t2_correct: 0, s3_correct: 0 }); k.gold_bound++; if (b.ref === g.ref) k.k_correct++; if (arms.t2[i][end].ref === g.ref) k.t2_correct++; if (arms.s3[i][end].ref === g.ref) k.s3_correct++;
      const d = (byGoldDirection[g.direction] ??= { gold_bound: 0, k_correct: 0 }); d.gold_bound++; if (b.ref === g.ref) d.k_correct++; } else goldNull[g.why] = (goldNull[g.why] ?? 0) + 1;
  }
  const both = all.filter((i) => goldOf(i, "holder").ref && goldOf(i, "possessor").ref);
  const ceiling = { statements: all.length, gold_ends_bound: all.reduce((a, i) => a + END.filter((e) => goldOf(i, e).ref).length, 0), gold_ends: all.length * 2, both_ends_bound: both.length, both_ends_bound_no_forward_reference: both.filter((i) => END.every((e) => goldOf(i, e).direction !== "after")).length };
  const kindsReport = { beings: kindRefs.length, person: roster.length, by_store: Object.fromEntries(["name", "common", "unknown"].map((s) => [s, [...K.kinds.values()].filter((v) => v.store === s).length])), person_with_sex: roster.filter((r) => K.kinds.get(r).sex).length, anchored: [...K.kinds.values()].filter((v) => v.anchored).length,
    store_rows: { lemmas: kinRows.lemmas, with_a_node: kinRows.lemmas_with_a_node, coverage: kinRows.coverage_lemmas_with_a_row_of_type, converse_rows: kinRows.converse_rows, sex_rows: kinRows.sex_rows, generation_rows: kinRows.generation_rows }, kin_table: Object.values(K.table).reduce((m, r) => ((m[r.store] = (m[r.store] ?? 0) + 1), m), {}) };
  const polRead = kReal.statements.map((s) => s.polarity.read), goldPol = gold.statements.map((g) => g.polarity), nonAff = (x) => x !== "affirmed";
  const polarityReport = { gold_non_affirmed: goldPol.filter(nonAff).length, gold_by_polarity: goldPol.reduce((m, p) => ((m[p] = (m[p] ?? 0) + 1), m), {}), read_non_affirmed: polRead.filter(nonAff).length, read_non_affirmed_gold_non_affirmed: polRead.filter((r, i) => nonAff(r) && nonAff(goldPol[i])).length,
    gold_non_affirmed_read_non_affirmed: goldPol.filter((g, i) => nonAff(g) && nonAff(polRead[i])).length, facts_withheld: kReal.counts.facts_withheld_by_polarity, facts_k_vs_kp0: [kReal.counts.facts, kp0.counts.facts], facts_on_gold_non_affirmed: { k: kReal.statements.filter((s, i) => s.fact && nonAff(goldPol[i])).length, kp0: kp0.statements.filter((s, i) => s.fact && nonAff(goldPol[i])).length } };
  const integrity = { facts_checked: 0, witness_contains_term: 0, ends_inside_witness: 0, giver_standing_ok: 0, ends_are_ledger_beings: 0, statements: kReal.statements.length, gaps_typed: 0, statements_with_gap_match: 0 };
  for (const s of kReal.statements) {
    if (s.fact) { integrity.facts_checked++; const [a, b] = s.fact.witness.split("#")[1].split("-").map(Number);
      if (a <= s.termAt[0] && s.termAt[1] <= b && buf.subarray(a, b).toString("utf8").includes(buf.subarray(s.termAt[0], s.termAt[1]).toString("utf8"))) integrity.witness_contains_term++;
      if (END.every((e) => s[e].mention[0] >= a && s[e].mention[1] <= b)) integrity.ends_inside_witness++;
      if (/^text:ru\|rule:[A-Z0-9+-]+$/.test(s.fact.giver) && kReal.specs.every((x) => x.standing === "candidate")) integrity.giver_standing_ok++;
      if (END.every((e) => beings.has(s[e].ref))) integrity.ends_are_ledger_beings++; }
    if (s.gaps.length === END.filter((e) => !s[e].ref).length) integrity.statements_with_gap_match++;
    for (const g of s.gaps) if (Object.hasOwn(GAP_KINDS, g.kind) && KIND_REASONS.includes(g.why)) integrity.gaps_typed++;
  }
  integrity.total_gaps = kReal.statements.reduce((a, s) => a + s.gaps.length, 0);
  // ---- the bars; `unassessed` is a result, not a pass
  const mK = metrics(arms.k, unbound), mAllK = metrics(arms.k, all), mAllPlain = metrics(arms.plain, all);
  const nullP95 = (key) => Math.max(controls.C1_chance_in_paragraph_pool[key].p95, controls.C2_deranged[key].p95, controls.C1K_chance_among_person_kinds[key].p95);
  const bar = (id, name, pass, detail, assessable = true) => ({ id, name, result: !assessable ? "unassessed" : pass ? "pass" : "fail", ...detail });
  const bars = [
    bar("B1", "end precision beats all three chance controls and the declared budget (2 of 3)", mK.precision !== null && mK.precision > nullP95("precision") && mK.precision >= 2 / 3, { precision: mK.precision, null_p95: nullP95("precision"), budget: 2 / 3, bound: mK.bound }, mK.bound >= 10 && nullP95("precision") < 1),
    bar("B2", "more correct ends than the plain arm over all statements, and recall beats the person-kind chance control", mAllK.correct > mAllPlain.correct && mK.recall !== null && mK.recall > controls.C1K_chance_among_person_kinds.recall.p95, { model_correct_all: mAllK.correct, plain_correct_all: mAllPlain.correct, recall_unbound: mK.recall, null_p95: controls.C1K_chance_among_person_kinds.recall.p95, gold_bound_unbound: mK.gold_bound }, mK.gold_bound >= 10),
    bar("B3", "emitted facts: both ends right at least half the time and beyond all three nulls, and more correct two-ended facts than the plain arm", mK.fact_precision !== null && mK.fact_precision >= 0.5 && mK.fact_precision > nullP95("fact_precision") && mAllK.facts_correct > mAllPlain.facts_correct, { fact_precision: mK.fact_precision, facts: mK.facts, null_p95: nullP95("fact_precision"), correct_facts_all: mAllK.facts_correct, plain_correct_facts_all: mAllPlain.facts_correct }, mK.facts >= 3 && nullP95("fact_precision") < 1),
    bar("B4", "every emitted fact is witnessed (term and ends inside a byte span that reads back), has giver text:ru|rule:... and standing candidate, and ends that are ledger beings", integrity.facts_checked === integrity.witness_contains_term && integrity.facts_checked === integrity.ends_inside_witness && integrity.facts_checked === integrity.giver_standing_ok && integrity.facts_checked === integrity.ends_are_ledger_beings, { integrity }, integrity.facts_checked > 0),
    bar("B7", "every unbound end is a typed gap (kind of kinship.js, reason of the closed set), none silent", integrity.statements_with_gap_match === integrity.statements && integrity.gaps_typed === integrity.total_gaps, { integrity }),
    bar("B9", "mutant C3 (swapped ends) falls below the B1 precision threshold: the bar can fire", controls.C3_swapped_ends.precision === null || controls.C3_swapped_ends.precision < Math.max(nullP95("precision"), 2 / 3), { c3_precision: controls.C3_swapped_ends.precision, threshold: Math.max(nullP95("precision"), 2 / 3) }, controls.C3_swapped_ends.bound >= 3),
    bar("B10", "the shuffled-kind control: precision and correct ends exceed the control's p95 (the induced kind, not the rules alone, ties the ends)", skAssessable && mK.precision !== null && mK.precision > controls.SK_shuffled_kind.precision.p95 && mK.correct > controls.SK_shuffled_kind.correct_ends.p95, { precision: mK.precision, sk_precision_p95: controls.SK_shuffled_kind.precision.p95, correct: mK.correct, sk_correct_p95: controls.SK_shuffled_kind.correct_ends.p95 }, skAssessable && mK.bound >= 10),
    bar("B11", "polarity read: of the statements the gold calls not affirmed, at least half are read not affirmed and at least 2/3 of the not-affirmed readings are gold not affirmed; no fact on a gold not-affirmed statement", polarityReport.gold_non_affirmed >= 3 && polarityReport.gold_non_affirmed_read_non_affirmed / polarityReport.gold_non_affirmed >= 0.5 && polarityReport.read_non_affirmed > 0 && polarityReport.read_non_affirmed_gold_non_affirmed / polarityReport.read_non_affirmed >= 2 / 3 && polarityReport.facts_on_gold_non_affirmed.k === 0, polarityReport, polarityReport.gold_non_affirmed >= 3 && polarityReport.read_non_affirmed >= 3),
  ];
  return { schema: "KindKinScore@1", window: gold.window, gold: { holder: gold.holder, lens: gold.lens, opinion: gold.opinion, note: "every number below is measured against a self:model opinion (a model context that never saw the arm), not a giver" },
    text_sha256: crypto.createHash("sha256").update(buf).digest("hex"), params: PARAMS, registered: REGISTERED, statements: { total: all.length, unbound: unbound.length, plain_categories: extraction.stmts.reduce((m, s) => ((m[s.cat] = (m[s.cat] ?? 0) + 1), m), {}) },
    arms: Object.fromEntries(Object.keys(arms).map((k) => [k, { all: metrics(arms[k], all), unbound: metrics(arms[k], unbound) }])), controls, kinds: kindsReport, k_breakdown: { by_rule: byRule, by_gold_kind: byGoldKind, by_gold_direction: byGoldDirection, gap_reasons: gapReasons, gold_without_referent: goldNull }, ceiling, polarity: polarityReport, bars,
    binder: { k_counts: kReal.counts, kg0_counts: kg0.counts, kp0_counts: kp0.counts, s3_counts: s3.counts },
    statements_detail: kReal.statements.map((s) => ({ i: s.i, term: s.term, plain: s.plain, polarity: s.polarity.read, gold_polarity: gold.statements[s.i].polarity, holder: s.holder.ref ? { ref: s.holder.ref, rule: s.holder.rule } : { gap: s.holder.gap }, possessor: s.possessor.ref ? { ref: s.possessor.ref, rule: s.possessor.rule } : { gap: s.possessor.gap }, gold: { holder: gold.statements[s.i].holder.ref, possessor: gold.statements[s.i].possessor.ref }, fact: s.fact?.giver ?? null })),
    k_output_sha256: crypto.createHash("sha256").update(JSON.stringify(kReal)).digest("hex") };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
  const here = path.dirname(fileURLToPath(import.meta.url)), priors = loadPriors(arg("priors", path.join(here, "..", "..", "priors"))), j = (k) => JSON.parse(fs.readFileSync(arg(k), "utf8"));
  const text = fs.readFileSync(arg("text"), "utf8"), inputs = { text, ledger: j("ledger"), gold: j("gold"), priors, beingRows: j("beings"), polarity: j("polarity"), kinRows: j("kin-rows") };
  const a = JSON.stringify(score(inputs), null, 1), b = JSON.stringify(score(inputs), null, 1);
  const extraction = extract({ text, lang: "ru", lexicon: priors.lexicon, namePartsRu: priors.nameParts }), run = () => JSON.stringify(kindKin({ text, ledger: inputs.ledger, extraction, priors, beingRows: inputs.beingRows, polarity: inputs.polarity, kinRows: inputs.kinRows }, REGISTERED));
  const r1 = run(), r2 = run(), res = JSON.parse(a); res.determinism = { scorer_runs: 2, scorer_identical: a === b, scorer_sha256: crypto.createHash("sha256").update(a).digest("hex"), model_runs: 2, model_identical: r1 === r2, model_output_sha256: crypto.createHash("sha256").update(r1).digest("hex") };
  fs.writeFileSync(arg("out"), JSON.stringify(res, null, 1) + "\n");
  const f = (x) => (x === null || x === undefined ? "—" : x.toFixed(3)), A = res.arms;
  console.log(`unbound ${res.statements.unbound}/${res.statements.total}; T2 bound ${A.t2.unbound.bound} correct ${A.t2.unbound.correct}; S3 bound ${A.s3.unbound.bound} correct ${A.s3.unbound.correct} prec ${f(A.s3.unbound.precision)} facts ${A.s3.unbound.facts}/${A.s3.unbound.facts_correct}; K bound ${A.k.unbound.bound} correct ${A.k.unbound.correct} prec ${f(A.k.unbound.precision)} rec ${f(A.k.unbound.recall)} facts ${A.k.unbound.facts}/${A.k.unbound.gold_facts} right ${A.k.unbound.facts_correct}; KG0 prec ${f(A.kg0.unbound.precision)}`);
  console.log(`C1 p95 ${f(res.controls.C1_chance_in_paragraph_pool.precision.p95)}; C2 p95 ${f(res.controls.C2_deranged.precision.p95)}; C1K p95 ${f(res.controls.C1K_chance_among_person_kinds.precision.p95)}; C3 ${f(res.controls.C3_swapped_ends.precision)}; SK p95 ${f(res.controls.SK_shuffled_kind.precision.p95)}; determinism ${res.determinism.scorer_identical && res.determinism.model_identical}`);
  console.log(res.bars.map((x) => `${x.id}:${x.result}`).join("  "));
}
