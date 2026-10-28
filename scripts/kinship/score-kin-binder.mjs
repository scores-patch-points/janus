// score-kin-binder.mjs — PREREG-KIN-BINDER: score the kin binder against the labeller's gold (a self:model opinion), beside the plain arm and the shuffled-ends controls. Deterministic, no model.
//   node score-kin-binder.mjs --text <text> --ledger <KinLedger.json> --gold <gold.json> --out <results.json> [--fold <fold.json>]
// Arms: PLAIN (the extractor's category A statements tied to the ledger exactly as the foldcode build does: the name that ends nearest before the kin word, the name that begins nearest after it),
//       T1 (the binder, tier 1), T2 (the binder, tier 2 = the registered binder), and the controls: C1 chance-in-pool (the ends T2 binds, drawn uniformly from the beings named in the statement's
//       paragraph or the one before), C2 deranged ends (T2's referents permuted among the bound ends of the same kind), C3 swapped ends (T2's holder and possessor exchanged). Seeded (mulberry32, 20261027).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extract } from "./extract-kin.mjs";
import { bindKin, loadPriors, REASONS } from "./bind-kin.mjs";
import { GAP_KINDS } from "../../native/organs/kinship.js";

export const SEED = 20261027, DRAWS = 1000;
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pct = (xs, p) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))]; };
const ratio = (a, b) => (b ? a / b : null);
const END = ["holder", "possessor"];

/** The whole scoring over one window; pure (same inputs, same output). */
export function score({ text, ledger, gold, priors, fold = null }) {
  const buf = Buffer.from(text);
  const extraction = extract({ text, lang: "ru", lexicon: priors.lexicon, namePartsRu: priors.nameParts });
  const beings = new Set(ledger.referents.filter((r) => r.standing === "referent").map((r) => r.id));
  const nameSpans = ledger.spans.filter((s) => s.kind === "name" && s.ref && beings.has(s.ref));
  if (gold.statements.length !== extraction.stmts.length) throw new Error(`gold has ${gold.statements.length} statements, the extractor ${extraction.stmts.length}`);
  extraction.stmts.forEach((s, i) => { if (JSON.stringify(gold.statements[i].termSpan) !== JSON.stringify(s.span) || gold.statements[i].term !== s.en) throw new Error(`gold statement ${i} is not the extractor's statement ${i}`); });
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
  if (fold) { const fa = new Set(fold.kin.facts.filter((f) => f.giver === "text:ru" && f.rel !== "sex").map((f) => `${f.rel}|${f.a}|${f.b}`)); const mine = new Set(); extraction.stmts.forEach((s, i) => { if (plain[i].holder.ref) { const at = priors.lexicon.atoms[s.en]; const h = plain[i].holder.ref, p = plain[i].possessor.ref; mine.add(at.rel === "parent_of" ? (at.end === "a" ? `parent_of|${h}|${p}` : `parent_of|${p}|${h}`) : `${at.rel}|${h}|${p}`); } });
    plain.crosscheck = { fold_text_facts: fa.size, mine: mine.size, equal: fa.size === mine.size && [...fa].every((x) => mine.has(x)) }; }
  // ---- the binder arms
  const t1 = bindKin({ text, ledger, extraction, priors, tier: 1 }), t2 = bindKin({ text, ledger, extraction, priors, tier: 2 });
  // ---- candidate pools for the chance control: beings named in the statement's paragraph or the one before
  const lines = text.split("\n"), lineStart = []; { let p = 0; for (const l of lines) { lineStart.push(p); p += l.length + 1; } }
  const pn = []; { let n = -1; for (const l of lines) { if (l.trim()) n++; pn.push(n); } }
  const lineOfChar = (c) => { let lo = 0, hi = lineStart.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (lineStart[m] <= c) lo = m; else hi = m - 1; } return lo; };
  const charOfByte = (b) => buf.subarray(0, b).toString("utf8").length;
  const refsByPnum = new Map(); for (const sp of nameSpans) { const k = pn[lineOfChar(sp.at[0])]; (refsByPnum.get(k) ?? refsByPnum.set(k, new Set()).get(k)).add(sp.ref); }
  const pool = extraction.stmts.map((s) => { const k = pn[lineOfChar(charOfByte(s.termAt[0]))]; return [...new Set([...(refsByPnum.get(k - 1) ?? []), ...(refsByPnum.get(k) ?? [])])].sort(); });
  // ---- scoring of one arm (an array of {holder:{ref}, possessor:{ref}} by statement), over a subset of statements
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
  const asArm = (b) => b.statements.map((s) => ({ holder: s.holder, possessor: s.possessor }));
  const arms = { plain, t1: asArm(t1), t2: asArm(t2) };
  // ---- controls (over the statements the registered binder binds, so coverage is the same)
  const rng = mulberry32(SEED), t2arm = arms.t2;
  const boundEnds = []; for (const i of unbound) for (const end of END) if (t2arm[i][end].ref) boundEnds.push({ i, end });
  const dist = (build) => { const out = { precision: [], recall: [], fact_precision: [] }; for (let d = 0; d < DRAWS; d++) { const arm = build(); const m = metrics(arm, unbound); out.precision.push(m.precision ?? 0); out.recall.push(m.recall ?? 0); out.fact_precision.push(m.fact_precision ?? 0); } return out; };
  const empty = () => all.map(() => ({ holder: { ref: null }, possessor: { ref: null } }));
  const c1 = dist(() => { const arm = empty(); for (const { i, end } of boundEnds) { const P = pool[i]; if (!P.length) continue; const ref = P[Math.floor(rng() * P.length)]; if (end === "possessor" && arm[i].holder.ref === ref) continue; arm[i][end] = { ref }; } return arm; });
  const c2 = dist(() => { const arm = empty(); for (const end of END) { const mine = boundEnds.filter((x) => x.end === end); const refs = mine.map((x) => t2arm[x.i][end].ref); for (let k = refs.length - 1; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [refs[k], refs[j]] = [refs[j], refs[k]]; } mine.forEach((x, k) => { arm[x.i][end] = { ref: refs[k] }; }); } return arm; });
  const swapped = t2arm.map((s) => ({ holder: s.possessor, possessor: s.holder }));
  const summary = (d) => ({ draws: DRAWS, mean: d.length ? d.reduce((a, b) => a + b, 0) / d.length : null, p95: pct(d, 0.95), p99: pct(d, 0.99), max: Math.max(...d) });
  const controls = { seed: SEED, C1_chance_in_pool: { precision: summary(c1.precision), recall: summary(c1.recall), fact_precision: summary(c1.fact_precision) }, C2_deranged: { precision: summary(c2.precision), recall: summary(c2.recall), fact_precision: summary(c2.fact_precision) }, C3_swapped_ends: metrics(swapped, unbound) };
  // ---- breakdowns for T2 over the unbound statements
  const byRule = {}, byGoldKind = {}, gapReasons = {}, goldNull = {};
  for (const i of unbound) for (const end of END) {
    const b = t2.statements[i][end], g = goldOf(i, end);
    if (b.ref) { const r = (byRule[b.rule] ??= { bound: 0, correct: 0 }); r.bound++; if (b.ref === g.ref) r.correct++; }
    else { const r = (gapReasons[b.gap] ??= { gaps: 0, gold_bound: 0 }); r.gaps++; if (g.ref) r.gold_bound++; }
    if (g.ref) { const k = (byGoldKind[g.kind] ??= { gold_bound: 0, t1_correct: 0, t2_correct: 0 }); k.gold_bound++; if (t1.statements[i][end].ref === g.ref) k.t1_correct++; if (b.ref === g.ref) k.t2_correct++; }
    else goldNull[g.why] = (goldNull[g.why] ?? 0) + 1;
  }
  // ---- integrity checks (B4, B7) over every emitted fact and every statement of T2
  const integrity = { facts_checked: 0, witness_contains_term: 0, ends_inside_witness: 0, giver_standing_ok: 0, ends_are_ledger_beings: 0, statements: t2.statements.length, gaps_typed: 0, statements_with_gap_match: 0 };
  for (const s of t2.statements) {
    if (s.fact) { integrity.facts_checked++; const [a, b] = s.fact.witness.split("#")[1].split("-").map(Number);
      if (a <= s.termAt[0] && s.termAt[1] <= b && buf.subarray(a, b).toString("utf8").includes(buf.subarray(s.termAt[0], s.termAt[1]).toString("utf8"))) integrity.witness_contains_term++;
      if (END.every((e) => s[e].mention[0] >= a && s[e].mention[1] <= b)) integrity.ends_inside_witness++;
      if (/^text:ru\|rule:[A-Z0-9+-]+$/.test(s.fact.giver) && t2.specs.every((x) => x.standing === "candidate")) integrity.giver_standing_ok++;
      if (END.every((e) => beings.has(s[e].ref))) integrity.ends_are_ledger_beings++; }
    const unboundEnds = END.filter((e) => !s[e].ref).length;
    if (s.gaps.length === unboundEnds) integrity.statements_with_gap_match++;
    for (const g of s.gaps) if (Object.hasOwn(GAP_KINDS, g.kind) && REASONS.includes(g.why)) integrity.gaps_typed++;
  }
  integrity.total_gaps = t2.statements.reduce((a, s) => a + s.gaps.length, 0);
  // ---- the bars (PREREG-KIN-BINDER section 4); `unassessed` is a result, not a pass
  const m2 = metrics(arms.t2, unbound), mAll2 = metrics(arms.t2, all), mAllPlain = metrics(arms.plain, all);
  const nullP95 = (k) => Math.max(controls.C1_chance_in_pool[k].p95, controls.C2_deranged[k].p95);
  const bar = (id, name, pass, detail, assessable = true) => ({ id, name, result: !assessable ? "unassessed" : pass ? "pass" : "fail", ...detail });
  const bars = [
    bar("B1", "end precision beats both nulls and the declared budget (2 of 3)", m2.precision !== null && m2.precision > nullP95("precision") && m2.precision >= 2 / 3, { precision: m2.precision, null_p95: nullP95("precision"), budget: 2 / 3, bound: m2.bound }, m2.bound >= 10 && nullP95("precision") < 1),
    bar("B2", "binder ties more correct ends than the plain arm, and its recall beats the chance null", mAll2.correct > mAllPlain.correct && m2.recall !== null && m2.recall > controls.C1_chance_in_pool.recall.p95, { binder_correct_all: mAll2.correct, plain_correct_all: mAllPlain.correct, recall_unbound: m2.recall, null_p95: controls.C1_chance_in_pool.recall.p95, gold_bound_unbound: m2.gold_bound }, m2.gold_bound >= 10),
    bar("B3", "emitted facts: both ends right at least half the time and beyond both nulls", m2.fact_precision !== null && m2.fact_precision >= 0.5 && m2.fact_precision > nullP95("fact_precision"), { fact_precision: m2.fact_precision, facts: m2.facts, null_p95: nullP95("fact_precision") }, m2.facts >= 3 && nullP95("fact_precision") < 1),
    bar("B4", "every emitted fact is witnessed (term and ends inside a byte span that reads back), has giver text:ru|rule:... and standing candidate, and ends that are ledger beings", integrity.facts_checked === integrity.witness_contains_term && integrity.facts_checked === integrity.ends_inside_witness && integrity.facts_checked === integrity.giver_standing_ok && integrity.facts_checked === integrity.ends_are_ledger_beings, { integrity }, integrity.facts_checked > 0),
    bar("B7", "every unbound end is a typed gap (kind of kinship.js, reason of the binder), none silent", integrity.statements_with_gap_match === integrity.statements && integrity.gaps_typed === integrity.total_gaps, { integrity }),
    bar("B9a", "mutant C3 (swapped ends) falls below the B1 precision threshold: the bar can fire", controls.C3_swapped_ends.precision === null || controls.C3_swapped_ends.precision < Math.max(nullP95("precision"), 2 / 3), { c3_precision: controls.C3_swapped_ends.precision, threshold: Math.max(nullP95("precision"), 2 / 3) }, controls.C3_swapped_ends.bound >= 3),
  ];
  const result = { schema: "KinBinderScore@1", window: gold.window, gold: { holder: gold.holder, lens: gold.lens, opinion: gold.opinion, note: "every number below is measured against a self:model opinion (the labeller is the binder's author), not a giver" },
    text_sha256: crypto.createHash("sha256").update(buf).digest("hex"), statements: { total: all.length, unbound: unbound.length, plain_categories: extraction.stmts.reduce((m, s) => ((m[s.cat] = (m[s.cat] ?? 0) + 1), m), {}) },
    arms: { plain: { all: metrics(arms.plain, all), unbound: metrics(arms.plain, unbound), ...(plain.crosscheck ? { crosscheck_with_fold: plain.crosscheck } : {}) }, t1: { all: metrics(arms.t1, all), unbound: metrics(arms.t1, unbound) }, t2: { all: mAll2, unbound: m2 } },
    controls, t2_breakdown: { by_rule: byRule, by_gold_kind: byGoldKind, gap_reasons: gapReasons, gold_without_referent: goldNull },
    bars, binder: { t2_counts: t2.counts, t1_counts: t1.counts },
    statements_detail: t2.statements.map((s) => ({ i: s.i, term: s.term, plain: s.plain, holder: s.holder.ref ? { ref: s.holder.ref, rule: s.holder.rule } : { gap: s.holder.gap }, possessor: s.possessor.ref ? { ref: s.possessor.ref, rule: s.possessor.rule } : { gap: s.possessor.gap }, gold: { holder: gold.statements[s.i].holder.ref, possessor: gold.statements[s.i].possessor.ref }, fact: s.fact?.giver ?? null })),
    t2_output_sha256: crypto.createHash("sha256").update(JSON.stringify(t2)).digest("hex") };
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
  const here = path.dirname(fileURLToPath(import.meta.url)), priors = loadPriors(arg("priors", path.join(here, "..", "..", "priors")));
  const text = fs.readFileSync(arg("text"), "utf8"), ledger = JSON.parse(fs.readFileSync(arg("ledger"), "utf8")), gold = JSON.parse(fs.readFileSync(arg("gold"), "utf8")), fold = arg("fold") ? JSON.parse(fs.readFileSync(arg("fold"), "utf8")) : null;
  const a = JSON.stringify(score({ text, ledger, gold, priors, fold }), null, 1), b = JSON.stringify(score({ text, ledger, gold, priors, fold }), null, 1);
  const res = JSON.parse(a); res.determinism = { runs: 2, identical: a === b, sha256: crypto.createHash("sha256").update(a).digest("hex") };
  fs.writeFileSync(arg("out"), JSON.stringify(res, null, 1) + "\n");
  const m = res.arms; const f = (x) => (x === null ? "—" : x.toFixed(3));
  console.log(`unbound ${res.statements.unbound}/${res.statements.total}; plain bound ${m.plain.unbound.bound}; T1 prec ${f(m.t1.unbound.precision)} rec ${f(m.t1.unbound.recall)}; T2 bound ${m.t2.unbound.bound} correct ${m.t2.unbound.correct} prec ${f(m.t2.unbound.precision)} rec ${f(m.t2.unbound.recall)} facts ${m.t2.unbound.facts}/${m.t2.unbound.gold_facts}`);
  console.log(`C1 prec p95 ${f(res.controls.C1_chance_in_pool.precision.p95)} rec p95 ${f(res.controls.C1_chance_in_pool.recall.p95)}; C2 prec p95 ${f(res.controls.C2_deranged.precision.p95)}; C3 prec ${f(res.controls.C3_swapped_ends.precision)}; determinism ${res.determinism.identical}`);
  console.log(res.bars.map((x) => `${x.id}:${x.result}`).join("  "));
}
