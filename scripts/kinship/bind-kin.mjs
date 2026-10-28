// bind-kin.mjs — the KIN BINDER: tie the kin word of a quoted sentence to the beings at its two ends, by deterministic rules over the reader's ledger. OFF BY DEFAULT:
// nothing imports this file, and extract-kin.mjs, kin-lexicon.mjs, measure-kin.mjs and native/organs/kinship.js are byte-identical to main (the PR shows it).
//   node bind-kin.mjs --text <text> --ledger <KinLedger.json> --out <KinBind.json> [--tier 1|2] [--priors <dir>]
// No model is called, nothing is downloaded, and no word list is typed here: kin terms come from priors/kin-lexicon.json (Wiktionary), the part of speech of a form from
// priors/pos-rus.json (UD Russian-GSD), third-person pronouns and their gender from priors/pronoun-ru.json (UD), first/second/reflexive persons from
// priors/person-lexicon-ru.json (Wiktionary, scripts/kinship/build-person-lexicon.mjs), the patronymic classes (which carry a sex) from the extractor's own
// patterns (name-parts-ru.json's suffixes), the names and their referents from the reader's ledger (dump-ledger.mjs: khora's readDocument, unchanged).
//
// WHAT IT DOES. The plain extractor finds a kin TERM in the text and ties the statement into a fact only when both ends are names it read (category A). This binder takes
// the same kin terms and looks for the two ends with the named rules below. HOLDER = the being the kin word names (the son in "the son of X"); POSSESSOR = whose kin (X).
// An end it binds carries the rule's name; an end it cannot bind is a TYPED GAP (a gap kind of native/organs/kinship.js plus a closed reason code of this file), never a
// guess. A statement with both ends bound is emitted as fact specs {rel,a,b,giver,witness,standing} with giver `text:ru|rule:<rules>` and standing `candidate`; a gap that
// kinship.js can take an opinion for carries the unchanged `opinionSlot`. A model may only ever file an opinion beside this output (fileOpinion), never inside it.
//
// RULES (tier 1 = a marker on the page; tier 2 = an antecedent is searched). `T` = the kin word, "lemma form" = T is its lexicon lemma (nominative singular).
//   H-APP-LEFT  a being's name, a comma or dash, T:                        «Андрей Болконский, муж»                          holder = the name
//   P-GEN       T in its lemma form, then a name (up to MAX_MOD lower-case words between): «дочь князя Василия»              possessor = the name
//   H-APP2      ... then a comma, up to MAX_APPOS_MOD words, another name:   «дочь князя Василия, красавица Элен»            holder = the second name (P-GEN stands for the first)
//   H-APP-DET   a possessive before T (up to MAX_DET_GAP words) or just after it, then a name: «вашего блудного сына Анатоля», «Дочь его, княжна Элен»   holder = the name; the possessor is the possessive's referent:
//   P-VOC         second person («ваш», «вы»), in a spoken turn: the addressee = the one being named in a vocative fragment of the turn (a fragment of at most VOCATIVE_MAX_MODS words
//                 besides one name, between commas), else the name the turn's attribution addresses; two different vocatives, or none, is a gap
//   P-SPEAKER     first person («мой», «я»): the speaker = the being that is the first name after the verb of the turn's attribution («— сказал князь Василий»); a pronoun or a bare title is a gap
//   P-PRON3  (2)  third person «его/ее», in narrative: the antecedent = the one gender-compatible being of the nearest sentence that has one (same sentence, else the previous sentence of the
//                 paragraph, else the previous paragraph); two beings in that sentence is a gap. Gender is known only from a patronymic (-ович / -овна)
//   P-REFL   (2)  «свой»: as P-PRON3
//   P-SUBJ   (2)  a bare kin word (no possessive, no name after it) in narrative: the nearest being before it in the same sentence, no . ; : ! ? between, never the holder
//   H-PRED   (2)  a personal pronoun directly before T in its lemma form («Он сын ...»): the pronoun's referent by the rules above
// A statement whose holder and possessor end up the same being keeps the holder and gaps the possessor (one_referent_both_ends).
// GAP REASONS (closed): no_marker, genitive_or_apposition, speaker_not_named, addressee_not_named, antecedent_ambiguous, antecedent_absent, antecedent_not_searched (tier 1),
// pronoun_in_speech, plural_possessive, name_not_a_referent, one_referent_both_ends.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GAP_KINDS, opinionSlot, makeFact } from "../../native/organs/kinship.js";

export const BINDER_SCHEMA = "KinBind@1";
export const PARAMS = Object.freeze({
  MAX_MOD: 2,              // lower-case words between a kin word (or its possessive) and a name: a title and an adjective («князя», «знаменитого»)
  MAX_DET_GAP: 3,          // words between a possessive and the kin word it belongs to («вашего блудного сына»)
  MAX_APPOS_MOD: 3,        // lower-case words between a comma and an appositive name («красавица», «к красивой»)
  VOCATIVE_MAX_MODS: 1,    // words besides the name in a vocative fragment («Chère Анна Михайловна,»); two admit an apposition («une princesse Болконская») as a vocative
});
export const REASONS = Object.freeze(["no_marker", "genitive_or_apposition", "speaker_not_named", "addressee_not_named", "antecedent_ambiguous", "antecedent_absent", "antecedent_not_searched",
  "pronoun_in_speech", "plural_possessive", "name_not_a_referent", "one_referent_both_ends"]);

const here = path.dirname(fileURLToPath(import.meta.url));
const foldRu = (s) => s.normalize("NFC").toLowerCase().replace(/́/g, "").replace(/ё/g, "е");
const PATRO = /^(.*?)(ович|евич|ьевич|ич|овн|евн|ичн)(а|у|е|ем|ом|ы|ой|ою)?$/, PATRO_F = /(овн|евн|ичн)/;   // the extractor's own classes (extract-kin.mjs PATRO_RU, sexOfPatro)
const HARD = /[.;:!?]/;

export function loadPriors(dir = path.join(here, "..", "..", "priors")) {
  const j = (n) => JSON.parse(fs.readFileSync(path.join(dir, n), "utf8"));
  return { lexicon: j("kin-lexicon.json"), pos: j("pos-rus.json"), pronoun: j("pronoun-ru.json"), person: j("person-lexicon-ru.json"), nameParts: j("name-parts-ru.json") };
}

/** bindKin({text, ledger, extraction, priors, tier}) -> KinBind@1. `extraction` is the output of extract() over the same text (the plain arm's statements, unchanged). */
export function bindKin({ text, ledger, extraction, priors, tier = 2 }) {
  const buf = Buffer.from(text), lex = priors.lexicon;
  const topKey = (o) => { let best = null, n = 0; for (const [k, v] of Object.entries(o)) if (v > n || (v === n && best !== null && k < best)) { best = k; n = v; } return best; };
  const posOf = (f, raw) => { const e = priors.pos.forms[raw] ?? priors.pos.forms[f]; return e ? topKey(e) : null; };
  // the givers' tables are keyed by written forms; the text is read folded (ё as е), so the tables are folded the same way (duplicates merged, keys in sorted order)
  const sumDict = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = (o[k] ?? 0) + v; return o; };
  const foldTable = (forms, merge) => { const out = new Map(); for (const k of Object.keys(forms).sort()) { const f = foldRu(k); out.set(f, out.has(f) ? merge(out.get(f), forms[k]) : forms[k]); } return out; };
  const personTab = foldTable(priors.person.forms, (a) => a), pronTab = foldTable(priors.pronoun.forms, (a, b) => ({ gender: sumDict(a.gender, b.gender), number: sumDict(a.number, b.number) }));
  const personOf = (f) => personTab.get(f) ?? null;
  const pron3 = (f) => pronTab.get(f) ?? null;
  // ---- tokens: letter runs as the extractor reads them, with character and byte offsets
  const toks = []; { const re = /\p{L}+/gu; let m, bytePos = 0, prevEnd = 0;
    while ((m = re.exec(text))) { bytePos += Buffer.byteLength(text.slice(prevEnd, m.index)); const bs = bytePos; bytePos += Buffer.byteLength(m[0]); prevEnd = m.index + m[0].length;
      const raw = m[0]; toks.push({ i: toks.length, raw, f: foldRu(raw), s: m.index, e: prevEnd, bs, be: bytePos, cap: raw[0] !== raw[0].toLowerCase(), pos: posOf(foldRu(raw), raw.toLowerCase()), mention: null, para: 0, pnum: 0, sent: 0 }); } }
  const tokAtByte = new Map(toks.map((t) => [t.bs, t.i]));
  const tokFrom = (c) => { let lo = 0, hi = toks.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (toks[mid].e <= c) lo = mid + 1; else hi = mid; } return lo; };   // first token ending after character c
  const tokRange = (a, b) => { const out = []; for (let k = tokFrom(a); k < toks.length && toks[k].s < b; k++) if (toks[k].s >= a && toks[k].e <= b) out.push(toks[k]); return out; };
  // ---- paragraphs are lines; pnum counts non-empty lines only (the previous paragraph is pnum - 1)
  const paraStart = []; { let p = 0; for (const line of text.split("\n")) { paraStart.push(p); p += line.length + 1; } }
  const paraEnd = (k) => (k + 1 < paraStart.length ? paraStart[k + 1] - 1 : text.length);
  const lineOf = (c) => { let lo = 0, hi = paraStart.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (paraStart[mid] <= c) lo = mid; else hi = mid - 1; } return lo; };
  const pnumOfLine = []; { let n = -1; for (let k = 0; k < paraStart.length; k++) { if (text.slice(paraStart[k], paraEnd(k)).trim()) n++; pnumOfLine.push(n); } }
  // ---- mentions: ledger name spans of beings (standing `referent`), the longest of any overlap
  const beings = new Set(ledger.referents.filter((r) => r.standing === "referent").map((r) => r.id));
  const spans = ledger.spans.filter((s) => s.kind === "name" && s.ref && beings.has(s.ref)).slice().sort((a, b) => a.at[0] - b.at[0] || (b.at[1] - b.at[0]) - (a.at[1] - a.at[0]));
  const mentions = []; { let end = -1; for (const s of spans) { if (s.at[0] < end) continue; end = s.at[1]; mentions.push({ ref: s.ref, s: s.at[0], e: s.at[1], bs: s.bytes[0], be: s.bytes[1], text: s.text, first: -1, last: -1 }); } }
  for (const mn of mentions) { let k = tokFrom(mn.s); mn.first = k; while (k < toks.length && toks[k].s < mn.e) { toks[k].mention = mn; k++; } mn.last = k - 1; }
  // ---- sentence ids: a break after . ! ? … then a capital or a dash; a new paragraph is a break
  { let sent = 0, lastLine = -1; for (const t of toks) { t.para = lineOf(t.s); t.pnum = pnumOfLine[t.para]; if (t.para !== lastLine) { sent++; lastLine = t.para; } t.sent = sent;
      const nx = toks[t.i + 1]; if (nx && lineOf(nx.s) === t.para) { const gap = text.slice(t.e, nx.s); if (/[.!?…]["»”)]*\s+(?:[—–]\s*)?$/.test(gap) && (nx.cap || /[—–]\s*$/.test(gap))) sent++; } } }
  // ---- the dialogue structure of a dialogue paragraph (it opens with a dash): parts split at " — "; an attribution is a lower-case part that follows speech
  const dialogue = new Map();
  function dialogueOf(k) {
    if (dialogue.has(k)) return dialogue.get(k);
    const pt = text.slice(paraStart[k], paraEnd(k)), base = paraStart[k]; let d = null;
    if (/^\s*[—–]/.test(pt)) {
      const cuts = []; { const re = /\s[—–]\s/g; let m; while ((m = re.exec(pt))) cuts.push([m.index, m.index + m[0].length]); }
      const raw = []; let prev = pt.search(/[—–]/) + 1; for (const [a, b] of cuts) { if (a >= prev) { raw.push([prev, a]); prev = b; } } raw.push([prev, pt.length]);
      const parts = raw.filter(([a, b]) => b > a).map(([a, b]) => ({ from: base + a, to: base + b, kind: "speech" }));
      for (let q = 1; q < parts.length; q++) { const first = tokRange(parts[q].from, parts[q].to)[0]; if (first && !first.cap && parts[q - 1].kind === "speech") parts[q].kind = "attr"; }
      for (const part of parts) {
        const ts = tokRange(part.from, part.to);
        if (part.kind === "attr") {          // speaker: the first being after the verb (the first word), unless a third-person pronoun comes first; addressee: a later, different being
          let spk = { ref: null }, adr = null, sawPronoun = false;
          for (const t of ts.slice(1)) {
            if (!t.mention && pron3(t.f)) { if (!spk.ref) sawPronoun = true; continue; }
            if (t.mention && t.mention.first === t.i) { const mn = t.mention; if (!spk.ref && !sawPronoun) spk = { ref: mn.ref, mention: mn }; else if (spk.ref && !adr && mn.ref !== spk.ref) adr = { ref: mn.ref, mention: mn }; else if (!spk.ref && sawPronoun && !adr) adr = { ref: mn.ref, mention: mn }; }
          }
          part.speaker = spk; part.addressee = adr;
        } else {                             // vocatives: a fragment between commas of at most VOCATIVE_MAX_MODS words besides ONE being's name
          part.vocatives = []; const seg = text.slice(part.from, part.to); const re = /[^,.!?;:()«»—–]+/g; let m;
          while ((m = re.exec(seg))) { const fs_ = tokRange(part.from + m.index, part.from + m.index + m[0].length); const mns = [...new Set(fs_.map((t) => t.mention).filter(Boolean))];
            if (mns.length === 1 && fs_.length - (mns[0].last - mns[0].first + 1) <= PARAMS.VOCATIVE_MAX_MODS) part.vocatives.push(mns[0]); }
        }
      }
      d = { parts };
    }
    dialogue.set(k, d); return d;
  }
  const partAt = (c) => { const d = dialogueOf(lineOf(c)); return d ? d.parts.find((p) => c >= p.from && c < p.to) ?? null : null; };
  // ---- gender of a referent: from the patronymic of any of its mentions (the one giver here); null when none
  const genderOfRef = new Map();
  for (const mn of mentions) for (let k = mn.first + 1; k <= mn.last; k++) if (PATRO.test(toks[k].f) && !genderOfRef.has(mn.ref)) genderOfRef.set(mn.ref, PATRO_F.test(toks[k].f) ? "Fem" : "Masc");
  // ---- helpers
  const gapBetween = (a, b) => text.slice(toks[a].e, toks[b].s);
  const mentionAfter = (i, maxMod) => {          // a being's mention starting at token i or after up to maxMod lower-case non-verb words, no hard break on the way
    for (let k = 0; k <= maxMod; k++) { const t = toks[i + k]; if (!t || HARD.test(gapBetween(i + k - 1, i + k))) return null; if (t.mention && t.mention.first === t.i) return { mention: t.mention, at: t.i }; if (t.cap || t.pos === "VERB") return null; }
    return null; };
  const possessiveAt = (t) => { const p = personOf(t.f); return p && p.kind === "possessive" ? p : null; };      // «его» is a possessive; «он» is not (it is a personal pronoun, read by H-PRED)
  function antecedent(i, gender, exclude) {       // the nearest sentence (same, previous of the paragraph, previous paragraph) with a compatible being; one being there binds, two is a gap
    const here_ = toks[i];
    const scan = (pred) => { const out = []; const seen = new Set(); for (let k = i - 1; k >= 0 && pred(toks[k]); k--) { const mn = toks[k].mention; if (mn && mn.last === k && !seen.has(mn.ref) && !exclude.has(mn.ref)) { seen.add(mn.ref); out.push(mn); } } return out; };
    const compatible = (mn) => { const g = genderOfRef.get(mn.ref); if (!gender || !g) return true; return gender === "Neut" ? g === "Masc" : g === gender; };
    for (const pred of [(t) => t.sent === here_.sent, (t) => t.sent >= here_.sent - 1 && t.para === here_.para, (t) => t.pnum >= here_.pnum - 1]) {
      const cs = scan(pred).filter(compatible); if (!cs.length) continue;
      const sentOfMention = (mn) => toks[mn.last].sent; const nearest = Math.max(...cs.map(sentOfMention)); const inNearest = cs.filter((mn) => sentOfMention(mn) === nearest);
      const refs = [...new Set(inNearest.map((mn) => mn.ref))]; return refs.length === 1 ? { mention: inNearest[0] } : { gap: "antecedent_ambiguous" };
    }
    return { gap: "antecedent_absent" };
  }
  function resolve(i, exclude) {                  // the referent of the pronoun-like token i (a possessive or a personal pronoun): {mention, rule} or {gap}
    const t = toks[i], pr = personOf(t.f), q = pron3(t.f), part = partAt(t.s), person = pr ? pr.person : q ? 3 : null;
    if (person === 1 || person === 2) {
      if (!part || part.kind !== "speech") return { gap: person === 2 ? "addressee_not_named" : "speaker_not_named" };
      const d = dialogueOf(lineOf(t.s));
      if (person === 2) {
        const vs = [...new Map(d.parts.filter((p) => p.kind === "speech").flatMap((p) => p.vocatives).filter((v) => !exclude.has(v.ref)).map((v) => [v.ref, v])).values()];
        if (vs.length === 1) return { mention: vs[0], rule: "P-VOC" }; if (vs.length > 1) return { gap: "addressee_not_named" };
        const a = d.parts.find((p) => p.kind === "attr" && p.addressee && !exclude.has(p.addressee.ref)); return a ? { mention: a.addressee.mention, rule: "P-VOC" } : { gap: "addressee_not_named" };
      }
      const a = d.parts.find((p) => p.kind === "attr" && p.speaker.ref && !exclude.has(p.speaker.ref)); return a ? { mention: a.speaker.mention, rule: "P-SPEAKER" } : { gap: "speaker_not_named" };
    }
    if (tier < 2) return { gap: "antecedent_not_searched" };
    if (part && part.kind === "speech") return { gap: "pronoun_in_speech" };
    if (q && topKey(q.number) === "Plur") return { gap: "plural_possessive" };
    const gender = q ? topKey(Object.fromEntries(Object.entries(q.gender).filter(([g]) => g !== "_"))) : null;
    const a = antecedent(i, gender, exclude); return a.mention ? { mention: a.mention, rule: pr?.person === "refl" ? "P-REFL" : "P-PRON3" } : { gap: a.gap };
  }
  // ---- per statement
  const recs = [];
  extraction.stmts.forEach((s, idx) => {
    const ti = tokAtByte.get(s.termAt[0]) ?? -1; if (ti < 0) return;
    const T = toks[ti], term = lex.atoms[s.en] ?? null;
    const rec = { i: idx, term: s.en, lemma: s.lemma, termAt: s.termAt, plain: s.cat, holder: null, possessor: null, uses: [] };
    const bind = (end, mention, rule, extra) => { rec[end] = { ref: mention.ref, rule, mention: [mention.bs, mention.be], text: mention.text }; if (extra) rec.uses.push(extra); rec.uses.push([mention.bs, mention.be]); };
    const gapEnd = (end, why) => { if (!rec[end]) rec[end] = { ref: null, gap: why }; };
    const nominative = foldRu(T.raw) === foldRu(s.lemma ?? "");
    // right of T: a possessive just after it (with a comma), then a name, then an appositive name
    let j = ti + 1, detR = null;
    if (toks[j] && possessiveAt(toks[j]) && /^[\s,]*$/.test(gapBetween(ti, j))) { detR = j; j++; }
    const after = mentionAfter(j, PARAMS.MAX_MOD), name1 = after ? after.mention : null;
    let name2 = null;
    if (name1) { const k = name1.last + 1; if (toks[k] && /^\s*,\s*$/.test(text.slice(name1.e, toks[k].s))) for (let m = 0; m <= PARAMS.MAX_APPOS_MOD; m++) { const u = toks[k + m]; if (!u || (m > 0 && HARD.test(gapBetween(k + m - 1, k + m)))) break;
      if (u.mention && u.mention.first === u.i) { if (u.mention.ref !== name1.ref) name2 = u.mention; break; } if (u.cap || u.pos === "VERB") break; } }
    // left of T: a possessive within MAX_DET_GAP words (no hard break, no name, no noun/verb/preposition between), and a name joined to T by a comma or dash
    let detL = null; for (let k = ti - 1; k >= 0 && ti - k <= PARAMS.MAX_DET_GAP; k--) { const t = toks[k]; if (/[.;:!?—–]/.test(gapBetween(k, k + 1)) || t.mention) break; if (possessiveAt(t)) { detL = k; break; }
      if (["NOUN", "VERB", "ADP", "CCONJ", "SCONJ", "PRON"].includes(t.pos)) break; }
    const det = detR ?? detL;
    const nameLeft = (toks[ti - 1]?.mention && toks[ti - 1].mention.last === ti - 1 && /^\s*[,—–]\s*$/.test(gapBetween(ti - 1, ti))) ? toks[ti - 1].mention : null;
    // ---- the rules
    if (nameLeft) bind("holder", nameLeft, "H-APP-LEFT");
    if (det != null) {
      if (name1 && !rec.holder) bind("holder", name1, "H-APP-DET");
      const r = resolve(det, new Set(rec.holder ? [rec.holder.ref] : []));
      if (r.mention) bind("possessor", r.mention, r.rule, [toks[det].bs, toks[det].be]); else gapEnd("possessor", r.gap);
    } else if (name1) {
      if (nominative || name2) { bind("possessor", name1, "P-GEN"); if (name2 && !rec.holder) bind("holder", name2, "H-APP2"); }
      else if (!rec.holder) { gapEnd("holder", "genitive_or_apposition"); gapEnd("possessor", "genitive_or_apposition"); }
      else bind("possessor", name1, "P-GEN");
    } else { const nx = toks[j]; if (nx && nx.cap && !nx.mention && !HARD.test(gapBetween(j - 1, j))) gapEnd("possessor", "name_not_a_referent"); }
    if (tier >= 2 && !rec.holder && nominative) { const t = toks[ti - 1]; if (t && !t.mention && (pron3(t.f) || personOf(t.f)?.kind === "personal") && /^\s+$/.test(gapBetween(ti - 1, ti))) { const r = resolve(ti - 1, new Set()); if (r.mention) bind("holder", r.mention, "H-PRED", [toks[ti - 1].bs, toks[ti - 1].be]); else gapEnd("holder", r.gap); } }
    if (tier >= 2 && !rec.possessor && det == null && !name1 && partAt(T.s)?.kind !== "speech") {
      for (let k = ti - 1; k >= 0 && toks[k].sent === T.sent && !HARD.test(gapBetween(k, k + 1)); k--) { const mn = toks[k].mention; if (mn && mn.last === k && (!rec.holder || mn.ref !== rec.holder.ref)) { bind("possessor", mn, "P-SUBJ"); break; } } }
    for (const end of ["holder", "possessor"]) gapEnd(end, "no_marker");
    if (rec.holder.ref && rec.holder.ref === rec.possessor.ref) rec.possessor = { ref: null, gap: "one_referent_both_ends" };
    recs.push({ rec, term });
  });
  // ---- facts, typed gaps, opinion slots
  const specs = [], statements = [];
  const slotFor = (term, rec, end) => {           // the fact with one hole: the ends that are bound stay, the end this gap is about is "?" (a gap kind of kinship.js names the relation)
    const h = end === "holder" ? "?" : rec.holder.ref ?? "?", p = end === "possessor" ? "?" : rec.possessor.ref ?? "?";
    if (!term) return { rel: "term", term: rec.term, a: h, b: p };
    if (term.rel === "parent_of") return term.end === "a" ? { rel: "parent_of", a: h, b: p } : { rel: "parent_of", a: p, b: h };
    return { rel: term.rel, a: h, b: p };
  };
  for (const { rec, term } of recs) {
    const gaps = [];
    for (const end of ["holder", "possessor"]) if (!rec[end].ref) {
      const kind = term ? (term.rel === "parent_of" ? "no_parent_fact" : term.rel === "sibling_of" ? "no_sibling_fact" : "no_spouse_fact") : "no_rule_giver";
      const slot = slotFor(term, rec, end), gap = { kind, slot, why: rec[end].gap, end, opinionFillable: GAP_KINDS[kind].opinionFillable };
      // a stated composite (grandfather, uncle) is not a slot kinship.js's fileOpinion fills: no opinionSlot is attached for it, and the gap says why
      if (gap.opinionFillable && term) gap.opinionSlot = opinionSlot({ term: rec.term, of: (end === "holder" ? rec.possessor.ref : rec.holder.ref) ?? "?", statement: `ru#${rec.termAt[0]}-${rec.termAt[1]}` }, { kind, slot });
      else if (!term) gap.opinionSlotAbsent = "a stated composite term is not fileable through kinship.js fileOpinion";
      gaps.push(gap);
    }
    let fact = null;
    if (rec.holder.ref && rec.possessor.ref) {
      const lo = Math.min(rec.termAt[0], ...rec.uses.map((u) => u[0])), hi = Math.max(rec.termAt[1], ...rec.uses.map((u) => u[1]));
      const giver = `text:ru|rule:${[...new Set([rec.holder.rule, rec.possessor.rule])].sort().join("+")}`, witness = `ru#${lo}-${hi}`, h = rec.holder.ref, p = rec.possessor.ref, sp = [];
      if (term) { sp.push(term.rel === "parent_of" ? (term.end === "a" ? { rel: "parent_of", a: h, b: p } : { rel: "parent_of", a: p, b: h }) : { rel: term.rel, a: h, b: p }); if (term.sex) sp.push({ rel: "sex", a: h, value: term.sex }); }
      else sp.push({ rel: "term", term: rec.term, a: h, b: p });
      for (const x of sp) Object.assign(x, { giver, witness, standing: "candidate" });
      for (const x of sp) { const r = makeFact(x); if (r.refused) throw new Error(`kin-binder: makeFact refused its own spec (${r.refused})`); }
      specs.push(...sp); fact = { giver, witness, specs: sp.length };
    }
    statements.push({ i: rec.i, term: rec.term, lemma: rec.lemma, termAt: rec.termAt, plain: rec.plain, holder: rec.holder, possessor: rec.possessor, fact, gaps });
  }
  const n = (f) => statements.filter(f).length;
  return { schema: BINDER_SCHEMA, tier, params: PARAMS, text_sha256: crypto.createHash("sha256").update(buf).digest("hex"), ledger_text_sha256: ledger.text_sha256,
    counts: { statements: statements.length, facts: n((s) => s.fact), holders_bound: n((s) => s.holder.ref), possessors_bound: n((s) => s.possessor.ref), gaps: statements.reduce((a, s) => a + s.gaps.length, 0) },
    statements, specs };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
  const { extract } = await import("./extract-kin.mjs");
  const textPath = arg("text"), ledgerPath = arg("ledger"), outPath = arg("out"), tier = +arg("tier", 2);
  if (!textPath || !ledgerPath || !outPath) { console.error("usage: node bind-kin.mjs --text <text> --ledger <KinLedger.json> --out <KinBind.json> [--tier 1|2] [--priors <dir>]"); process.exit(2); }
  const priors = loadPriors(arg("priors") ?? undefined), text = fs.readFileSync(textPath, "utf8"), ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
  const extraction = extract({ text, lang: "ru", lexicon: priors.lexicon, namePartsRu: priors.nameParts });
  const res = bindKin({ text, ledger, extraction, priors, tier });
  fs.writeFileSync(outPath, JSON.stringify(res, null, 1) + "\n");
  console.log(JSON.stringify(res.counts));
}
