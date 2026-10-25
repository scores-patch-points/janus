// build-dotted-priors.mjs — the words a language writes WITH their period ("etc.", "e.g.", "U.S.", "Messrs."), read from the
// hyperlexicon's local giver, never typed. A headword the English Wiktionary lists with a final period (letters and dots only, at
// most 12 characters) is a dotted word: its period belongs to it. khora's reader (native/the-fold/read-core.mjs) keeps such a form
// whole at the sentence cut — where the text itself never writes the token without its period (a per-text test), so "in." (a form
// of "inch") never stops "He came in." from ending a sentence. The live hyperlexicon still answers forms this prior lacks.
//   node scripts/build-dotted-priors.mjs [--pack <wiktionary-slim .pack>] [--reader <Zenodotus lookup.mjs>] [--lang en]
// Writes priors/dotted-<stem>.json (DottedWords@1) with its giver: the pack's snapshot, file name and sha256, and the licence.
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const STEM = { en: 'eng' };
const lang = arg('--lang', 'en');
const packDir = join(homedir(), '.cache', 'live_priors', 'wiktionary');
const newest = () => { try { return readdirSync(packDir).map((f) => f.match(/^wiktionary-slim-(\d{4}-\d{2}-\d{2})(?:-v(\d+))?\.pack$/)).filter(Boolean).sort((a, b) => a[1].localeCompare(b[1]) || Number(a[2] || 1) - Number(b[2] || 1)).map((m) => join(packDir, m[0])).pop(); } catch { return null; } };
const pack = arg('--pack', process.env.WIKTIONARY_PACK || newest());
const reader = arg('--reader', process.env.WIKTIONARY_READER || resolve(HERE, '../../Zenodotus/scripts/wiktionary/lookup.mjs'));
if (!pack || !existsSync(pack)) { console.error('no Wiktionary pack (pass --pack)'); process.exit(2); }
if (!existsSync(reader)) { console.error('no pack reader (pass --reader)'); process.exit(2); }

const sha = await new Promise((ok, no) => { const h = createHash('sha256'); createReadStream(pack).on('data', (b) => h.update(b)).on('end', () => ok(h.digest('hex'))).on('error', no); });
const { Dictionary } = await import(pathToFileURL(reader).href);
const d = new Dictionary({ pack, learned: '/dev/null', changed: '/dev/null', delta: '/dev/null' });
const DOTTED = /^\p{L}+(?:\.\p{L}+)*\.$/u;
const words = new Map(); let rows = 0;
for (const c of d.manifest.chunks) for (const line of d.loadChunk(c)) {
  rows++;
  const r = JSON.parse(line);
  if (r.w.length > 12 || !DOTTED.test(r.w)) continue;
  const own = (r.e || []).filter((e) => e.c === lang);
  if (!own.length) continue;
  words.set(r.w, [...new Set(own.flatMap((e) => (e.s || []).map((s) => s.of).filter(Boolean)))].slice(0, 3));
}
const out = {
  schema: 'DottedWords@1',
  lang, stem: STEM[lang] || lang,
  giver: { name: 'English Wiktionary', snapshot: (basename(pack).match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || null, pack: basename(pack), sha256: sha, licence: 'CC BY-SA 4.0', via: 'Zenodotus scripts/wiktionary/lookup.mjs, every chunk scanned' },
  rule: 'a headword listed with a final period, letters and dots only, at most 12 characters, with an entry in this language',
  rows, n: words.size,
  words: [...words.keys()].sort(),
  of: Object.fromEntries([...words].filter(([, of]) => of.length)),
};
const file = resolve(HERE, '..', 'priors', `dotted-${out.stem}.json`);
writeFileSync(file, JSON.stringify(out) + '\n');
console.log(`wrote ${file}: ${out.n} dotted words of ${rows} headword rows (${out.giver.pack})`);
