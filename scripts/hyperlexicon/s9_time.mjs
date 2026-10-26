// s9_time.mjs — S9: the time vocabulary, FOUND in the givers and not typed (S9-TIME-PREREG.md, frozen before this stage existed).
//
// Giver A, the Wiktionary slim pack: concepts are located by what its English glosses say (a month of the Gregorian calendar, a day of the week,
// ordered by the neighbours the glosses name), and their forms are its translation pairs. Giver B, CLDR through the runtime's ICU (Intl): the
// same concepts as it names them. Every form is a CANDIDATE: a giver's claim licenses nothing until use earns it, and S9 reads no corpus.
// No month name, weekday name or ordinal word is typed here; gate B6 checks that against what the run finds.
//
//   node s9_time.mjs [--land] [--prior <path>] [--result <path stem>]
//     --land   write priors/time-prior.json and its manifest entry, but ONLY if every bar holds
//   env: WIKTIONARY_PACK (default: newest ~/.cache/live_priors/wiktionary/wiktionary-slim-*.pack), WIKTIONARY_READER (Zenodotus lookup.mjs)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "..", "..");
const argv = process.argv.slice(2), has = (n) => argv.includes(`--${n}`), opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const PRIOR = path.resolve(opt("prior", path.join(ROOT, "priors", "time-prior.json")));
const RESULT = path.resolve(opt("result", path.join(HERE, "S9-TIME-RESULT")));

// REC-1 (S9-TIME-PREREG.md, Amendment 2): the classes that land. Relative terms failed B3 as registered and are measured, not landed.
const LANDED = ["month", "weekday"];

// ── the givers' locations ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const PACK_DIR = path.join(os.homedir(), ".cache", "live_priors", "wiktionary"), PACK_NAME = /^wiktionary-slim-(\d{4}-\d{2}-\d{2})(?:-v(\d+))?\.pack$/;
const packPath = () => {
  if (process.env.WIKTIONARY_PACK) return process.env.WIKTIONARY_PACK;
  const best = fs.readdirSync(PACK_DIR).map((f) => f.match(PACK_NAME)).filter(Boolean).sort((a, b) => a[1].localeCompare(b[1]) || Number(a[2] || 1) - Number(b[2] || 1)).pop();
  if (!best) throw new Error("no Wiktionary slim pack");
  return path.join(PACK_DIR, best[0]);
};
const readerPath = () => process.env.WIKTIONARY_READER ?? [path.join(ROOT, "..", "Zenodotus"), path.join(os.homedir(), "Zenodotus")].map((r) => path.join(r, "scripts", "wiktionary", "lookup.mjs")).find(fs.existsSync);

// ── normalization: janus's own (common.py), so a form here joins a corpus type there ────────────────────────────────────────────────────────
const STRIP = new Set([...fs.readFileSync(path.join(HERE, "common.py"), "utf8").match(/STRIP_LANGS\s*=\s*\{([^}]*)\}/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));
const norm = (lang, s) => {
  let t = String(s).normalize("NFKC").toLowerCase();
  if (STRIP.has(lang.split("-")[0])) t = t.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
  return t.replace(/[\s'’`.·-]/g, "");
};
const unlink = (s) => String(s).replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1").replace(/[[\]]/g, "").trim();   // Amendments 1 and 2(c): a wiki link's text is kept, its markup (and any bracket a truncated link leaves) is not
const canon = (code) => { try { return Intl.getCanonicalLocales(code)[0]; } catch { return code; } };
const supported = (lang) => { try { return Intl.DateTimeFormat.supportedLocalesOf([`${lang}-u-ca-gregory`]).length > 0; } catch { return false; } };

// ── giver A: find the concepts from the glosses ───────────────────────────────────────────────────────────────────────────────────────────
function scan(d) {
  const month = new Map(), weekday = new Map();
  for (const c of d.manifest.chunks) for (const ln of d.loadChunk(c)) {
    const m = ln.includes("Gregorian") && ln.includes("month"), w = ln.includes("day of the week");
    if (!m && !w) continue;
    const row = JSON.parse(ln);
    for (const e of row.e) {
      if (e.c !== "en" || (e.p !== "name" && e.p !== "noun")) continue;
      for (const s of e.s ?? []) {
        const g = (s.g ?? [])[0] ?? "", into = m && /\bmonth\b/i.test(g) && /Gregorian/.test(g) ? month : w && /\bday of the week\b/i.test(g) ? weekday : null;
        if (!into) continue;
        const pred = /(?:following|follows) (?:the )?([A-Z][a-z]+)/.exec(g)?.[1] ?? null, succ = /(?:preceding|precedes) (?:the )?([A-Z][a-z]+)/.exec(g)?.[1] ?? null, prev = into.get(row.w);
        if (!prev || (e.t?.length ?? 0) > prev.t.length) into.set(row.w, { gloss: g, t: e.t ?? [], pred, succ, back: /of the previous year/.test(g) });
      }
    }
  }
  return { month, weekday };
}
// months: the one whose predecessor is "of the previous year" leads; successors are followed; a candidate the chain skipped joins after its named predecessor
function monthChain(cands) {
  const lead = [...cands].find(([, v]) => v.back)?.[0], order = [], seen = new Set();
  for (let w = lead; w && cands.has(w) && !seen.has(w); w = cands.get(w).succ) { order.push(w); seen.add(w); }
  for (const [w, v] of cands) if (!seen.has(w) && v.pred && order.includes(v.pred) && (!v.succ || order.includes(v.succ))) { order.splice(order.indexOf(v.pred) + 1, 0, w); seen.add(w); }
  return order;
}
// weekdays: the longest simple cycle of successors
function dayCycle(cands) {
  let best = [];
  for (const [start] of cands) {
    const order = [], seen = new Set(); let w = start;
    while (w && cands.has(w) && !seen.has(w)) { order.push(w); seen.add(w); w = cands.get(w).succ; }
    if (w === start && order.length > best.length) best = order;
  }
  return best;
}

// ── giver B: CLDR through Intl ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const when = (cls, i) => (cls === "month" ? new Date(Date.UTC(2024, i, 15)) : new Date(Date.UTC(2024, 0, i + 1)));   // 2024-01-01 is an ISO weekday 1
function cldrCalendar(loc, cls, i) {
  const out = new Map(), part = cls === "month" ? "month" : "weekday", dt = when(cls, i);
  const add = (f, k) => { if (f) (out.get(f) ?? out.set(f, new Set()).get(f)).add(k); };
  for (const style of ["long", "short"]) {
    add(new Intl.DateTimeFormat(loc, { [part]: style, timeZone: "UTC" }).format(dt), `${style}/standalone`);
    add(new Intl.DateTimeFormat(loc, { day: "numeric", [part]: style, timeZone: "UTC" }).formatToParts(dt).find((x) => x.type === part)?.value, `${style}/format`);
  }
  return out;
}
function cldrRelative(loc, rel) {
  const auto = new Intl.RelativeTimeFormat(loc, { numeric: "auto" }).format(rel.offset, rel.unit), always = new Intl.RelativeTimeFormat(loc, { numeric: "always" }).format(rel.offset, rel.unit);
  return auto !== always ? new Map([[auto, new Set(["auto"])]]) : new Map();
}

// ── one build: the prior and the numbers behind it ────────────────────────────────────────────────────────────────────────────────────────
async function build(d, packInfo) {
  const { month, weekday } = scan(d);
  const monthOrder = monthChain(month), dayOrder = dayCycle(weekday);
  const enMonth = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(when("month", i)));
  const enDay = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat("en", { weekday: "long", timeZone: "UTC" }).format(when("weekday", i)));
  // weekdays are numbered by ISO 8601 (the declared choice), fixed by CLDR's English name of the date that is ISO weekday 1, then following the glosses' cycle
  const at = dayOrder.indexOf(enDay[0]), dayIso = at < 0 ? [] : [...dayOrder.slice(at), ...dayOrder.slice(0, at)];
  const concepts = [];
  monthOrder.forEach((w, i) => concepts.push({ key: `month:${i + 1}`, cls: "month", n: i + 1, en: w, gloss: month.get(w).gloss, pairs: month.get(w).t }));
  dayIso.forEach((w, i) => concepts.push({ key: `weekday:${i + 1}`, cls: "weekday", n: i + 1, en: w, gloss: weekday.get(w).gloss, pairs: weekday.get(w).t }));
  const rtfAuto = new Intl.RelativeTimeFormat("en", { numeric: "auto" }), rtfAlways = new Intl.RelativeTimeFormat("en", { numeric: "always" }), gaps = [];
  for (const unit of ["day", "week", "month", "quarter", "year"]) for (const offset of [-2, -1, 0, 1, 2]) {
    const en = rtfAuto.format(offset, unit); if (en === rtfAlways.format(offset, unit)) continue;
    const r = d.resolve(en, { lang: "en", learn: false });
    if (!r.found) gaps.push({ kind: "absent_in_giver_A", concept: `rel:${unit}:${offset}`, en });
    concepts.push({ key: `rel:${unit}:${offset}`, cls: "relative", unit, offset, en, gloss: null, pairs: r.found ? r.entries.flatMap((e) => e.t ?? []) : [] });
  }
  // A's forms: lang -> concept -> norm -> { form, codes }
  const A = new Map(), langCodes = new Map();
  for (const c of concepts) for (const [code, raw] of c.pairs) {
    const lang = canon(code), form = unlink(raw), n = norm(lang, form); if (!n) continue;
    const L = A.get(lang) ?? A.set(lang, new Map()).get(lang), C = L.get(c.key) ?? L.set(c.key, new Map()).get(c.key), f = C.get(n) ?? C.set(n, { form, codes: new Set() }).get(n);
    f.codes.add(code); (langCodes.get(lang) ?? langCodes.set(lang, new Set()).get(lang)).add(code);
  }
  // B's forms for the languages A holds and CLDR supports
  const B = new Map();
  for (const lang of A.keys()) {
    if (!supported(lang)) continue;
    const loc = `${lang}-u-ca-gregory`, L = new Map();
    try {
      for (const c of concepts) {
        const forms = c.cls === "relative" ? cldrRelative(loc, c) : cldrCalendar(loc, c.cls, c.n - 1);
        if (forms.size) L.set(c.key, new Map([...forms].map(([f, kinds]) => [norm(lang, f), { form: f, kinds }])));
      }
      B.set(lang, L);
    } catch { /* a locale Intl names but cannot format: it stays A-only */ }
  }
  // the prior: sorted everywhere, no clock, so two builds are the same bytes
  const landed = concepts.filter((c) => LANDED.includes(c.cls)), thin = [];
  for (const cls of LANDED) {
    const sizes = landed.filter((c) => c.cls === cls).map((c) => c.pairs.length).sort((x, y) => x - y), median = sizes[sizes.length >> 1] ?? 0;
    for (const c of landed.filter((x) => x.cls === cls && x.pairs.length < median / 4)) thin.push({ kind: "thin_in_giver_A", concept: c.key, en: c.en, pairs: c.pairs.length, classMedian: median });
  }
  const languages = {};
  for (const lang of [...A.keys()].sort()) {
    const row = {};
    for (const c of landed) {
      const a = A.get(lang).get(c.key), b = B.get(lang)?.get(c.key), forms = [];
      for (const n of [...new Set([...(a?.keys() ?? []), ...(b?.keys() ?? [])])].sort()) {
        const fa = a?.get(n), fb = b?.get(n);
        forms.push({ form: fb?.form ?? fa.form, norm: n, givers: [fa && "wiktionary-slim", fb && "cldr"].filter(Boolean), ...(fb ? { kind: [...fb.kinds].sort() } : {}), ...(fa ? { codes: [...fa.codes].sort() } : {}), standing: "candidate" });
      }
      if (forms.length) row[c.key] = forms;
    }
    languages[lang] = row;
  }
  const prior = {
    schema: "TimePrior@1", language: "multi",
    provenance: {
      stage: "s9_time", prereg: "scripts/hyperlexicon/S9-TIME-PREREG.md", built_by: "scripts/hyperlexicon/s9_time.mjs",
      givers: [
        { id: "wiktionary-slim", role: "concepts located by gloss; forms through translation pairs", pack: path.basename(packInfo.path), sha256: packInfo.sha256, licence: "CC BY-SA 4.0" },
        { id: "cldr", role: "the same concepts as CLDR names them, Gregorian calendar forced", cldr: process.versions.cldr, icu: process.versions.icu, unicode: process.versions.unicode, node: process.version, licence: "Unicode License v3" },
      ],
      standing: "candidate", note: "every form is a candidate: a giver's claim licenses nothing until use earns it; S9 reads no corpus",
      normalize: { fold: "NFKC + lower-case", stripMarksFor: [...STRIP].sort(), then: "remove white space, apostrophes, full stops, hyphens, middle dots", source: "scripts/hyperlexicon/common.py STRIP_LANGS" },
      languageKey: "Intl.getCanonicalLocales of the giver's code, pooled; the source codes are kept per form",
    },
    concepts: Object.fromEntries(landed.map((c) => [c.key, { class: c.cls, ...(c.n ? { n: c.n } : {}), ...(c.unit ? { unit: c.unit, offset: c.offset } : {}), en: c.en, ...(c.gloss ? { gloss: c.gloss.slice(0, 160) } : {}) }])),
    gaps: thin.sort((x, y) => x.concept.localeCompare(y.concept)),
    languages,
  };
  return { prior, concepts, A, B, month, weekday, monthOrder, dayCycle: dayOrder, dayIso, enMonth, enDay, gaps };
}

// ── the numbers ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const DIGIT = /\p{Nd}/u;
function classify(Aset, Bforms) {
  const an = [...Aset], bn = [...Bforms.keys()];
  if (bn.some((n) => DIGIT.test(n)) && !an.some((n) => DIGIT.test(n))) return "numeral";
  if (an.some((a) => bn.some((b) => a.length > 1 && b.length > 1 && (a.includes(b) || b.includes(a)) && Math.abs(a.length - b.length) <= 4))) return "inflection";
  return "other";
}
function measure(R) {
  const { concepts, A, B } = R, byCls = {}, classes = ["month", "weekday", "relative"];
  for (const cls of classes) {
    const keys = concepts.filter((c) => c.cls === cls).map((c) => c.key), perLang = {}, kinds = { numeral: 0, inflection: 0, other: 0 };
    let cells = 0, agree = 0, derangedCells = 0, derangedAgree = 0, languagesA = 0, languagesBoth = 0, aOnly = [];
    const shift = (k) => {   // the deranged partner of a concept: the next in its cycle; a relative offset against its mirror
      const c = concepts.find((x) => x.key === k);
      if (cls === "month") return `month:${(c.n % 12) + 1}`;
      if (cls === "weekday") return `weekday:${(c.n % 7) + 1}`;
      return c.offset === 0 ? null : `rel:${c.unit}:${-c.offset}`;
    };
    for (const [lang, L] of A) {
      const held = keys.filter((k) => L.has(k)); if (held.length < 6) continue;
      languagesA++;
      const Bl = B.get(lang); if (!Bl) { aOnly.push(lang); continue; }
      languagesBoth++;
      let lc = 0, la = 0;
      for (const k of held) {
        const a = L.get(k), b = Bl.get(k); if (!b) continue;
        lc++; cells++;
        if ([...a.keys()].some((n) => b.has(n))) { la++; agree++; } else kinds[classify(new Set(a.keys()), b)]++;
        const j = shift(k), bj = j && Bl.get(j); if (bj) { derangedCells++; if ([...a.keys()].some((n) => bj.has(n))) derangedAgree++; }
      }
      perLang[lang] = { cells: lc, agree: la };
    }
    byCls[cls] = { concepts: keys.length, languagesA, languagesBoth, aOnly: aOnly.sort(), cells, agree, agreement: cells ? agree / cells : null, disagreements: kinds, deranged: { cells: derangedCells, agree: derangedAgree, agreement: derangedCells ? derangedAgree / derangedCells : null }, perLang };
  }
  return byCls;
}
function gates(R, M, deterministic) {
  const g = {}, yes = (v, bar, pass, extra = {}) => ({ value: v, bar, pass, gating: true, ...extra });
  g.B1 = yes(M.month.agreement, ">= 0.80", M.month.agreement >= 0.8);
  g.B2 = yes(M.weekday.agreement, ">= 0.80", M.weekday.agreement >= 0.8);
  g.B3 = yes(M.relative.agreement, ">= 0.60", M.relative.agreement >= 0.6, { gating: false, note: "REC-1: relative terms are not landed; recorded" });
  g.B4 = yes(M.month.languagesA, ">= 100 languages with 6+ months in A", M.month.languagesA >= 100);
  const sameOrder = (a, b) => a.length === b.length && a.every((w, i) => w === b[i]);
  const monthsOk = R.monthOrder.length === 12 && sameOrder(R.monthOrder, R.enMonth) && R.month.get(R.monthOrder[11]).succ === R.monthOrder[0];
  const daysOk = R.dayCycle.length === 7 && sameOrder(R.dayIso, R.enDay);
  g.B5 = yes({ months: R.monthOrder.length, weekdays: R.dayCycle.length, monthsOrderMatchesCLDR: monthsOk, weekdaysOrderMatchesCLDR: daysOk }, "12 and 7, single cycles, order equals CLDR's", monthsOk && daysOk);
  // B6: nothing the run found (a month name, a weekday name, an ordinal word in a month gloss) appears in this file's code (comments removed)
  const code = fs.readFileSync(fileURLToPath(import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const lead = (g, noun) => new RegExp(`^The (\\w+)(?: and last)? ${noun}`).exec(g)?.[1];
  const ordinals = [...R.monthOrder.map((w) => lead(R.month.get(w).gloss, "month")), ...R.dayIso.map((w) => lead(R.weekday.get(w).gloss, "day"))].filter((x) => x && /(?:st|nd|rd|th)$/i.test(x));
  const found = [...new Set([...R.monthOrder, ...R.dayIso, ...ordinals].map((w) => w.toLowerCase()))];
  const leaked = found.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(code));
  g.B6 = yes({ checked: found.length, leaked }, "none leaked", leaked.length === 0);
  g.B7 = yes(deterministic, "two builds are the same bytes", deterministic);
  const dv = ["month", "weekday", "relative"].map((c) => M[c].deranged.agreement);
  g.B8 = yes(Object.fromEntries(["month", "weekday", "relative"].map((c, i) => [c, dv[i]])), "<= 0.10 in every landed class (month, weekday); relative recorded", dv.slice(0, 2).every((v) => v != null && v <= 0.1));
  const rows = Object.values(R.prior.languages).flatMap((L) => Object.values(L).flat());
  g.B9 = yes({ rows: rows.length }, "every row a candidate that names its giver(s)", rows.every((r) => r.standing === "candidate" && r.givers.length > 0));
  return g;
}

// ── run ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const pack = packPath(), reader = readerPath();
if (!reader) throw new Error("no Zenodotus lookup.mjs (set WIKTIONARY_READER)");
const { Dictionary } = await import(pathToFileURL(reader).href);
const d = new Dictionary({ pack });
const packInfo = { path: pack, sha256: crypto.createHash("sha256").update(fs.readFileSync(pack)).digest("hex") };
const R1 = await build(d, packInfo), R2 = await build(d, packInfo);
const bytes1 = JSON.stringify(R1.prior, null, 1), deterministic = bytes1 === JSON.stringify(R2.prior, null, 1);
const M = measure(R1), G = gates(R1, M, deterministic), allPass = Object.values(G).filter((x) => x.gating).every((x) => x.pass);
let preregCommit = null; try { preregCommit = execFileSync("git", ["-C", ROOT, "log", "--diff-filter=A", "--format=%h", "--", "scripts/hyperlexicon/S9-TIME-PREREG.md"], { encoding: "utf8" }).trim() || null; } catch { /* not a git checkout */ }
const strip = (m) => { const { perLang, ...rest } = m; return rest; };
const result = {
  stage: "s9_time", prereg: "scripts/hyperlexicon/S9-TIME-PREREG.md", preregCommit, rule: "REC-1 (Amendment 2): lands the classes that pass", landedClasses: LANDED, allPass, landed: false,
  givers: { A: R1.prior.provenance.givers[0], B: R1.prior.provenance.givers[1] },
  languages: Object.keys(R1.prior.languages).length, concepts: R1.concepts.length, bytes: bytes1.length, priorSha256: crypto.createHash("sha256").update(`${bytes1}\n`).digest("hex"),
  classes: { month: strip(M.month), weekday: strip(M.weekday), relative: strip(M.relative) },
  order: { monthChain: R1.monthOrder, weekdayCycleIso: R1.dayIso, droppedMonthCandidates: [...R1.month.keys()].filter((w) => !R1.monthOrder.includes(w)).sort(), droppedWeekdayCandidates: [...R1.weekday.keys()].filter((w) => !R1.dayCycle.includes(w)).sort() },
  pairsPerConcept: Object.fromEntries(R1.concepts.map((c) => [c.key, c.pairs.length])),
  gaps: R1.gaps, gates: G,
  worstLanguages: Object.fromEntries(["month", "weekday", "relative"].map((c) => [c, Object.entries(M[c].perLang).filter(([, v]) => v.agree < v.cells).sort((a, b) => a[1].agree / a[1].cells - b[1].agree / b[1].cells || a[0].localeCompare(b[0])).slice(0, 15).map(([l, v]) => ({ lang: l, ...v }))])),
};
if (has("land") && allPass) {
  fs.writeFileSync(PRIOR, bytes1 + "\n");
  const mp = path.join(ROOT, "priors", "manifest.json"), raw = fs.readFileSync(mp, "utf8"), man = JSON.parse(raw);
  if (JSON.stringify(man, null, 1) + "\n" !== raw && JSON.stringify(man, null, 1) !== raw) throw new Error("manifest.json does not round-trip; not touching it");
  man.files[path.basename(PRIOR)] = { schema: "TimePrior@1", language: "multi", giver: "Wiktionary slim pack 2026-10-01 (concepts by gloss, forms by translation pairs) + CLDR via ICU (scripts/hyperlexicon/s9_time.mjs)", home: true, note: "every form a candidate; S9-TIME-PREREG.md" };
  fs.writeFileSync(mp, JSON.stringify(man, null, 1) + (raw.endsWith("\n") ? "\n" : ""));
  result.landed = true;
}
fs.writeFileSync(`${RESULT}.json`, JSON.stringify(result, null, 1) + "\n");
console.log(JSON.stringify({ allPass, landed: result.landed, languages: result.languages, gates: Object.fromEntries(Object.entries(G).map(([k, v]) => [k, `${v.pass ? "pass" : "FAIL"}${v.gating ? "" : " (recorded, not gating)"} ${typeof v.value === "number" ? v.value.toFixed(3) : JSON.stringify(v.value)} (${v.bar})`])) }, null, 1));
d.close();
