// organs/eot-weave.mjs: THE EOT OF A TEXT, WRITTEN INTO THE PHAROS (janus's half of the reading contract, 2026-11-26/27).
// Khora writes the reading by kind (khora the-fold/pharos-framed.mjs, pharos-reading.mjs); janus never imports khora's reader for this and never calls it. It READS, by kind and addr, three entries about one text:
//   text          INS·Ground   text:<sha16>      { text, language }
//   text-codec    SIG·Pattern  codec:<sha16>     { chosen, declared, distribution, agrees, quotes, foundQuotes, ... }   which codec explains the text, and the one the read ran under
//   text-reading  INS·Figure   reading:<sha16>   { rows }                                                              khora's dependency rows (nominations)
// and decodes the text through the codec the read ran under (`declared`) to EOT with nl-eot.mjs (the codec door), and writes:
//   text-eot      SYN·Pattern  eot:<sha16>       { codec, foundCodec, agrees, quotes, records (EOTRich@1, one per sentence), gaps, readingCheck }   of [text, codec, reading]
//   text-eot-gap  NUL·Figure   eotgap:<sha16>:<gap>  { gap, why }      a typed gap: no codec entry, no declared language, no grammar for it
// THE CELL is janus's call (the contract left it open: SYN or INS at Pattern). SYN at Pattern: the EOT is the relational structure of the text under a codec, a pattern over the rows, not a first observation of them (that is INS, khora's);
// SYN at Ground is the empty desert cell and is not used. Existence and Structure only: no DEF, EVA or REC (observing is not defining); whether the EOT is a RIGHT reading is Penelope's.
// NO GUESS OF LANGUAGE: when khora's codec entry has no declared language, or the codec the surprise fold found disagrees with the declared one, the EOT is written under the DECLARED codec and says `agrees: false` and which codec was found; a text with no
// declared language gets a gap, never English. The two parses are two observations: `readingCheck` says whether janus's own parse (nl-eot read) cut the same number of sentences as khora's rows, nothing more.
// Idempotent: an entry already at the address with the same body is not written again. Pure but for the door it is told.
import { loadGrammar, read } from './nl-eot.mjs';

export const EOT_KIND = 'text-eot', EOT_GAP_KIND = 'text-eot-gap', EOT_CELL = 'SYN·Pattern', EOT_GAP_CELL = 'NUL·Figure';
export const READS = Object.freeze(['text', 'text-codec', 'text-reading']);
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v));
const latestByAddr = (es) => { const m = new Map(); for (const e of es) m.set(e.addr, e); return m; };   // log order: the last entry at an address is the live one
const tail = (addr, head) => (typeof addr === 'string' && addr.startsWith(head) ? addr.slice(head.length) : null);

/** eotOf(text, entries, { grammar }) -> { body, of } | { gap, why }  — pure: one text's EOT body from the three entries (by kind) about it. `grammar` loads a codec by code (default nl-eot loadGrammar). */
export function eotOf(sha, { text, codec, reading }, { grammar = loadGrammar } = {}) {
  if (!text?.body?.text) return { gap: 'no_text', why: `text:${sha} has no body.text` };
  if (!codec) return { gap: 'no_text_codec', why: `no text-codec entry for ${sha}: janus does not choose a language` };
  const declared = codec.body?.declared ?? null;
  if (!declared) return { gap: 'language_not_declared', why: `the text-codec entry for ${sha} declares no language (found: ${codec.body?.chosen ?? 'none'}); the EOT is not written under a guessed codec` };
  const G = grammar(declared);
  if (G.gap) return { gap: G.gap, why: G.why ?? `no codec for ${declared}` };
  const r = read(G, text.body.text);
  if (r.gap) return { gap: r.gap, why: `${declared} cannot be read (${r.gap})` };
  const rows = reading?.body?.rows ?? null, rowSentences = rows ? new Set(rows.map((x) => x.s)).size : null;
  const body = {
    codec: declared, foundCodec: codec.body.chosen ?? null, agrees: codec.body.agrees ?? null,
    quotes: G.quotes ? { source: G.quotes.source, pairs: G.quotes.pairs } : null,
    records: r.records, gaps: [...(G.gaps ?? []).map((g) => g.gap), ...(r.gaps ?? []).map((g) => g.gap ?? String(g))],
    readingCheck: rows ? { khoraSentences: rowSentences, janusSentences: r.records.length, sameCut: rowSentences === r.records.length } : { khoraSentences: null, janusSentences: r.records.length, sameCut: null, why: 'no text-reading entry' },
  };
  return { body, of: [text.id, codec.id, ...(reading ? [reading.id] : [])] };
}

/** weaveEot(door, { only, grammar }) -> { written, skipped, gaps: [codes], refused, why } — reads the three kinds by kind from the door, writes text-eot (or a typed gap) per text. A door that is off writes nothing and says why. */
export function weaveEot(door, { only = null, grammar = loadGrammar } = {}) {
  const out = { written: 0, skipped: 0, gaps: [], refused: 0, why: null };
  if (!door?.on) return { ...out, refused: 1, why: door?.why ?? 'no door' };
  const es = door.ask([...READS]); if (!es) return { ...out, refused: 1, why: door.counts?.lastReason ?? 'could not read the log' };
  const texts = latestByAddr(es.filter((e) => e.kind === 'text')), codecs = latestByAddr(es.filter((e) => e.kind === 'text-codec')), readings = latestByAddr(es.filter((e) => e.kind === 'text-reading'));
  door.declare(EOT_KIND, EOT_CELL, 'the EOT of a text under the codec its reading ran under: the relational structure janus decodes from the text, by kind; a structure, never a verdict');
  door.declare(EOT_GAP_KIND, EOT_GAP_CELL, 'a typed gap about the EOT of one text: no codec entry, no declared language, no grammar');
  const put = (kind, cell, addr, body, of) => {
    const have = (door.fold({ kind, addr }) ?? []).find((e) => canon(e.body) === canon(body)); if (have) { out.skipped++; return have; }
    const e = door.weave({ cell, kind, addr, body, of, basis: { by: 'janus', note: 'decoded through the codec the read ran under (nl-eot.mjs); a structure, not a definition' } });
    if (e) out.written++; else { out.refused++; out.why = door.counts?.lastReason ?? 'weave refused'; } return e;
  };
  for (const [addr, t] of texts) {
    const sha = tail(addr, 'text:'); if (!sha || (only && !only.includes(sha))) continue;
    const r = eotOf(sha, { text: t, codec: codecs.get(`codec:${sha}`), reading: readings.get(`reading:${sha}`) }, { grammar });
    if (r.gap) { if (!out.gaps.includes(r.gap)) out.gaps.push(r.gap); put(EOT_GAP_KIND, EOT_GAP_CELL, `eotgap:${sha}:${r.gap}`, { gap: r.gap, why: r.why }, [t.id]); continue; }
    put(EOT_KIND, EOT_CELL, `eot:${sha}`, r.body, r.of);
  }
  return out;
}
