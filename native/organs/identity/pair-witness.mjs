// pair-witness.mjs — a model's testimony on a pair of texts, three wordings in each direction (2026-11-15).
// The system line, the three wordings, the request options and the cache format are copied unchanged from the
// composite's witness (ledgers/paraphrase-100/composite/witness.mjs), so a cache that run wrote answers here.
// This organ returns the RAW answers only: it never folds them into yes / no / gap and never says "same".
// What the answers mean under a bound is the asker's (Penelope's) to declare.
//
//   makeWitness(cacheFile, { fetchImpl, url }) -> { draw(w, p, s), witnessPair(a, b), stats }
//   witnessPair(a, b) -> { ab: [W1, W2, W3], ba: [W1, W2, W3] }, each "yes" | "no" | "unparsed"
//     ab: a is the PASSAGE and b the SENTENCE; ba the other way round.
//   cache   one JSON line per draw { key, w, answer, ms }, key = JSON.stringify([w, passage, sentence]);
//           read whole at start, appended per fresh draw; a cached key is never asked again.
//   fetchImpl / url exist so a test can stand in for the model server; the defaults are the composite's.
import fs from 'node:fs';

export const MODEL = 'qwen3:8b';
export const SYS = 'You are a careful reader. Answer only from the PASSAGE. Do not use outside knowledge.';
export const WORDINGS = {
  W1: (p, s) => `PASSAGE: ${p}\n\nSENTENCE: ${s}\n\nDoes the passage say that the sentence is true? Answer yes only if the passage states it or it follows directly from what the passage states.`,
  W2: (p, s) => `According to the passage alone, is the sentence true? Answer yes only if the passage states it or it follows directly from what the passage states.\n\nPASSAGE: ${p}\n\nSENTENCE: ${s}`,
  W3: (p, s) => `SENTENCE: ${s}\n\nPASSAGE: ${p}\n\nCan the sentence be confirmed from the passage? Answer yes only if the passage states what the sentence says, or it follows directly from what the passage states.`,
};
export const WORDING_NAMES = ['W1', 'W2', 'W3'];
export const CHAT_URL = 'http://127.0.0.1:11434/api/chat';

/** the request body for one draw, exactly the composite's */
export function requestBody(w, p, s) {
  return { model: MODEL, stream: false, think: false, options: { temperature: 0, seed: 1, num_predict: 16 },
    format: { type: 'object', properties: { answer: { type: 'string', enum: ['yes', 'no'] } }, required: ['answer'] },
    messages: [{ role: 'system', content: SYS }, { role: 'user', content: WORDINGS[w](p, s) }] };
}

export function makeWitness(cacheFile, { fetchImpl = (...a) => fetch(...a), url = CHAT_URL, retryMs = 3000 } = {}) {
  if (!cacheFile) throw new Error('makeWitness needs a cache file');
  const cache = new Map(), stats = { fresh: 0, ms: 0, cached: 0 };
  if (fs.existsSync(cacheFile)) for (const l of fs.readFileSync(cacheFile, 'utf8').split('\n')) if (l) { try { const r = JSON.parse(l); cache.set(r.key, r); } catch {} }
  async function draw(w, p, s) {
    const key = JSON.stringify([w, p, s]); if (cache.has(key)) { stats.cached++; return cache.get(key).answer; }
    const body = requestBody(w, p, s);
    let last;
    for (let k = 0; k < 5; k++) { const t0 = Date.now();
      try { const res = await fetchImpl(url, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(240000) });
        const j = await res.json(); if (!j.message) throw new Error('no message ' + JSON.stringify(j).slice(0, 200));
        let answer = 'unparsed'; try { const a = JSON.parse(j.message.content).answer; if (a === 'yes' || a === 'no') answer = a; } catch {}
        const r = { key, w, answer, ms: Date.now() - t0 }; fs.appendFileSync(cacheFile, JSON.stringify(r) + '\n'); cache.set(key, r); stats.fresh++; stats.ms += r.ms; return answer;
      } catch (e) { last = e; await new Promise((r) => setTimeout(r, retryMs)); } }
    throw last;
  }
  /** the raw answers, three wordings per direction, asked in the composite's order (ab W1..W3, then ba W1..W3) */
  async function witnessPair(a, b) {
    const ab = [], ba = [];
    for (const w of WORDING_NAMES) ab.push(await draw(w, a, b));
    for (const w of WORDING_NAMES) ba.push(await draw(w, b, a));
    return { ab, ba };
  }
  return { draw, witnessPair, stats };
}
