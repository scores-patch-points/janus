// measure-kin.mjs — PREREG-G1-2: the real-text measurement (R1 to R6, G0). Plain arm; no model; the door is read-only.
//   node measure-kin.mjs --region dev|fresh --ru <text> --en <text> --lex <kin-lexicon.json> --np <name-parts-ru.json> --out <dir> [--door http://127.0.0.1:11450]
// Regions (registered): ru dev [0,43427) fresh [43427,end); en dev [0,36680) fresh [36680,end). The type table (which words are names) is computed
// over the whole text; only statements and mentions INSIDE the region become facts.
import fs from "node:fs";
import path from "node:path";
import { extract } from "./extract-kin.mjs";
import * as K from "../../native/organs/kinship.js";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const REGIONS = { ru: { dev: [0, 43427], fresh: [43427, Infinity] }, en: { dev: [0, 36680], fresh: [36680, Infinity] } };
const region = arg("region", "dev"), out = arg("out"), door = arg("door", "http://127.0.0.1:11450");
const lex = JSON.parse(fs.readFileSync(arg("lex"), "utf8")), np = JSON.parse(fs.readFileSync(arg("np"), "utf8"));
const rules = K.rulesFromLexicon(lex);
const SEED = 20261027, SHUFFLES = 1000, REDEAL = 200;
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pct = (xs, p) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))]; };
const foldRu = (s) => s.normalize("NFC").toLowerCase().replace(/́/g, "").replace(/ё/g, "е");
const foldEn = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const shuffle = (xs, rng) => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const results = { schema: "KinMeasure@1", region, seed: SEED, languages: {} };
fs.mkdirSync(out, { recursive: true });

for (const lang of ["ru", "en"]) {
  const file = arg(lang), buf = fs.readFileSync(file), text = buf.toString("utf8"), fold = lang === "ru" ? foldRu : foldEn;
  const [from, toRaw] = REGIONS[lang][region], to = Math.min(toRaw, text.length);
  const ex = extract({ text, lang, lexicon: lex, namePartsRu: np, from, to });
  const L = { text_sha256: ex.text_sha256, region: [from, to], extract: ex.counts, policies: {} };
  const cat = {}, byTerm = {};
  for (const s of ex.stmts) { cat[s.cat] = (cat[s.cat] ?? 0) + 1; (byTerm[s.en] ??= { A: 0, P: 0, H: 0, N: 0 })[s.cat]++; }
  L.statements = { total: ex.stmts.length, byCategory: cat, byTerm };
  const patroGaps = {}; let patroResolved = 0, patroAmbiguous = 0;
  for (const p of ex.patro) { if (p.father) { patroResolved++; if (p.ambiguous) patroAmbiguous++; } else patroGaps[p.fatherGap] = (patroGaps[p.fatherGap] ?? 0) + 1; }
  L.patronymic = { mentions: ex.patro.length, fatherResolved: patroResolved, fatherAmbiguous: patroAmbiguous, gaps: patroGaps };
  const bytesOf = (a, b) => buf.subarray(a, b).toString("utf8");
  for (const policy of ["K3", "K2"]) {
    const key = (o) => (policy === "K3" ? o.k3 : o.k2);
    const specs = [], origin = [];
    const add = (spec, o) => { specs.push(spec); origin.push(o); };
    ex.stmts.forEach((s, i) => {
      if (s.cat !== "A") return;
      const h = key(s.holder), p = key(s.possessor), w = `${lang}#${s.span[0]}-${s.span[1]}`, giver = `text:${lang}`;
      if (s.kind === "atom") {
        const at = lex.atoms[s.en]; if (!at) return;
        if (at.rel === "parent_of") add(at.end === "a" ? { rel: "parent_of", a: h, b: p, giver, witness: w } : { rel: "parent_of", a: p, b: h, giver, witness: w }, { kind: "stmt", i });
        else add({ rel: at.rel, a: h, b: p, giver, witness: w }, { kind: "stmt", i });
        if (at.sex) add({ rel: "sex", a: h, value: at.sex, giver, witness: w }, { kind: "stmt", i });
      } else add({ rel: "term", term: s.en, a: h, b: p, giver, witness: w }, { kind: "stmt", i });
    });
    ex.patro.forEach((pt, i) => {
      const w = `${lang}#${pt.span[0]}-${pt.span[1]}`, child = key(pt.child), fa = policy === "K3" ? pt.fatherK3 : pt.fatherK2;
      add({ rel: "sex", a: child, value: pt.sex, giver: "name-parts-ru", witness: w, standing: "candidate" }, { kind: "patro", i });
      if (fa) add({ rel: "parent_of", a: fa, b: child, giver: "name-parts-ru", witness: w, standing: "candidate" }, { kind: "patro", i });
    });
    const base = K.factBase(specs);
    const P = { facts: base.facts.length, specs: specs.length, refused: {}, factsByRelGiver: {} };
    for (const r of base.refused) P.refused[r.reason] = (P.refused[r.reason] ?? 0) + 1;
    for (const f of base.facts) { const k = `${f.rel}${f.term ? ":" + f.term : ""} | ${f.giver}`; P.factsByRelGiver[k] = (P.factsByRelGiver[k] ?? 0) + 1; }
    // R1: read each accepted fact's witness back by byte address
    let r1ok = 0, r1n = 0; const r1bad = [];
    specs.forEach((sp, idx) => {
      if (!K.makeFact(sp).fact) return; r1n++;
      const o = origin[idx], [a, b] = sp.witness.split("#")[1].split("-").map(Number), span = fold(bytesOf(a, b));
      let ok;
      if (o.kind === "stmt") { const s = ex.stmts[o.i]; ok = span.includes(fold(bytesOf(s.termAt[0], s.termAt[1]))) && span.includes(s.holder.given) && span.includes(s.possessor.given); }
      else { const pt = ex.patro[o.i]; ok = span.includes(pt.child.given) && /(ович|евич|ич|овн|евн|ичн|ovich|evich|ich|ovn|evn|ichn)/.test(span); }
      if (ok) r1ok++; else if (r1bad.length < 5) r1bad.push({ spec: sp, span });
    });
    P.R1 = { checked: r1n, ok: r1ok, bad: r1n - r1ok, examples: r1bad };
    // questions: uncle(X) for every person key
    const persons = new Set(); for (const f of base.facts) { persons.add(f.a); if (f.b) persons.add(f.b); }
    const run = (factSpecs) => {
      const b = K.factBase(factSpecs), answers = new Map();
      const t = { questions: 0, answered: 0, gap: 0, gapAllFillable: 0, gapNotFillable: 0, byGapKind: {}, firstGapKind: {}, steps: 0, stepsWithoutGiver: 0, answeredWithCandidateStep: 0 };
      for (const X of persons) {
        const a = K.deriveKin({ term: "uncle", of: X }, { base: b, rules }); t.questions++;
        for (const g of a.gaps) t.byGapKind[g.kind] = (t.byGapKind[g.kind] ?? 0) + 1;
        if (a.state === "answered") {
          t.answered++; answers.set(X, a);
          for (const it of a.items) for (const d of it.derivations) for (const s of d.steps) { t.steps++; if (!s.giver) t.stepsWithoutGiver++; }
          if (a.items.some((it) => it.derivations.some((d) => d.standing === "candidate"))) t.answeredWithCandidateStep++;
        } else {
          t.gap++; if (a.gaps.every((g) => g.opinionFillable)) t.gapAllFillable++; else t.gapNotFillable++;
          const k = a.gaps[0]?.kind ?? "NONE"; t.firstGapKind[k] = (t.firstGapKind[k] ?? 0) + 1;
        }
      }
      return { tally: t, answers };
    };
    const real = run(specs);
    P.persons = persons.size; P.R5 = real.tally; P.R2 = { steps: real.tally.steps, stepsWithoutGiver: real.tally.stepsWithoutGiver };
    // the premise funnel
    const par = new Map(), kids = new Map(), sibE = new Map(), sexOf = new Map();
    for (const f of base.facts) {
      if (f.rel === "parent_of") { (par.get(f.b) ?? par.set(f.b, new Set()).get(f.b)).add(f.a); (kids.get(f.a) ?? kids.set(f.a, new Set()).get(f.a)).add(f.b); }
      else if (f.rel === "sibling_of") { (sibE.get(f.a) ?? sibE.set(f.a, new Set()).get(f.a)).add(f.b); (sibE.get(f.b) ?? sibE.set(f.b, new Set()).get(f.b)).add(f.a); }
      else if (f.rel === "sex") sexOf.set(f.a, f.value);
    }
    const sibsOf = (m) => { const s = new Set(sibE.get(m) ?? []); for (const p of par.get(m) ?? []) for (const c of kids.get(p) ?? []) if (c !== m) s.add(c); return s; };
    let withParent = 0, parentWithSibling = 0, withMaleSibling = 0;
    for (const X of persons) { const ps = [...(par.get(X) ?? [])]; if (!ps.length) continue; withParent++; if (ps.some((m) => sibsOf(m).size)) parentWithSibling++; if (ps.some((m) => [...sibsOf(m)].some((u) => sexOf.get(u) === "male"))) withMaleSibling++; }
    P.funnel = { persons: persons.size, withParentFact: withParent, withParentThatHasSibling: parentWithSibling, withConfirmedMaleSiblingOfParent: withMaleSibling, answered: real.tally.answered };
    P.answeredExamples = [...real.answers.entries()].slice(0, 15).map(([X, a]) => ({ X, uncles: a.items.map((i) => i.who), steps: a.items[0].derivations[0].steps.map((s) => ({ kind: s.kind, rule: s.rule, rel: s.rel, a: s.a, b: s.b, value: s.value, giver: s.giver, witness: s.witness,
      text: s.kind === "fact" && !s.giver.startsWith("wiktionary") ? bytesOf(...s.witness.split("#")[1].split("-").map(Number)).slice(0, 160) : undefined })) }));
    // R3: inter-giver agreement (patronymic father vs a text-stated parent whose sex is stated male)
    const patroFather = new Map(), textParents = new Map();
    for (const f of base.facts) if (f.rel === "parent_of") { if (f.giver === "name-parts-ru") patroFather.set(f.b, f.a); else (textParents.get(f.b) ?? textParents.set(f.b, new Set()).get(f.b)).add(f.a); }
    const maleText = (c) => [...(textParents.get(c) ?? [])].filter((a) => sexOf.get(a) === "male");
    const pairs = [...patroFather.keys()].filter((c) => maleText(c).length);
    const agree = (fathers) => pairs.filter((c, i) => maleText(c).includes(fathers[i])).length / (pairs.length || 1);
    const obs3 = pairs.length ? agree(pairs.map((c) => patroFather.get(c))) : null;
    const rng3 = mulberry32(SEED), nulls3 = [];
    for (let s = 0; s < SHUFFLES && pairs.length; s++) nulls3.push(agree(shuffle(pairs.map((c) => patroFather.get(c)), rng3)));
    const p95 = nulls3.length ? pct(nulls3, 0.95) : null;
    P.R3 = { n: pairs.length, observed: obs3, nullP95: p95, status: !pairs.length ? "unassessed (n=0)" : p95 >= 1 ? "unassessed (null cannot separate)" : (obs3 > p95 ? "pass" : "fail") };
    // R4: sex consistency (A-statements with a sex-bearing atom whose holder key also has a patronymic-derived sex)
    const patroSex = new Map(); for (const f of base.facts) if (f.rel === "sex" && f.giver === "name-parts-ru") patroSex.set(f.a, f.value);
    const sts = []; ex.stmts.forEach((s) => { if (s.cat === "A" && s.kind === "atom" && lex.atoms[s.en]?.sex && patroSex.has(key(s.holder))) sts.push({ kin: lex.atoms[s.en].sex, pat: patroSex.get(key(s.holder)) }); });
    const rate = (kins) => sts.filter((s, i) => s.pat !== kins[i]).length / (sts.length || 1);
    const obs4 = sts.length ? rate(sts.map((s) => s.kin)) : null, nulls4 = [], rng4 = mulberry32(SEED + 4);
    for (let s = 0; s < SHUFFLES && sts.length; s++) nulls4.push(rate(shuffle(sts.map((x) => x.kin), rng4)));
    const p5 = nulls4.length ? pct(nulls4, 0.05) : null;
    P.R4 = { n: sts.length, observedContradiction: obs4, nullP5: p5, status: !sts.length ? "unassessed (n=0)" : p5 <= 0 ? "unassessed (null cannot separate)" : (obs4 < p5 ? "pass" : "fail") };
    // R6: redeal on the real facts (assessed only when it can fire)
    if (real.tally.answered < 1) P.R6 = { status: "control_not_exercised", realAnswered: 0 };
    else {
      const realPairs = new Set([...real.answers.entries()].flatMap(([X, a]) => a.items.map((i) => `${X}|${i.who}`)));
      const parS = specs.filter((s) => s.rel === "parent_of"), rest = specs.filter((s) => s.rel !== "parent_of"), rngR = mulberry32(SEED + 6); let maxOverlap = 0, reproduced = 0;
      for (let t = 0; t < REDEAL; t++) {
        const bs = shuffle(parS.map((s) => s.b), rngR);
        const sh = run([...rest, ...parS.map((s, i) => ({ ...s, b: bs[i] === s.a ? s.b : bs[i] }))]);
        const sp = new Set([...sh.answers.entries()].flatMap(([X, a]) => a.items.map((i) => `${X}|${i.who}`)));
        const ov = [...realPairs].filter((x) => sp.has(x)).length / realPairs.size; maxOverlap = Math.max(maxOverlap, ov); if (ov === 1) reproduced++;
      }
      P.R6 = { status: reproduced === 0 ? "pass" : "fail", realPairs: realPairs.size, shuffles: REDEAL, shufflesReproducingAllRealPairs: reproduced, maxOverlap };
    }
    L.policies[policy] = P;
  }
  results.languages[lang] = L;
}

// G0: what the givers themselves state (read-only asks to the door)
async function ask(body, tries = 4) {
  for (let t = 1; ; t++) {
    try { const r = await fetch(`${door}/v1/ask`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); return await r.json(); }
    catch (e) { if (t >= tries) throw e; await new Promise((res) => setTimeout(res, 1500 * t)); }
  }
}
try {
  let head; for (let t = 1; ; t++) { try { head = await (await fetch(`${door}/v1/hyperlexicon`)).json(); break; } catch (e) { if (t >= 4) throw e; await new Promise((res) => setTimeout(res, 1500 * t)); } }
  const G0 = { head: head.head, kinLemmas: {}, relationsByTypeGiver: {}, linksAmongKinLemmas: 0, kinLemmaNodes: 0, relRowsFromKinLemmas: 0, personNames: {} };
  const sets = { ru: [...new Set(Object.values(lex.russian_forms))], en: [...Object.keys(lex.atoms), ...Object.keys(lex.composites).filter((t) => /^[a-z]+$/.test(t))] };
  const nodeOf = new Map();
  for (const [lg, words] of Object.entries(sets)) {
    const r = await ask({ op: "names", surfaces: words, lang: lg });
    for (const w of words) for (const h of r.surfaces?.[w]?.written ?? []) if (h.kind === "lemma") nodeOf.set(h.node, `${lg}:${w}`);
  }
  G0.kinLemmaNodes = nodeOf.size;
  for (const [id, label] of nodeOf) {
    const r = await ask({ op: "relations", id }), rows = r.relations ?? [];
    G0.kinLemmas[label] = rows.length; G0.relRowsFromKinLemmas += rows.length;
    for (const row of rows) { const k = `${row.rel} | ${row.giver}`; G0.relationsByTypeGiver[k] = (G0.relationsByTypeGiver[k] ?? 0) + 1; if (nodeOf.has(row.to)) G0.linksAmongKinLemmas++; }
  }
  const ruText = fs.readFileSync(arg("ru"), "utf8"), namesFreq = new Map();
  const exr = extract({ text: ruText, lang: "ru", lexicon: lex, namePartsRu: np, from: REGIONS.ru[region][0], to: Math.min(REGIONS.ru[region][1], ruText.length) });
  for (const s of exr.stmts) for (const o of [s.holder, s.possessor]) if (o) namesFreq.set(o.k2, (namesFreq.get(o.k2) ?? 0) + 1);
  for (const pt of exr.patro) namesFreq.set(pt.child.k2, (namesFreq.get(pt.child.k2) ?? 0) + 1);
  const top = [...namesFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 200).map(([k]) => k);
  const nm = await ask({ op: "names", surfaces: top, lang: "ru" });
  let withNode = 0, withRows = 0, rowsTotal = 0; const typeSeen = {};
  for (const k of top) {
    const hs = nm.surfaces?.[k]?.written ?? []; if (hs.length) withNode++;
    let rows = 0;
    for (const h of hs) { const r = await ask({ op: "relations", id: h.node }); for (const row of r.relations ?? []) { rows++; const t = `${row.rel} | ${row.giver}`; typeSeen[t] = (typeSeen[t] ?? 0) + 1; } }
    if (rows) withRows++; rowsTotal += rows;
  }
  G0.personNames = { asked: top.length, withAGiverNode: withNode, withAnyRelationRow: withRows, relationRows: rowsTotal, rowsByTypeGiver: typeSeen,
    note: "the store's relation types are syn, derived, coord, ant, hyper, hypo, holo, mero (manifest): none is a kinship relation between persons" };
  results.G0 = G0;
} catch (e) { results.G0 = { gap: "door_unreachable", detail: String(e.message ?? e) }; }

fs.writeFileSync(path.join(out, `results-${region}.json`), JSON.stringify(results, null, 1));
const brief = (P) => `${P.facts} facts, ${P.persons} persons; Q ${P.R5.questions}: answered ${P.R5.answered}, gap ${P.R5.gap} (all fillable ${P.R5.gapAllFillable}, not ${P.R5.gapNotFillable}); R1 ${P.R1.ok}/${P.R1.checked}; R2 steps ${P.R2.steps} w/o giver ${P.R2.stepsWithoutGiver}; R3 ${P.R3.status} n=${P.R3.n}; R4 ${P.R4.status} n=${P.R4.n}; R6 ${P.R6.status}`;
for (const lang of ["ru", "en"]) for (const p of ["K3", "K2"]) console.log(region, lang, p, brief(results.languages[lang].policies[p]));
