// codec-for.mjs: THE CODEC IS COMPUTED, NOT CHOSEN (DESIGN-COMPUTED-CODEC.md; REFERENT-FIRST rule 12). codecFor(material, context) selects, from a registry of learned SOURCES each carrying its giver, scope and standing,
// the ones whose scope covers the context, weights them, loads each one's grammar through the codec door (nl-eot.mjs loadGrammar) and returns the LAYERS together with a DERIVATION record that says exactly which sources
// made them. Every EOT record read through a layer is stamped with the derivation id; one without a derivation is refused (requireDerivation). Structure only: no rule is written and no verdict is given.
//   no source covers the context -> the typed gap `no_codec_source` (never another language's or period's source, never an English hub)
//   a source whose period is unknown is eligible when the context names a period, and the derivation says `period_unknown` (a hole, not a pass)
//   no context at all (variety and period unknown) -> every source for the language, uniform weights, and the derivation says `no_context_uniform_weights`
// Default composition is the ENSEMBLE: all selected sources' records are kept as weighted layers (a fold picks the face; agreement across independent layers is standing). A BLEND of tables is deferred and must be measured against it.
import crypto from 'node:crypto'; import fs from 'node:fs'; import path from 'node:path';
import { loadGrammar, read } from './nl-eot.mjs'; import { codecCache } from '../../scripts/vendor-ud-codec.mjs';
export const DERIVATION_SCHEMA = 'CodecDerivation@1', SOURCES_SCHEMA = 'CodecSources@1';
const HERE = path.dirname(new URL(import.meta.url).pathname), SOURCES_FILE = path.resolve(HERE, '../../priors/codec-sources.json');
const sha16 = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((q) => [q, v[q]])) : v));
/** loadSources(file) -> [source]: refuses a source with no giver name, no scope language or no data hash (a source that cannot be audited is not a source) */
export function loadSources(file = SOURCES_FILE) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8')); if (j.schema !== SOURCES_SCHEMA) throw new Error(`codec sources: schema ${j.schema} is not ${SOURCES_SCHEMA}`);
  for (const s of j.sources) { if (!s.giver?.name || !s.giver?.kind) throw new Error(`codec source ${s.id}: no named giver`); if (!s.language || !s.material) throw new Error(`codec source ${s.id}: no scope`); if (!s.dataHash) throw new Error(`codec source ${s.id}: no data hash`); if (!['given', 'candidate'].includes(s.standing)) throw new Error(`codec source ${s.id}: standing must be given or candidate`); }
  return j.sources;
}
const overlaps = (a, b) => a && b && !(a.to < b.from || b.to < a.from);
/** codecFor({ material, language, variety, period }, { sources, loader }) -> { layers: [{ source, weight, grammar }], derivation } | { gap, why, derivation } */
export function codecFor(context = {}, { sources = loadSources(), loader = loadGrammar } = {}) {
  const { material = 'text', language = null, variety = null, period = null } = context, gaps = [];
  if (!language) return { gap: 'no_codec_source', why: 'the context names no language: a codec is never chosen by default', derivation: derive(context, [], [{ gap: 'no_language' }]) };
  let pool = sources.filter((s) => s.material === material && s.language === language);
  if (variety) pool = pool.filter((s) => s.variety === variety);
  if (period) pool = pool.filter((s) => s.period == null || overlaps(s.period, period));
  if (!pool.length) return { gap: 'no_codec_source', why: `no source covers ${material}/${language}${variety ? '/' + variety : ''}${period ? '/' + JSON.stringify(period) : ''}: another language's or period's codec is never substituted`, derivation: derive(context, [], [{ gap: 'no_codec_source' }]) };
  if (!variety && !period) gaps.push({ gap: 'no_context_uniform_weights' });
  const w = 1 / pool.length, layers = [];
  for (const s of pool) {
    if (period && s.period == null) gaps.push({ gap: 'period_unknown', source: s.id });
    // a source whose licence forbids redistribution is POINTED AT: vendored on this machine under the codec cache (THE ISTHMUS); absent here it is a typed gap that names the source, never a substitute
    let opts = {}; if (s.grammar?.cacheDir) { const dir = path.join(codecCache(), s.grammar.cacheDir); if (!fs.existsSync(dir)) { gaps.push({ gap: 'codec_not_vendored', source: s.id, why: `${s.id} is pointed at (${s.giver.licence ?? 'licence per the treebank'}) and is not on this machine: ${s.grammar.vendorCommand ?? 'train it into ' + dir}` }); continue; } opts = { priors: dir, cache: dir }; }
    const grammar = loader(s.grammar?.code ?? s.language, opts); if (grammar?.gap) { gaps.push({ gap: grammar.gap, source: s.id, why: grammar.why }); continue; }
    layers.push({ source: s, weight: w, grammar });
  }
  if (!layers.length) return { gap: 'no_codec_source', why: 'every selected source failed to load', derivation: derive(context, [], gaps) };
  const total = layers.reduce((a, l) => a + l.weight, 0); for (const l of layers) l.weight = l.weight / total;
  return { layers, derivation: derive(context, layers, gaps) };
}
function derive(context, layers, gaps) {
  const sources = layers.map((l) => ({ id: l.source.id, giver: l.source.giver, scope: { material: l.source.material, language: l.source.language, variety: l.source.variety ?? null, period: l.source.period ?? null }, weight: l.weight, standing: l.source.standing, dataHash: l.source.dataHash })).sort((a, b) => (a.id < b.id ? -1 : 1));
  const body = { schema: DERIVATION_SCHEMA, material: context.material ?? 'text', context: { language: context.language ?? null, variety: context.variety ?? null, period: context.period ?? null }, sources, gaps };
  return Object.freeze({ ...body, composed: sha16(canon(body)) });
}
/** readLayers(codec, text) -> { layers: [{ sourceId, weight, records }], derivation } ; every record is stamped with the derivation id. A gap codec reads nothing. */
export function readLayers(codec, text, { reader = read } = {}) {
  if (codec.gap) return { gap: codec.gap, why: codec.why, layers: [], derivation: codec.derivation };
  return { layers: codec.layers.map((l) => { const r = reader(l.grammar, text); return { sourceId: l.source.id, weight: l.weight, gap: r.gap ?? null, records: (r.records ?? []).map((rec) => ({ ...rec, derivation: codec.derivation.composed, source: l.source.id })) }; }), derivation: codec.derivation };
}
/** the door's refusal: an EOT record that does not say which codec derivation made it is not accepted */
export function requireDerivation(record) { if (!record || typeof record.derivation !== 'string' || !record.derivation) throw new Error('an EOT record without a codec derivation is refused (REFERENT-FIRST rule 12)'); return record; }
