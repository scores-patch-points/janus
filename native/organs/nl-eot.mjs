// nl-eot.mjs — any language -> its grammar -> EOT -> back to any language through its grammar.
//
// THE LAW (memory: NL -> grammar -> EOT -> back). Matching and reasoning happen in EOT, the meaning layer khora's eot-rich.js builds:
// content nodes, cube-addressed relations and features, function words absorbed as cube-addressed markers, NO word order and NO surface
// form. Each language contributes its GRAMMAR, received from its Universal Dependencies treebank by khora/native/scripts/train-ud-language.mjs:
//   in   UDParser@1 + UDTokenizer@1   text -> tokens -> lemma, class, features, head, relation        (khora ud-parser.js, ud-tokenizer.js)
//   out  UDGrammar@1                  the measured order parameters, the form table, the marker table  (the way back)
// A language with no grammar is a TYPED GAP, never a guess. Nothing here calls a model; every loss is measured and reported.
//
// Crossing languages: a content node's lemma is carried by a CORRESPONDENCE (janus identity/correspond.mjs, or a giver's declared key);
// with none, the node is written in its source lemma and counted as the gap `no_correspondence`. A marker is re-realized from its relation,
// its host's class and its features by the TARGET grammar's marker table (the English "of" becomes what the target spends on that relation);
// with no entry, the gap `no_marker`. A form the target's form table and lexicon never attested is written as its lemma, gap `form_unattested`.
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { loadModel, analyse } from '../../../khora/native/adapters/text/ud-parser.js';
import { tokenize, sentences } from '../../../khora/native/adapters/text/ud-tokenizer.js';
import { toEot, annotationFromMeaning, linearize, kendallTau, ABSORBED } from '../../../khora/native/kernel/eot-rich.js';
import { normFeats } from '../../../khora/native/kernel/eot-realize.js';

export const PRIORS = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../priors');
const gz = (p) => JSON.parse(zlib.gunzipSync(fs.readFileSync(p)));
const base = (d) => String(d).split(':')[0];

/** loadGrammar(code) — a language's grammar both ways, or a typed gap. `code` is ISO 639-3 as the priors are named. */
export function loadGrammar(code, { priors = PRIORS, workspace = path.resolve(priors, '../..') } = {}) {
  const files = fs.readdirSync(priors);
  const parserFile = files.find((f) => f.startsWith(`ud-parser-${code}-`) && f.endsWith('.json.gz'));
  const grammarFile = files.find((f) => f === `ud-grammar-${code}.json.gz`);
  if (!parserFile && !grammarFile) return { code, gap: 'no_grammar', why: `no UDParser or UDGrammar prior for ${code} in ${priors}` };
  const out = { code, parser: null, tokenizer: null, grammar: null, lexInverse: null, gaps: [] };
  if (parserFile) {
    const json = gz(path.join(priors, parserFile)); let lex = null;
    if (json.meta?.lexicon) { const p = path.resolve(workspace, json.meta.lexicon); if (fs.existsSync(p)) { const text = p.endsWith('.gz') ? null : fs.readFileSync(p, 'utf8'); if (text) { const m = new Map(); for (const line of text.split('\n')) { const c = line.split('\t'); if (c.length < 3) continue; const pos = c[2].split(';')[0]; for (const f of [c[1], c[0]]) { const k = f.toLowerCase(); const set = m.get(k) ?? new Set(); set.add(pos); m.set(k, set); } } lex = new Map([...m].map(([k, v]) => [k, [...v].sort().join('|')])); } } else out.gaps.push({ gap: 'lexicon_absent', named: json.meta.lexicon }); }
    out.parser = loadModel(json, { lex }); out.parserMeta = json.meta;
    const inv = new Map(); for (const [k, v] of Object.entries(json.lexicon?.form ?? {})) { const [form, upos] = [k.slice(0, k.lastIndexOf('|')), k.slice(k.lastIndexOf('|') + 1)]; const [lemma, feats] = v.split('\t'); const key = `${upos}|${lemma}|${normFeats(feats)}`; if (!inv.has(key)) inv.set(key, form); } out.lexInverse = inv;
    const tokFile = files.find((f) => f === `ud-tokenizer-${code}.json.gz`); if (tokFile) out.tokenizer = gz(path.join(priors, tokFile)); else out.gaps.push({ gap: 'tokenizer_absent' });
  } else out.gaps.push({ gap: 'parser_absent', why: 'this language can be written to, not read from' });
  if (grammarFile) out.grammar = gz(path.join(priors, grammarFile)); else out.gaps.push({ gap: 'grammar_absent', why: 'this language can be read from, not written to' });
  return out;
}

/** read(G, text) — text in G's language -> EOT records (one per sentence), through G's tokenizer and parser. */
export function read(G, text, { locale = 'und' } = {}) {
  if (G.gap) return { gap: G.gap, records: [] };
  if (!G.parser) return { gap: 'parser_absent', records: [] };
  const records = [];
  // khora's one sentence cut, told this language's measured abbreviations by its own tokenizer prior (ud-tokenizer.js)
  for (const s of sentences(text, locale, G.tokenizer)) {
    const forms = tokenize(s, G.tokenizer); if (!forms.length) continue;
    const rows = analyse(G.parser, forms).map((r) => ({ ...r, head: r.head < 0 ? 0 : r.head }));
    const sent = { tokens: rows, lines: [], comments: [], multi: [], empty: [], sentId: null, text: s };
    records.push(toEot(sent, { language: G.code }));
  }
  return { records, gaps: records.flatMap((r) => r.gaps) };
}

/** write(record, G, { from, lemmaMap }) — an EOT record -> text in G's language through G's grammar. `from` is the record's language;
 *  `lemmaMap` carries content lemmas across (Map "lemma|UPOS" -> "lemma|UPOS" in G); same language needs neither. */
export function write(record, G, { from = null, lemmaMap = null } = {}) {
  if (G.gap) return { gap: G.gap, text: null };
  if (!G.grammar) return { gap: 'grammar_absent', text: null };
  const rows = annotationFromMeaning(record); const byKey = new Map(rows.map((r) => [r.key, r]));
  const crossing = from && from !== G.code; const gaps = []; const out = new Map();
  for (const r of rows) {
    let lemma = String(r.lemma ?? ''), upos = r.upos, feats = normFeats(r.feats); const rel = base(r.deprel);
    if (ABSORBED.has(rel)) {
      if (crossing) { const host = byKey.get(r.head); const hu = host ? host.upos : 'ROOT'; const m = G.grammar.markers?.[`${rel}|${hu}|${feats}`] ?? G.grammar.markers?.[`${rel}|${hu}`] ?? G.grammar.markers?.[rel]; if (m) { lemma = m.lemma; upos = m.upos; feats = m.feats; } else gaps.push({ gap: 'no_marker', rel, host: hu, key: r.key }); }
    } else if (crossing) {
      const to = lemmaMap?.get(`${lemma}|${upos}`) ?? lemmaMap?.get(lemma); if (to) { const i = to.lastIndexOf('|'); lemma = i > 0 ? to.slice(0, i) : to; if (i > 0) upos = to.slice(i + 1); } else gaps.push({ gap: 'no_correspondence', lemma, upos, key: r.key });
    }
    const form = G.grammar.forms?.[`${upos}|${lemma}|${feats}`] ?? G.lexInverse?.get(`${upos}|${lemma}|${feats}`) ?? null;
    if (form === null) gaps.push({ gap: 'form_unattested', lemma, upos, feats, key: r.key });
    out.set(r.key, form ?? lemma);
  }
  const order = linearize(rows, G.grammar.order ?? {});
  const tokens = order.map((k) => out.get(k)).filter((t) => t !== undefined);
  return { text: tokens.join(G.grammar.spaced === false ? '' : ' '), tokens, order, gaps };
}

/** roundTrip(G, text) — read and write in one language; the loss is what the grammar cannot carry. */
export function roundTrip(G, text) { const r = read(G, text); if (r.gap) return r; const w = r.records.map((rec) => write(rec, G)); return { records: r.records, written: w.map((x) => x.text), gaps: [...r.gaps, ...w.flatMap((x) => x.gaps ?? [])] }; }

/** measure(G, sents) — the way back scored on GOLD sentences (parseConllu's shape): order (Kendall tau), token forms, whole sentences. */
export function measure(G, sents) {
  let tau = 0, n = 0, tok = 0, tokHit = 0, exact = 0; const gapCount = {};
  for (const s of sents) {
    const rec = toEot(s, { language: G.code }); const w = write(rec, G); if (w.gap) continue; n++;
    const rows = annotationFromMeaning(rec); const goldOrder = s.tokens.filter((t) => rows.some((r) => r.key === rec.surface.keyOfId[t.id])).map((t) => rec.surface.keyOfId[t.id]);
    tau += kendallTau(w.order, goldOrder);
    const gold = s.tokens.filter((t) => base(t.deprel) !== 'punct').map((t) => t.form); const got = w.tokens;
    tok += gold.length; const bag = new Map(); for (const g of gold) bag.set(g, (bag.get(g) ?? 0) + 1); for (const g of got) { const c = bag.get(g); if (c) { tokHit++; bag.set(g, c - 1); } }
    if (gold.join(' ') === got.join(' ')) exact++;
    for (const g of w.gaps) gapCount[g.gap] = (gapCount[g.gap] ?? 0) + 1;
  }
  return { sentences: n, orderKendallTau: n ? +(tau / n).toFixed(3) : null, tokenFormHit: tok ? +(tokHit / tok).toFixed(3) : null, exactSentences: n ? +(exact / n).toFixed(3) : null, gaps: gapCount };
}
