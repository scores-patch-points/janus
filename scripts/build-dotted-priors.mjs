// build-dotted-priors.mjs — the words a language writes WITH their period ("etc.", "e.g.", "U.S.", "Messrs."), read from the
// hyperlexicon's local giver, never typed. A headword the English Wiktionary lists with a final period (letters and dots only, at
// most 12 characters) is a dotted word: its period belongs to it. khora's reader (native/the-fold/read-core.mjs) keeps such a form
// whole at the sentence cut — where the text itself never writes the token without its period (a per-text test), so "in." (a form
// of "inch") never stops "He came in." from ending a sentence. The live hyperlexicon still answers forms this prior lacks.
//   node scripts/build-dotted-priors.mjs [--pack <wiktionary-slim .pack>] [--reader <Zenodotus lookup.mjs>] [--lang en]
// Writes priors/dotted-<stem>.json (DottedWords@1) with its giver: the pack's snapshot, file name and sha256, and the licence.
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const STEM = { en: 'eng' };
const lang = arg('--lang', 'en');
const packDir = join(homedir(), '.cache', 'live_priors', 'wiktionary');
const newest = () => { try { return readdirSync(packDir).map((f) => f.match(/^wiktionary-slim-(\d{4}-\d{2}-\d{2})(?:-v(\d+))?\.pack$/)).filter(Boolean).sort((a, b) => a[1].localeCompare(b[1]) || Number(a[2] || 1) - Number(b[2] || 1)).map((m) => join(packDir, m[0])).pop(); } catch { return null; } };
// FROM THE HYPERLEXICON (2026-10-25): with --from-hyperlexicon <log dir>, the words are read from the hyperlexicon's names index (janus
// scripts/hyperlexicon s2: every giver's names, lower-cased, with language, node and kind) instead of from a giver's pack directly: every
// surface a giver names in this language with a final period. The giver is the hyperlexicon (its head), with the givers it holds named.
// --cased (frame 4): the names index keeps surfaces lower-cased; the givers' node records keep each name as written, so each folded
// surface is read back as the forms its nodes' English names write (DOTTED-PREREG-4.md).
const HL = arg('--from-hyperlexicon', null), OUTFILE = arg('--out', null), CASED = process.argv.includes('--cased');
const pack = HL ? null : arg('--pack', process.env.WIKTIONARY_PACK || newest());
const reader = arg('--reader', process.env.WIKTIONARY_READER || resolve(HERE, '../../Zenodotus/scripts/wiktionary/lookup.mjs'));
const DOTTED = /^\p{L}+(?:\.\p{L}+)*\.$/u;
const words = new Map(); let rows = 0, sha = null, hlGiver = null;
if (HL) {
  const { gunzipSync } = await import('node:zlib');
  const dir = join(HL, 'names-index');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.tsv.gz')).sort()) {
    for (const line of gunzipSync(readFileSync(join(dir, f))).toString('utf8').split('\n')) {
      if (!line) continue; rows++;
      const [surface, l, node, kind] = line.split('\t');
      if (l !== lang || surface.length > 12 || !DOTTED.test(surface)) continue;
      const e = words.get(surface) ?? []; e.push([kind, node]); words.set(surface, e);
    }
  }
  if (CASED) {
    const { openHyperlexicon } = await import(pathToFileURL(resolve(HERE, '..', 'native', 'organs', 'hyperlexicon', 'traverse.mjs')).href);
    const hl = openHyperlexicon(HL);
    const folded = new Map(words); words.clear();
    for (const [low, refs] of folded) {
      const as = new Set();
      for (const [, node] of refs) for (const n of hl.node(node)?.names ?? []) if (n.lang === lang && typeof n.surface === 'string' && n.surface.toLowerCase() === low) as.add(n.surface);
      for (const w of as) words.set(w, refs.slice(0, 3).map(([k, nd]) => `${k}:${nd}`));
    }
  } else for (const [w, refs] of words) words.set(w, refs.slice(0, 3).map(([k, nd]) => `${k}:${nd}`));
  const head = readFileSync(join(HL, 'head.sha256'), 'utf8').split(/\s/)[0];
  const givers = readdirSync(HL).filter((x) => /^dict-.*\.summary\.json$/.test(x)).map((x) => { try { const j = JSON.parse(readFileSync(join(HL, x), 'utf8')); return { giver: x.slice(5, -13), version: j.version ?? null, entries: j.entries ?? null, packSha256: j.packSha256 ?? null }; } catch { return { giver: x.slice(5, -13) }; } });   // the name is the file's: the summary's own `giver` is a count
  hlGiver = { name: 'janus hyperlexicon v1', head, givers, via: 'the names index (s2): every name a giver lists in this language', licence: 'the givers\' own (Wiktionary: CC BY-SA 4.0); the index is janus\'s' };
} else {
  if (!pack || !existsSync(pack)) { console.error('no Wiktionary pack (pass --pack)'); process.exit(2); }
  if (!existsSync(reader)) { console.error('no pack reader (pass --reader)'); process.exit(2); }
  sha = await new Promise((ok, no) => { const h = createHash('sha256'); createReadStream(pack).on('data', (b) => h.update(b)).on('end', () => ok(h.digest('hex'))).on('error', no); });
  const { Dictionary } = await import(pathToFileURL(reader).href);
  const d = new Dictionary({ pack, learned: '/dev/null', changed: '/dev/null', delta: '/dev/null' });
  for (const c of d.manifest.chunks) for (const line of d.loadChunk(c)) {
    rows++;
    const r = JSON.parse(line);
    if (r.w.length > 12 || !DOTTED.test(r.w)) continue;
    const own = (r.e || []).filter((e) => e.c === lang);
    if (!own.length) continue;
    words.set(r.w, [...new Set(own.flatMap((e) => (e.s || []).map((s) => s.of).filter(Boolean)))].slice(0, 3));
  }
}
// THE TREEBANK'S EVIDENCE (2026-10-25): a single-dot form whose base is itself an ordinary word the language's POS prior attests
// ("ports." — Portsmouth — beside the noun "ports"; "in." beside the preposition) is ambiguous at a sentence end, and the per-text
// bare-use test cannot tell when the text writes the word only sentence-finally. Such a form is kept only where the treebank itself
// writes it WITH its period as one token ("etc.", "Inc.", "Dr.", "St.", "No."): the period belonging to the word is measured there.
// Multi-dot forms ("U.S.", "e.g.") and forms whose base no treebank word attests ("Messrs.", "approx.") are kept as listed.
const pos = JSON.parse(readFileSync(resolve(HERE, '..', 'priors', `pos-${STEM[lang] || lang}.json`), 'utf8')).forms || {};
const count = (f) => { const c = pos[f.toLowerCase()]; return c ? Object.values(c).reduce((a, b) => a + b, 0) : 0; };
const excluded = [];
for (const w of [...words.keys()]) {
  if (w.split('.').length !== 2) continue;              // multi-dot: an initialism, never an ordinary word
  if (count(w.slice(0, -1)) > 0 && count(w) === 0) { excluded.push(w); words.delete(w); }
}
const out = {
  schema: 'DottedWords@1',
  lang, stem: STEM[lang] || lang,
  giver: hlGiver ?? { name: 'English Wiktionary', snapshot: (basename(pack).match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || null, pack: basename(pack), sha256: sha, licence: 'CC BY-SA 4.0', via: 'Zenodotus scripts/wiktionary/lookup.mjs, every chunk scanned' },
  rule: 'a headword listed with a final period, letters and dots only, at most 12 characters, with an entry in this language; a single-dot form whose base the POS treebank attests as a word is kept only where the treebank also writes it with its period',
  rows, n: words.size, excluded: excluded.length, excludedSample: excluded.sort().slice(0, 40),
  words: [...words.keys()].sort(),
  of: Object.fromEntries([...words].filter(([, of]) => of.length)),
};
if (HL) out.rule = (CASED
  ? 'every name a giver of the hyperlexicon lists in this language with a final period, letters and dots only, at most 12 characters, read as written from the givers\' node records (DOTTED-PREREG-4.md)'
  : 'every surface a giver of the hyperlexicon names in this language with a final period, letters and dots only, at most 12 characters (the names index keeps surfaces lower-cased)')
  + '; a single-dot form whose base the POS treebank attests as a word is kept only where the treebank also writes it with its period';
const file = OUTFILE ?? resolve(HERE, '..', 'priors', `dotted-${out.stem}.json`);
writeFileSync(file, JSON.stringify(out) + '\n');
console.log(`wrote ${file}: ${out.n} dotted words of ${rows} ${HL ? 'names' : 'headword rows'} (${HL ? 'hyperlexicon ' + out.giver.head.slice(0, 16) : out.giver.pack})`);
