// scene-kin.mjs — the SCENE model for the kin binder: who is present in a scene and what the page has already tied of them, by RULES. OFF BY DEFAULT: nothing imports this file.
//   node scene-kin.mjs --text <text> --ledger <KinLedger.json> --out <SceneKin.json> [--tier 1|2|3] [--priors <dir>]
// What it is. The second binder (bind-kin2.mjs, janus#34, unchanged) is the PAGE LAYER: every end it ties is kept as it is. The scene layer fills only the ends that layer left as typed gaps, from a model of the scene the kin word is in:
//   SCENE   a run of paragraphs sharing participants: a hard break at a chapter heading; a soft break at a paragraph that names beings none of which was named in the last W paragraphs of the scene (W derived, derive-scene-params.mjs).
//           Setting is NOT read (the only list-free signals of a place are indistinguishable from persons in the reader's ledger); a declared limit.
//   ROSTER  the beings the ledger names in the scene, with a GENDER VOTE (a patronymic's suffix class; the past-tense ending -л / -ла of the first verb after the name's mention; a pronoun's gender is read from the pronoun giver) and a PERSON test
//           (a being is a person for a rule only if it has gender evidence or has been a clause subject before: the ledger holds places too).
//   FOCUS   the chain of clause subjects: a sentence's subject is its first being (not after a preposition, not inside speech) before its first verb, or the speaker of an attribution, or a third-person subject pronoun resolved to the
//           most recent earlier sentence of the scene with a gender-compatible being (the subject of that sentence preferred; two compatible and none the subject is a gap). The topic carries across sentences and paragraphs of the scene.
//   STORE   the two-ended ties the PAGE LAYER made earlier in the scene (what the page has said of them).
// Rules (tier 1 = S-PRON; tier 2 adds S-SUBJ, S-TOPIC; tier 3 adds K-KNOWN, S-OTHER). A rule never replaces a tie the page layer made; a tied end never equals the other end.
//   S-PRON   a possessive pronoun the page layer could not resolve (antecedent absent or ambiguous in sentence, previous sentence, previous paragraph) is resolved through the scene (reflexive «свой»: the clause's subject).
//   S-SUBJ   a kin word with no marker: the possessor is the clause's subject, when it stands before the kin word in the same sentence.
//   S-TOPIC  a kin word with no marker and no subject before it in its sentence: the possessor is the scene's topic (the subject of the nearest earlier sentence that has one).
//   K-KNOWN  a kin word whose possessor is tied and whose holder is not: the scene's store holds one fact of the same relation with that possessor.
//   S-OTHER  a kin word whose possessor is tied and whose holder is not: the one other person named in the sentence (else the paragraph) whose gender does not contradict the kin word's sex; two or more is a gap.
// No name list, no model, no network, nothing downloaded; the givers are the ones the binders read (the ledger's beings, pos-rus, pronoun-ru, person-lexicon-ru, kin-lexicon, name-parts-ru).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GAP_KINDS, opinionSlot, makeFact } from "../../native/organs/kinship.js";
import { bindKin as bindKin2, loadPriors, REASONS as PAGE_REASONS } from "./bind-kin2.mjs";

export const SCENE_SCHEMA = "SceneKin@1";
export const PARAMS = Object.freeze({
  W: 3,                    // a being named in the last W paragraphs of a scene keeps the scene going; DERIVED by derive-scene-params.mjs (the real recurrence gain over a shuffled-paragraph null peaks at 3) from the three spent windows
});
export const SCENE_REASONS = Object.freeze([...PAGE_REASONS, "scene_no_topic", "scene_bare_in_speech", "scene_ambiguous", "scene_holder_ambiguous", "scene_holder_none", "scene_known_ambiguous"]);

const here = path.dirname(fileURLToPath(import.meta.url));
const foldRu = (s) => s.normalize("NFC").toLowerCase().replace(/́/g, "").replace(/ё/g, "е");
const PATRO = /^(.*?)(ович|евич|ьевич|ич|овн|евн|ичн)(а|у|е|ем|ом|ы|ой|ою)?$/, PATRO_F = /(овн|евн|ичн)/;
const HARD = /[.;:!?]/;
const HEADING = /^\s*[IVXLC]+\.\s*$/, SKIPLINE = /^\s*(↑|#)/;
const topKey = (o) => { let best = null, n = 0; for (const [k, v] of Object.entries(o)) if (v > n || (v === n && best !== null && k < best)) { best = k; n = v; } return best; };

/** The narrative paragraphs of a text: non-empty lines that are not footnotes or chapter headings; `heading` marks the first one after a chapter heading. Pure. */
export function paragraphsOf(text) {
  const paras = []; let p = 0, afterHeading = true;
  text.split("\n").forEach((line, k) => {
    const from = p, to = p + line.length; p += line.length + 1;
    if (HEADING.test(line)) { afterHeading = true; return; }
    if (!line.trim() || SKIPLINE.test(line)) return;
    paras.push({ idx: paras.length, line: k, from, to, heading: afterHeading }); afterHeading = false;
  });
  return paras;
}

/** prepare({text, ledger, extraction, priors}) -> the heavy structures (tokens, mentions, dialogue, sentences, genders) and the page layer's output; pure. */
export function prepare({ text, ledger, extraction, priors }) {
  const base = bindKin2({ text, ledger, extraction, priors, tier: 2 });
  const lex = priors.lexicon;
  const posOf = (f, raw) => { const e = priors.pos.forms[raw] ?? priors.pos.forms[f]; return e ? topKey(e) : null; };
  const sumDict = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = (o[k] ?? 0) + v; return o; };
  const foldTable = (forms, merge) => { const out = new Map(); for (const k of Object.keys(forms).sort()) { const f = foldRu(k); out.set(f, out.has(f) ? merge(out.get(f), forms[k]) : forms[k]); } return out; };
  const personTab = foldTable(priors.person.forms, (a) => a), pronTab = foldTable(priors.pronoun.forms, (a, b) => ({ gender: sumDict(a.gender, b.gender), number: sumDict(a.number, b.number) }));
  const personOf = (f) => personTab.get(f) ?? null, pron3 = (f) => pronTab.get(f) ?? null;
  const possessiveOf = (t) => { const p = personOf(t.f); return p && p.kind === "possessive" ? p : null; };
  // ---- tokens, paragraphs, sentences (as bind-kin2.mjs reads them)
  const toks = []; { const re = /\p{L}+/gu; let m, bytePos = 0, prevEnd = 0;
    while ((m = re.exec(text))) { bytePos += Buffer.byteLength(text.slice(prevEnd, m.index)); const bs = bytePos; bytePos += Buffer.byteLength(m[0]); prevEnd = m.index + m[0].length;
      const raw = m[0]; toks.push({ i: toks.length, raw, f: foldRu(raw), s: m.index, e: prevEnd, bs, be: bytePos, cap: raw[0] !== raw[0].toLowerCase(), pos: posOf(foldRu(raw), raw.toLowerCase()), mention: null, para: 0, pnum: 0, sent: 0, pi: -1 }); } }
  const tokAtByte = new Map(toks.map((t) => [t.bs, t.i]));
  // a verb: the part-of-speech prior says so, or (the prior has no entry) it is a lower-case word of a past-tense ending class (-л, -ла, -ли, -ло, -лся, -лась, -лись), at least four letters: a closed morphological class, as the patronymic suffixes are
  const isVerb = (t) => t.pos === "VERB" || (t.pos == null && !t.cap && t.raw.length >= 4 && /(?:[аио]л|ла|ли|ло|лся|лась|лись)$/.test(t.f));
  const tokFrom = (c) => { let lo = 0, hi = toks.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (toks[mid].e <= c) lo = mid + 1; else hi = mid; } return lo; };
  const tokRange = (a, b) => { const out = []; for (let k = tokFrom(a); k < toks.length && toks[k].s < b; k++) if (toks[k].s >= a && toks[k].e <= b) out.push(toks[k]); return out; };
  const paraStart = []; { let p = 0; for (const line of text.split("\n")) { paraStart.push(p); p += line.length + 1; } }
  const paraEnd = (k) => (k + 1 < paraStart.length ? paraStart[k + 1] - 1 : text.length);
  const lineOf = (c) => { let lo = 0, hi = paraStart.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (paraStart[mid] <= c) lo = mid; else hi = mid - 1; } return lo; };
  const pnumOfLine = []; { let n = -1; for (let k = 0; k < paraStart.length; k++) { if (text.slice(paraStart[k], paraEnd(k)).trim()) n++; pnumOfLine.push(n); } }
  const paras = paragraphsOf(text), piOfLine = new Map(paras.map((q) => [q.line, q.idx]));
  const beings = new Set(ledger.referents.filter((r) => r.standing === "referent").map((r) => r.id));
  const spans = ledger.spans.filter((s) => s.kind === "name" && s.ref && beings.has(s.ref)).slice().sort((a, b) => a.at[0] - b.at[0] || (b.at[1] - b.at[0]) - (a.at[1] - a.at[0]));
  const mentions = []; { let end = -1; for (const s of spans) { if (s.at[0] < end) continue; end = s.at[1]; mentions.push({ ref: s.ref, s: s.at[0], e: s.at[1], bs: s.bytes[0], be: s.bytes[1], text: s.text, first: -1, last: -1 }); } }
  for (const mn of mentions) { let k = tokFrom(mn.s); mn.first = k; while (k < toks.length && toks[k].s < mn.e) { toks[k].mention = mn; k++; } mn.last = k - 1; }
  { let sent = 0, lastLine = -1; for (const t of toks) { t.para = lineOf(t.s); t.pnum = pnumOfLine[t.para]; t.pi = piOfLine.get(t.para) ?? -1; if (t.para !== lastLine) { sent++; lastLine = t.para; } t.sent = sent;
      const nx = toks[t.i + 1]; if (nx && lineOf(nx.s) === t.para) { const gap = text.slice(t.e, nx.s); if (/[.!?…]["»”)]*\s+(?:[—–]\s*)?$/.test(gap) && (nx.cap || /[—–]\s*$/.test(gap))) sent++; } } }
  // ---- the dialogue structure (as bind-kin2.mjs: parts split at " — " after punctuation; an attribution follows speech and is lower-case)
  const dialogue = new Map();
  function dialogueOf(k) {
    if (dialogue.has(k)) return dialogue.get(k);
    const pt = text.slice(paraStart[k], paraEnd(k)), base_ = paraStart[k]; let d = null;
    if (/^\s*[—–]/.test(pt)) {
      const cuts = []; { const re = /(?<=[,.!?…:;»”"])\s[—–]\s/g; let m; while ((m = re.exec(pt))) cuts.push([m.index, m.index + m[0].length]); }
      const raw = []; let prev = pt.search(/[—–]/) + 1; for (const [a, b] of cuts) { if (a >= prev) { raw.push([prev, a]); prev = b; } } raw.push([prev, pt.length]);
      const parts = raw.filter(([a, b]) => b > a).map(([a, b]) => ({ from: base_ + a, to: base_ + b, kind: "speech" }));
      for (let q = 1; q < parts.length; q++) { const first = tokRange(parts[q].from, parts[q].to)[0]; if (first && !first.cap && parts[q - 1].kind === "speech") parts[q].kind = "attr"; }
      for (const part of parts) if (part.kind === "attr") {
        const ts = tokRange(part.from, part.to); let spk = null, sawPronoun = false;
        for (const t of ts.slice(1)) { if (!t.mention && pron3(t.f)) { if (!spk) sawPronoun = true; continue; } if (t.mention && t.mention.first === t.i) { if (!spk && !sawPronoun) spk = t.mention; break; } }
        part.speaker = spk;
      }
      d = { parts };
    }
    dialogue.set(k, d); return d;
  }
  const partAt = (c) => { const d = dialogueOf(lineOf(c)); return d ? d.parts.find((p) => c >= p.from && c < p.to) ?? null : null; };
  for (const t of toks) { const pt = partAt(t.s); t.speech = !!pt && pt.kind === "speech"; t.attr = pt && pt.kind === "attr" ? pt : null; }
  // ---- gender vote per being: a patronymic's suffix class, the past-tense ending of the first verb after a mention of it, and (for the page layer's own ties) nothing else
  const gv = new Map(); const vote = (ref, g, w) => { const o = gv.get(ref) ?? gv.set(ref, { Masc: 0, Fem: 0 }).get(ref); o[g] += w; };
  for (const mn of mentions) {
    for (let k = mn.first + 1; k <= mn.last; k++) if (PATRO.test(toks[k].f)) vote(mn.ref, PATRO_F.test(toks[k].f) ? "Fem" : "Masc", 3);
    if (toks[mn.first - 1]?.pos === "ADP") continue;                                   // a name after a preposition is in an oblique case and often a place: no verb-agreement vote
    for (let k = mn.last + 1, n = 0; k < toks.length && n < 4; k++, n++) { const t = toks[k]; if (t.mention || HARD.test(text.slice(toks[k - 1].e, t.s))) break;
      if (isVerb(t)) { if (/(ла|лась)$/.test(t.f)) vote(mn.ref, "Fem", 1); else if (/(л|лся)$/.test(t.f)) vote(mn.ref, "Masc", 1); break; } }
  }
  const genderOf = (ref) => { const o = gv.get(ref); if (!o || o.Masc === o.Fem) return null; return o.Masc > o.Fem ? "Masc" : "Fem"; };
  // ---- sentence structures: the clause subject proxy and the beings named in narration (centres) and in speech (present)
  const sents = new Map();
  for (const t of toks) { if (t.pi < 0) continue; let S = sents.get(t.sent); if (!S) { S = { sid: t.sent, pi: t.pi, tokens: [] }; sents.set(t.sent, S); } S.tokens.push(t.i); }
  const gapBetween = (a, b) => text.slice(toks[a].e, toks[b].s);
  for (const S of sents.values()) {
    const nar = S.tokens.filter((i) => !toks[i].speech); S.nar = nar;
    const named = []; for (const i of nar) { const t = toks[i]; if (t.mention && t.mention.first === i) named.push({ ref: t.mention.ref, i, mention: t.mention, adp: toks[i - 1]?.pos === "ADP" }); }
    S.present = [...new Set([...named.map((x) => x.ref), ...S.tokens.filter((i) => toks[i].speech && toks[i].mention && toks[i].mention.first === i).map((i) => toks[i].mention.ref)])];
    S.named = named;
    // clauses: the narration of the sentence cut at a comma, semicolon, colon or dash; each clause has its own subject proxy: the first PERSON being before its first verb that is not after a preposition,
    // else a third-person subject pronoun (sentence- or clause-initial: only conjunctions, particles and adverbs before it; not a possessive; a gender of its own; no noun after it); an attribution's subject is its speaker
    const attr = S.tokens.map((i) => toks[i].attr).find((x) => x && x.speaker), segs = [];
    if (attr) segs.push({ tokens: nar, subj: { ref: attr.speaker.ref, mention: attr.speaker, i: attr.speaker.first, via: "name" } });
    else { let cur = []; const cut = []; for (const i of nar) { if (cur.length && /[,;:—–]/.test(gapBetween(cur[cur.length - 1], i))) { cut.push(cur); cur = []; } cur.push(i); } if (cur.length) cut.push(cur);
      const SKIP = new Set(["CCONJ", "SCONJ", "PART", "ADV", "INTJ"]);
      for (const tokens of cut) { const firstVerb = tokens.find((i) => isVerb(toks[i])) ?? Infinity; let subj = null;
        const nm = named.find((x) => tokens.includes(x.i) && x.i < firstVerb && !x.adp && genderOf(x.ref));
        if (nm) subj = { ref: nm.ref, i: nm.i, mention: nm.mention, via: "name" };
        else { let pr = null; for (const i of tokens) { if (i >= firstVerb) break; const t = toks[i]; if (t.mention) break;
            const q = pron3(t.f), g = q ? topKey(Object.fromEntries(Object.entries(q.gender).filter(([x]) => x !== "_"))) : null, nx = toks[i + 1];
            if (t.pos === "PRON" && g && (g === "Masc" || g === "Fem") && !possessiveOf(t) && !(nx && ["NOUN", "ADJ", "PROPN"].includes(nx.pos))) { pr = i; break; }
            if (!SKIP.has(t.pos)) break; }
          if (pr != null) subj = { ref: null, i: pr, via: "pronoun", token: toks[pr] }; }
        segs.push({ tokens, subj }); } }
    S.segs = segs;
  }
  return { text, base, lex, toks, tokAtByte, mentions, paras, sents: [...sents.values()].sort((a, b) => a.sid - b.sid), gapBetween, genderOf, pron3, personOf, possessiveOf, posOf, partAt, extraction, priors };
}

/** The scene segmentation: a list of {from, to} paragraph indexes (inclusive). */
export function segment(P, W = PARAMS.W) {
  const { paras, toks } = P, beingsIn = paras.map(() => new Set());
  for (const t of toks) if (t.pi >= 0 && t.mention && t.mention.first === t.i) beingsIn[t.pi].add(t.mention.ref);
  const scenes = []; let cur = null;
  paras.forEach((p, k) => {
    let brk = !cur || p.heading;
    if (!brk && beingsIn[k].size) { const active = new Set(); for (let q = Math.max(cur.from, k - W); q < k; q++) for (const r of beingsIn[q]) active.add(r); if (active.size && ![...beingsIn[k]].some((r) => active.has(r))) brk = true; }
    if (brk) { cur = { id: scenes.length, from: k, to: k }; scenes.push(cur); } else cur.to = k;
  });
  return scenes;
}

/** apply(P, {tier, mode, scenes, sigma, snaps0}) -> the scene layer over the page layer.
 *  mode "scene": the model (the state carries on through the scene); "paragraph": the same rules with the state cut to the paragraph and the one before (A0, the page-only variant);
 *  "shuffled": at every paragraph start the state of ANOTHER scene's paragraph, `sigma[k]`, taken from the real pass's `snaps0`, replaces the real one (the shuffled-scene control). */
export function apply(P, { tier = 3, mode = "scene", scenes = null, sigma = null, snaps0 = null } = {}) {
  const { toks, sents, paras, base, genderOf, pron3, personOf, possessiveOf, gapBetween, lex } = P;
  scenes ??= segment(P);
  const sceneOfPara = new Array(paras.length); for (const s of scenes) for (let k = s.from; k <= s.to; k++) sceneOfPara[k] = s;
  const sentsOfPara = new Map(); for (const S of sents) (sentsOfPara.get(S.pi) ?? sentsOfPara.set(S.pi, []).get(S.pi)).push(S);
  const compat = (ref, g) => { const x = genderOf(ref); return !g || !x || (g === "Neut" ? x === "Masc" : x === g); };
  const gOfPron = (f) => { const q = pron3(f); return q ? topKey(Object.fromEntries(Object.entries(q.gender).filter(([x]) => x !== "_"))) : null; };
  const isPerson = { has: (ref) => !!genderOf(ref) };   // a being is a person for a rule only with gender evidence (a patronymic; a past-tense verb agreeing with a mention not after a preposition): the ledger holds places too
  const out = base.statements.map((s) => ({ ...s, holder: { ...s.holder }, possessor: { ...s.possessor }, uses: [] }));
  const stmtsBySent = new Map(); out.forEach((s, k) => { const ti = P.tokAtByte.get(s.termAt[0]); if (ti == null) return; (stmtsBySent.get(toks[ti].sent) ?? stmtsBySent.set(toks[ti].sent, []).get(toks[ti].sent)).push({ k, ti }); });
  const empty = () => ({ topic: null, recent: [] });
  const clone = (x) => ({ topic: x.topic, recent: x.recent.slice() });
  let st = empty(), store = [], paraOwn = empty(), curPara = -1, curScene = null; const snaps = new Map(), ownByPara = new Map();
  const bindEnd = (rec, end, ref, mention, rule, usedAt) => { rec[end] = { ref, rule, mention: [mention.bs, mention.be], text: mention.text }; rec.uses.push([mention.bs, mention.be]); if (usedAt) rec.uses.push(usedAt); };
  // the nearest earlier sentence of the state with a compatible being (the extra row first: the current sentence up to the pronoun); the subject of that sentence preferred; two compatible and none the subject is a gap
  const resolvePron = (rows, gender, exclude) => {
    for (const r of rows) { const cs = r.centres.filter((c) => !exclude.has(c.ref) && isPerson.has(c.ref) && compat(c.ref, gender)); if (!cs.length) continue;
      const refs = [...new Set(cs.map((c) => c.ref))]; if (refs.length === 1) return { c: cs[0] }; const sj = cs.find((c) => r.subj && c.ref === r.subj.ref); return sj ? { c: sj } : { gap: "scene_ambiguous" }; }
    return { gap: "scene_no_topic" };
  };
  for (const S of sents) {
    if (S.pi !== curPara) {                         // a paragraph starts: the state is the scene's, the previous paragraph's, or another scene's, by mode
      if (curPara >= 0) ownByPara.set(curPara, paraOwn);
      paraOwn = empty(); const sc = sceneOfPara[S.pi], newScene = sc !== curScene; curScene = sc; curPara = S.pi;
      if (mode === "scene") { if (newScene) { st = empty(); store = []; } }
      else if (mode === "paragraph") { const prev = !paras[S.pi].heading ? ownByPara.get(S.pi - 1) : null; st = prev ? clone(prev) : empty(); store = []; }
      else { const sn = snaps0.get(sigma[S.pi]); st = sn ? clone(sn) : empty(); store = sn ? sn.store.slice() : []; }
      snaps.set(S.pi, { ...clone(st), store: store.slice() });
    }
    // the clause subjects of the sentence, in order (a pronoun is resolved through the state before the sentence and the beings of this sentence before it)
    const subjs = [];
    for (const seg of S.segs) { if (!seg.subj) continue; let x = { ...seg.subj };
      if (x.via === "pronoun") { const before = [...subjs.map((y) => ({ ref: y.ref, mention: y.mention })), ...S.named.filter((y) => y.i < x.i).map((y) => ({ ref: y.ref, mention: y.mention }))];
        const r = resolvePron([{ centres: before, subj: subjs[0] ? { ref: subjs[0].ref } : null }, ...st.recent], gOfPron(x.token.f), new Set()); x = r.c ? { ref: r.c.ref, mention: r.c.mention, i: x.i, via: "pronoun" } : null; }
      if (x && x.ref) subjs.push(x); }
    const subj = subjs[0] ?? null, subjBefore = (pos) => subjs.filter((x) => x.i < pos).pop() ?? null;
    for (const { k, ti } of stmtsBySent.get(S.sid) ?? []) {
      const rec = out[k], T = toks[ti], term = lex.atoms[rec.term] ?? null, speech = T.speech;
      // ---- possessor
      if (!rec.possessor.ref && tier >= 1) {
        const why = rec.possessor.gap;
        if ((why === "antecedent_absent" || why === "antecedent_ambiguous") && !speech) {
          const HOLD = ["NOUN", "VERB", "ADP", "CCONJ", "SCONJ", "PRON"]; let det = null;
          if (toks[ti + 1] && possessiveOf(toks[ti + 1]) && /^[\s,]*$/.test(gapBetween(ti, ti + 1))) det = toks[ti + 1];
          else for (let q = ti - 1; q >= 0 && ti - q <= 3; q--) { if (/[.;:!?—–]/.test(gapBetween(q, q + 1)) || toks[q].mention) break; if (possessiveOf(toks[q])) { det = toks[q]; break; } if (HOLD.includes(toks[q].pos)) break; }
          if (det) { const pr = personOf(det.f), refl = pr && pr.person === "refl";
            if (refl) { const sj = subjBefore(det.i); if (sj && sj.ref !== rec.holder.ref) bindEnd(rec, "possessor", sj.ref, sj.mention, "S-PRON", [det.bs, det.be]); }
            else { const before = S.named.filter((x) => x.i < det.i).map((x) => ({ ref: x.ref, mention: x.mention })), sj = subjBefore(det.i) ? { ref: subjBefore(det.i).ref, mention: subjBefore(det.i).mention } : null;
              const cur = { centres: sj ? [sj, ...before.filter((x) => x.ref !== sj.ref)] : before, subj: sj };
              const r = resolvePron([cur, ...st.recent], gOfPron(det.f), new Set(rec.holder.ref ? [rec.holder.ref] : []));
              if (r.c) bindEnd(rec, "possessor", r.c.ref, r.c.mention, "S-PRON", [det.bs, det.be]); else rec.possessor = { ref: null, gap: r.gap }; } }
        } else if (why === "no_marker" && tier >= 2) {
          const sb = subjBefore(ti);
          if (speech) rec.possessor = { ref: null, gap: "scene_bare_in_speech" };
          else if (sb) { if (sb.ref !== rec.holder.ref) bindEnd(rec, "possessor", sb.ref, sb.mention, "S-SUBJ", sb.via === "pronoun" ? [toks[sb.i].bs, toks[sb.i].be] : null); }
          else if (!st.topic) rec.possessor = { ref: null, gap: "scene_no_topic" };
          else if (st.topic.ref !== rec.holder.ref) bindEnd(rec, "possessor", st.topic.ref, st.topic.mention, "S-TOPIC", null);
        }
      }
      // ---- holder
      if (!rec.holder.ref && rec.possessor.ref && tier >= 3 && !speech && term) {
        const Pr = rec.possessor.ref, sexOk = (ref) => !term.sex || compat(ref, term.sex === "male" ? "Masc" : "Fem");
        const pc = term.rel === "parent_of" ? (term.end === "a" ? (f) => (f.child === Pr ? f.parent : null) : (f) => (f.parent === Pr ? f.child : null)) : (f) => (f.a === Pr ? f.b : f.b === Pr ? f.a : null);
        const rows = store.filter((f) => f.rel === term.rel).map((f) => ({ f, x: pc(f) })).filter((q) => q.x && q.x !== Pr && sexOk(q.x)), refs = [...new Set(rows.map((q) => q.x))];
        if (refs.length === 1) bindEnd(rec, "holder", refs[0], rows.find((q) => q.x === refs[0]).f.mention, "K-KNOWN", null);
        else if (refs.length > 1) rec.holder = { ref: null, gap: "scene_known_ambiguous" };
        else {
          const cand = (list) => [...new Set(list)].filter((r) => r !== Pr && isPerson.has(r) && sexOk(r));
          let cs = cand(S.present), pool = S.named; if (!cs.length) { const par = sentsOfPara.get(S.pi); cs = cand(par.flatMap((x) => x.present)); pool = par.flatMap((x) => x.named); }
          if (cs.length === 1) { const hit = pool.find((x) => x.ref === cs[0]); if (hit) bindEnd(rec, "holder", cs[0], hit.mention, "S-OTHER", null); else rec.holder = { ref: null, gap: "scene_holder_none" }; }
          else rec.holder = { ref: null, gap: cs.length > 1 ? "scene_holder_ambiguous" : "scene_holder_none" };
        }
      }
      if (rec.holder.ref && rec.possessor.ref && rec.holder.ref === rec.possessor.ref) rec.possessor = { ref: null, gap: "one_referent_both_ends" };
      // the store: what the PAGE LAYER tied at both ends, for the sentences after this one
      const b0 = base.statements[k];
      if (b0.holder.ref && b0.possessor.ref && term) { const h = b0.holder.ref, p = b0.possessor.ref, mention = { bs: b0.holder.mention[0], be: b0.holder.mention[1], text: b0.holder.text };
        store.push(term.rel === "parent_of" ? (term.end === "a" ? { rel: "parent_of", parent: h, child: p, mention } : { rel: "parent_of", parent: p, child: h, mention }) : { rel: term.rel, a: h, b: p, mention }); }
    }
    // the state after this sentence: its subject first, then the other beings it names; the topic is the latest subject
    const centres = []; if (subj && subj.ref) centres.push({ ref: subj.ref, mention: subj.mention });
    for (const x of S.named) if (!centres.some((c) => c.ref === x.ref)) centres.push({ ref: x.ref, mention: x.mention });
    const row = { centres, subj: subj && subj.ref ? { ref: subj.ref, mention: subj.mention } : null };
    st.recent.unshift(row); paraOwn.recent.unshift(row); if (row.subj) { st.topic = row.subj; paraOwn.topic = row.subj; }
  }
  return { ...assemble(P, out, tier), snaps };
}

// ---- facts, typed gaps and opinion slots (as bind-kin2.mjs assembles them), over the scene layer's records
function assemble(P, recs, tier) {
  const { base, lex, text } = P, specs = [], statements = [];
  const slotFor = (term, rec, end) => { const h = end === "holder" ? "?" : rec.holder.ref ?? "?", p = end === "possessor" ? "?" : rec.possessor.ref ?? "?";
    if (!term) return { rel: "term", term: rec.term, a: h, b: p }; if (term.rel === "parent_of") return term.end === "a" ? { rel: "parent_of", a: h, b: p } : { rel: "parent_of", a: p, b: h }; return { rel: term.rel, a: h, b: p }; };
  recs.forEach((rec, pos) => {
    const term = lex.atoms[rec.term] ?? null, gaps = [];
    for (const end of ["holder", "possessor"]) if (!rec[end].ref) {
      const kind = term ? (term.rel === "parent_of" ? "no_parent_fact" : term.rel === "sibling_of" ? "no_sibling_fact" : "no_spouse_fact") : "no_rule_giver";
      const slot = slotFor(term, rec, end), gap = { kind, slot, why: rec[end].gap, end, opinionFillable: GAP_KINDS[kind].opinionFillable };
      if (gap.opinionFillable && term) gap.opinionSlot = opinionSlot({ term: rec.term, of: (end === "holder" ? rec.possessor.ref : rec.holder.ref) ?? "?", statement: `ru#${rec.termAt[0]}-${rec.termAt[1]}` }, { kind, slot });
      else if (!term) gap.opinionSlotAbsent = "a stated composite term is not fileable through kinship.js fileOpinion";
      gaps.push(gap);
    }
    let fact = null;
    if (rec.holder.ref && rec.possessor.ref) {
      const usesBase = base.statements[pos], pageUses = [];
      for (const end of ["holder", "possessor"]) if (usesBase[end].ref && usesBase[end].ref === rec[end].ref) pageUses.push(usesBase[end].mention);
      const all = [...rec.uses, ...pageUses, ...(rec.holder.mention ? [rec.holder.mention] : []), ...(rec.possessor.mention ? [rec.possessor.mention] : [])];
      const lo = Math.min(rec.termAt[0], ...all.map((u) => u[0])), hi = Math.max(rec.termAt[1], ...all.map((u) => u[1]));
      const giver = `text:ru|rule:${[...new Set([rec.holder.rule, rec.possessor.rule])].sort().join("+")}`, witness = `ru#${lo}-${hi}`, h = rec.holder.ref, p = rec.possessor.ref, sp = [];
      if (term) { sp.push(term.rel === "parent_of" ? (term.end === "a" ? { rel: "parent_of", a: h, b: p } : { rel: "parent_of", a: p, b: h }) : { rel: term.rel, a: h, b: p }); if (term.sex) sp.push({ rel: "sex", a: h, value: term.sex }); }
      else sp.push({ rel: "term", term: rec.term, a: h, b: p });
      for (const x of sp) Object.assign(x, { giver, witness, standing: "candidate" });
      for (const x of sp) { const r = makeFact(x); if (r.refused) throw new Error(`scene-kin: makeFact refused its own spec (${r.refused})`); }
      specs.push(...sp); fact = { giver, witness, specs: sp.length };
    }
    statements.push({ i: rec.i, term: rec.term, lemma: rec.lemma, termAt: rec.termAt, plain: rec.plain, holder: rec.holder, possessor: rec.possessor, fact, gaps });
  });
  const n = (f) => statements.filter(f).length;
  return { schema: SCENE_SCHEMA, tier, params: PARAMS, text_sha256: base.text_sha256, ledger_text_sha256: base.ledger_text_sha256,
    counts: { statements: statements.length, facts: n((s) => s.fact), holders_bound: n((s) => s.holder.ref), possessors_bound: n((s) => s.possessor.ref), gaps: statements.reduce((a, s) => a + s.gaps.length, 0) }, statements, specs };
}

/** sceneKin({text, ledger, extraction, priors, tier}) -> SceneKin@1 (the model: scene mode). */
export function sceneKin({ text, ledger, extraction, priors, tier = 3 }) { const P = prepare({ text, ledger, extraction, priors }), scenes = segment(P), { snaps, ...res } = apply(P, { tier, scenes }); return { ...res, scenes }; }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
  const { extract } = await import("./extract-kin.mjs");
  const textPath = arg("text"), ledgerPath = arg("ledger"), outPath = arg("out"), tier = +arg("tier", 3);
  if (!textPath || !ledgerPath || !outPath) { console.error("usage: node scene-kin.mjs --text <text> --ledger <KinLedger.json> --out <SceneKin.json> [--tier 1|2|3] [--priors <dir>]"); process.exit(2); }
  const priors = loadPriors(arg("priors") ?? undefined), text = fs.readFileSync(textPath, "utf8"), ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
  const extraction = extract({ text, lang: "ru", lexicon: priors.lexicon, namePartsRu: priors.nameParts });
  const res = sceneKin({ text, ledger, extraction, priors, tier });
  fs.writeFileSync(outPath, JSON.stringify(res, null, 1) + "\n");
  console.log(JSON.stringify(res.counts));
}
