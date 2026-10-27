// extract-kin.mjs — the PLAIN arm's reader of stated kinship, Russian and English. Deterministic, no model, no network.
//   node extract-kin.mjs <text> <lang ru|en> <kin-lexicon.json> <name-parts-ru.json> <out.json> [fromChar] [toChar]
// What it reads (and what it does not): a kin TERM is any word the giver-read lexicon (kin-lexicon.mjs) lists or lists a form of;
// a NAME is a word that is capitalised somewhere and never written lower-case anywhere in the text (a type-level witness, not a gate);
// a MENTION is a run of adjacent names; a patronymic is a name carrying the declared suffix class of name-parts-ru.json in the second
// place of a run. Statement patterns (holder = who the kin term names, possessor = whose kin):
//   A: holder and possessor both named -> a fact with giver 'text' and the byte span; P: only the possessor named (holder unbound);
//   H: only the holder named (possessor unbound); N: neither. P, H, N are counted, never turned into facts.
// Name keys are NOT referents: K3 = (given group, family group), K2 = (given group); groups join two name types that share a long
// prefix (declared plain-arm parameters below). G1-1's referent layer supersedes this proxy when it lands.
import fs from "node:fs";
import crypto from "node:crypto";

export const PARAMS = Object.freeze({
  GROUP_MIN_PREFIX: 3,       // two name types join when their common prefix is at least this long ...
  GROUP_MAX_TAIL: 2,         // ... and each differs from the prefix by at most this many letters
  MAX_MENTION: 4,            // a run of names longer than this is cut
  SKIP_BETWEEN: 1,           // tokens between a kin term and its possessor (a title: «дочь князя Василия»)
  FATHER_STEM_SLACK: 1,      // a patronymic stem may be shorter than the father's name by this many letters
});

const foldRu = (s) => s.normalize("NFC").toLowerCase().replace(/́/g, "").replace(/ё/g, "е");
const foldEn = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const SCRIPT = { ru: /^\p{Script=Cyrillic}+$/u, en: /^\p{Script=Latin}+(?:-\p{Script=Latin}+)*$/u };
const PATRO_RU = /^(.*?)(ович|евич|ьевич|ич|овн|евн|ичн)(а|у|е|ем|ом|ы|ой|ою)?$/;
const PATRO_EN = /^(.*?)(ovich|evich|yevich|yich|ich|ovn|evn|ichn|inichn)(a|u|e|y)?$/;

const HOLDER_WINDOW = { ru: 2, en: 3 };   // tokens between a holder and its kin term: ru one modifier; en an article and an adjective

export function extract({ text, lang, lexicon, namePartsRu, from = 0, to = text.length, srcId }) {
  const fold = lang === "ru" ? foldRu : foldEn;
  const re = lang === "ru" ? /\p{L}+/gu : /\p{L}+(?:-\p{L}+)*(?:[’']s\b)?/gu;
  // footnote and heading lines carry no narration (Russian wikisource: "↑ …" lines, "## …" headings)
  const skipLine = new Set(); { let p = 0; for (const line of text.split("\n")) { if (/^\s*(↑|#)/.test(line)) skipLine.add(p); p += line.length + 1; } }
  const lineStartOf = (i) => { let k = text.lastIndexOf("\n", i - 1) + 1; return k; };
  const toks = []; let m, bytePos = 0, prevEnd = 0;
  while ((m = re.exec(text))) {
    let raw = m[0], poss = false; if (lang === "en" && /[’']s$/.test(raw)) { poss = true; raw = raw.replace(/[’']s$/, ""); }
    bytePos += Buffer.byteLength(text.slice(prevEnd, m.index)); const bs = bytePos; bytePos += Buffer.byteLength(m[0]); prevEnd = m.index + m[0].length;
    if (!SCRIPT[lang].test(raw)) { toks.push({ raw, f: fold(raw), s: m.index, e: prevEnd, bs, be: bytePos, other: true }); continue; }
    toks.push({ raw, f: fold(raw), s: m.index, e: prevEnd, bs, be: bytePos, cap: raw[0] !== raw[0].toLowerCase(), poss, skip: skipLine.has(lineStartOf(m.index)) });
  }
  // type table: capitalised somewhere and never lower-case anywhere
  const cap = new Map(), low = new Map();
  for (const t of toks) { if (t.other || t.skip) continue; const mp = t.cap ? cap : low; mp.set(t.f, (mp.get(t.f) ?? 0) + 1); }
  const nameLike = (t) => !t.other && t.cap && !low.has(t.f) && t.f.length >= 2;
  // groups: union-find over name types by the shared-prefix rule
  const types = [...cap.keys()].filter((f) => !low.has(f) && f.length >= 2);
  const par = new Map(types.map((f) => [f, f])); const find = (x) => { while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
  const bucket = new Map(); for (const f of types) { const k = f.slice(0, PARAMS.GROUP_MIN_PREFIX); (bucket.get(k) ?? bucket.set(k, []).get(k)).push(f); }
  const cp = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
  for (const arr of bucket.values()) for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
    const a = arr[i], b = arr[j], c = cp(a, b);
    if (c >= PARAMS.GROUP_MIN_PREFIX && a.length - c <= PARAMS.GROUP_MAX_TAIL && b.length - c <= PARAMS.GROUP_MAX_TAIL) par.set(find(a), find(b));
  }
  const members = new Map(); for (const f of types) { const r = find(f); (members.get(r) ?? members.set(r, []).get(r)).push(f); }
  const rep = new Map(); for (const [r, ms] of members) { const best = ms.slice().sort((x, y) => (cap.get(y) - cap.get(x)) || (x < y ? -1 : 1))[0]; for (const f of ms) rep.set(f, best); }
  const grp = (f) => rep.get(f) ?? f;
  // mentions: runs of adjacent name tokens separated by single spaces
  const mentionAt = new Array(toks.length).fill(null), mentions = [];
  for (let i = 0; i < toks.length;) {
    if (!nameLike(toks[i]) || toks[i].skip) { i++; continue; }
    let j = i; while (j + 1 < toks.length && j + 1 - i < PARAMS.MAX_MENTION && nameLike(toks[j + 1]) && !toks[j + 1].skip && /^[  ]+$/.test(text.slice(toks[j].e, toks[j + 1].s)) && !toks[j].poss) j++;
    const idx = []; for (let k = i; k <= j; k++) idx.push(k);
    const PATRO = lang === "ru" ? PATRO_RU : PATRO_EN;
    const pIdx = idx.findIndex((k, n) => n >= 1 && PATRO.test(toks[k].f));
    const mention = { tokens: idx, first: i, last: j, start: toks[i].bs, end: toks[j].be, poss: !!toks[j].poss };
    if (pIdx >= 0) { mention.given = toks[idx[pIdx - 1]].f; mention.patro = toks[idx[pIdx]].f; mention.family = idx[pIdx + 1] != null ? toks[idx[pIdx + 1]].f : null; }
    else { mention.given = toks[idx[0]].f; mention.family = idx[1] != null ? toks[idx[1]].f : null; }
    mention.k3 = `${grp(mention.given)}|${mention.family ? grp(mention.family) : ""}`; mention.k2 = grp(mention.given);
    mentions.push(mention); for (const k of idx) mentionAt[k] = mention; i = j + 1;
  }
  // kin terms in the text
  const forms = new Map(); const terms = new Map();   // folded form -> lemma ; lemma -> {kind, rel, end, sex, composite}
  if (lang === "ru") {
    for (const [w, L] of Object.entries(lexicon.russian_forms)) forms.set(foldRu(w), foldRu(L));
    for (const [L, v] of Object.entries(lexicon.russian)) terms.set(foldRu(L), { en: v.en, kind: v.kind });
  } else {
    const en = new Set([...Object.keys(lexicon.atoms), ...Object.keys(lexicon.composites), "cousin", "nephew", "niece", "brother-in-law", "sister-in-law"].filter((t) => /^[a-z-]+$/.test(t)));
    for (const t of en) { forms.set(t, t); forms.set(t + "s", t); }
    for (const t of en) terms.set(t, { en: t, kind: lexicon.atoms[t] ? "atom" : lexicon.composites[t] ? "composite" : "unruled" });
  }
  const sexOfPatro = (pf) => (/(овн|евн|ичн)/.test(pf) || /(ovn|evn|ichn)/.test(pf)) ? "female" : "male";
  const inRegion = (i) => toks[i].s >= from && toks[i].e <= to;
  const gapText = (a, b) => text.slice(toks[a].e, toks[b].s);
  const sepOK = (a, b) => /^[\s,—–\-«»"“”]*$/.test(gapText(a, b));
  const stmts = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]; if (t.other || t.skip || !inRegion(i)) continue;
    const L = forms.get(t.f); if (!L) continue;
    const term = terms.get(L); if (!term) continue;
    if (lang === "ru" && nameLike(t)) continue;
    // possessor (after the term): ru: term [lowercase title] Mention ; en: term "of" [non-name] Mention, or Mention's term (before)
    let poss = null, holder = null, hAfter = false;
    if (lang === "ru") {
      let j = i + 1;
      if (j < toks.length && mentionAt[j] && mentionAt[j].first === j && sepOK(i, j)) poss = mentionAt[j];
      else if (j + 1 < toks.length && !toks[j].other && !nameLike(toks[j]) && mentionAt[j + 1] && mentionAt[j + 1].first === j + 1 && /^\s+$/.test(gapText(i, j)) && /^\s+$/.test(gapText(j, j + 1))) poss = mentionAt[j + 1];
    } else {
      let j = i + 1;
      if (toks[j] && toks[j].f === "of" && /^\s+$/.test(gapText(i, j))) {
        let k = j + 1;
        if (mentionAt[k] && mentionAt[k].first === k) poss = mentionAt[k];
        else if (toks[k] && !nameLike(toks[k]) && mentionAt[k + 1] && mentionAt[k + 1].first === k + 1) poss = mentionAt[k + 1];
      }
      if (!poss) { const p = mentionAt[i - 1]; if (p && p.last === i - 1 && p.poss && /^\s+$/.test(gapText(i - 1, i))) poss = p; }
    }
    // holder: a mention before the term joined by a comma or dash (appositive) with at most 2 lowercase tokens between; or, English, directly after
    for (let back = 1; back <= HOLDER_WINDOW[lang] && !holder; back++) {
      const mi = i - back; if (mi < 0) break; const mm = mentionAt[mi];
      if (mm && mm.last === mi && !mm.poss) { const between = text.slice(toks[mi].e, toks[i].s); if (/[,—–]/.test(between) && !/[.!?;:\n]/.test(between)) holder = mm; break; }
      if (toks[mi].other || nameLike(toks[mi])) break;
    }
    if (!holder && lang === "en" && mentionAt[i + 1] && mentionAt[i + 1].first === i + 1 && /^\s+$/.test(gapText(i, i + 1)) && !(poss && mentionAt[i + 1] === poss)) { holder = mentionAt[i + 1]; hAfter = true; }
    if (holder && poss && holder === poss) holder = null;
    const cat = holder && poss ? "A" : poss ? "P" : holder ? "H" : "N";
    const a = holder ?? poss ?? mentionAt[i] ?? null;
    const lo = Math.min(...[holder?.start, poss?.start, t.bs].filter((x) => x != null)), hi = Math.max(...[holder?.end, poss?.end, t.be].filter((x) => x != null));
    stmts.push({ lemma: L, en: term.en, kind: term.kind, cat, holder: holder && { k3: holder.k3, k2: holder.k2, given: holder.given, family: holder.family }, possessor: poss && { k3: poss.k3, k2: poss.k2, given: poss.given, family: poss.family }, span: [lo, hi], termAt: [t.bs, t.be], hAfter });
  }
  // patronymic facts (candidate class): child = the mention; father's given name = a given-position name whose stem matches
  const givenTypes = new Map();     // fold -> count at given position in a mention with a family or patronymic
  for (const mn of mentions) if (mn.patro || mn.family) givenTypes.set(mn.given, (givenTypes.get(mn.given) ?? 0) + 1);
  const PATRO = lang === "ru" ? PATRO_RU : PATRO_EN;
  const fatherCache = new Map();
  const fatherOf = (pf) => {
    if (fatherCache.has(pf)) return fatherCache.get(pf);
    const mm = pf.match(PATRO); const stem = mm ? mm[1] : null; let out = { gap: "patronymic_unparsed" };
    if (stem && stem.length >= PARAMS.GROUP_MIN_PREFIX) {
      const c = [];
      for (const [g, n] of givenTypes) { const k = cp(g, stem); if (k >= Math.max(PARAMS.GROUP_MIN_PREFIX, stem.length - PARAMS.FATHER_STEM_SLACK) && g.length - k <= PARAMS.GROUP_MAX_TAIL) c.push([grp(g), g, n]); }
      const byGrp = new Map(); for (const [G, g, n] of c) byGrp.set(G, (byGrp.get(G) ?? 0) + n);
      const ranked = [...byGrp.entries()].sort((x, y) => (y[1] - x[1]) || (x[0] < y[0] ? -1 : 1));
      out = ranked.length ? { father: ranked[0][0], ambiguous: ranked.length > 1, candidates: ranked.length } : { gap: "patronymic_father_not_attested" };
    }
    fatherCache.set(pf, out); return out;
  };
  const patro = [];
  for (const mn of mentions) {
    if (!mn.patro || toks[mn.first].s < from || toks[mn.last].e > to) continue;
    const fa = fatherOf(mn.patro);
    patro.push({ child: { k3: mn.k3, k2: mn.k2, given: mn.given, family: mn.family }, sex: sexOfPatro(mn.patro), father: fa.father ?? null, fatherGap: fa.gap ?? null, ambiguous: !!fa.ambiguous,
      fatherK3: fa.father ? `${fa.father}|${mn.family ? grp(mn.family) : ""}` : null, fatherK2: fa.father ?? null, span: [mn.start, mn.end] });
  }
  const sha = crypto.createHash("sha256").update(text).digest("hex");
  return { schema: "KinExtract@1", lang, src: srcId ?? `${lang}:${sha.slice(0, 12)}`, text_sha256: sha, region: [from, to], params: PARAMS,
    counts: { tokens: toks.length, name_types: types.length, mentions: mentions.length, mentions_with_patronymic: mentions.filter((x) => x.patro).length, kin_tokens: stmts.length },
    stmts, patro };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , textPath, lang, lexPath, npPath, outPath, f, t] = process.argv;
  const text = fs.readFileSync(textPath, "utf8"), lexicon = JSON.parse(fs.readFileSync(lexPath, "utf8"));
  const res = extract({ text, lang, lexicon, namePartsRu: JSON.parse(fs.readFileSync(npPath, "utf8")), from: f ? +f : 0, to: t ? +t : text.length });
  fs.writeFileSync(outPath, JSON.stringify(res));
  const cat = {}; for (const s of res.stmts) cat[s.cat] = (cat[s.cat] ?? 0) + 1;
  console.log(JSON.stringify({ counts: res.counts, cat, patro: res.patro.length }));
}
