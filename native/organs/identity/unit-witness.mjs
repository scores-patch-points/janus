// unit-witness.mjs — a model's testimony on ONE clause unit against a whole passage (seam 2, CONTRACT B.4 and C.1).
// Two questions, three wordings each, raw answers only:
//   held      W1, W2, W3   seam 1's wordings, request bodies and cache lines byte for byte (built by pair-witness.mjs's
//                          own requestBody, imported, never copied), so a draw seam 1 made answers here without a call
//   opposed   F1, F2, F3   the falsity wordings fixed in CONTRACT C.1; same system line, model, options and format
// passage = the ground text, whole; sentence = the unit's `say`. Answers are "yes" | "no" | "unparsed", never folded
// into held / opposed / silent: that reading is Penelope's, under her declared rule.
//
//   makeUnitWitness(cacheFile, { fetchImpl, url, retryMs }) -> { draw(w, p, s), held(p, s), opposed(p, s), stats }
//   cache   the same file and format as pair-witness.mjs ($PAIR_WITNESS_CACHE): one JSON line per draw
//           { key, w, answer, ms }, key = JSON.stringify([w, passage, sentence]). F-keys never collide with W-keys.
//           Read whole at start, appended per fresh draw; a cached key is never asked again.
// This organ asks only what its caller asks: it plans nothing. Which units are asked is the planner's, and the
// planner asks only about units a Penelope request names (unit-evidence-pharos.mjs).
import fs from 'node:fs';
import { MODEL, CHAT_URL, WORDINGS, WORDING_NAMES, requestBody } from './pair-witness.mjs';

export { MODEL, WORDING_NAMES };
export const FALSITY = {
  F1: (p, s) => `PASSAGE: ${p}\n\nSENTENCE: ${s}\n\nDoes the passage say that the sentence is false? Answer yes only if the passage states the opposite of the sentence or the opposite follows directly from what the passage states.`,
  F2: (p, s) => `According to the passage alone, is the sentence false? Answer yes only if the passage states the opposite of the sentence or the opposite follows directly from what the passage states.\n\nPASSAGE: ${p}\n\nSENTENCE: ${s}`,
  F3: (p, s) => `SENTENCE: ${s}\n\nPASSAGE: ${p}\n\nCan the sentence be refuted from the passage? Answer yes only if the passage states the opposite of what the sentence says, or the opposite follows directly from what the passage states.`,
};
export const FALSITY_NAMES = ['F1', 'F2', 'F3'];

/** the request body for one draw: W1..W3 are seam 1's own bodies; F1..F3 the same body with the falsity wording */
export function unitRequestBody(w, p, s) {
  if (WORDINGS[w]) return requestBody(w, p, s);
  if (!FALSITY[w]) throw new Error(`unknown wording ${w}`);
  const b = requestBody('W1', p, s);
  b.messages[1] = { role: 'user', content: FALSITY[w](p, s) };
  return b;
}

export function makeUnitWitness(cacheFile, { fetchImpl = (...a) => fetch(...a), url = CHAT_URL, retryMs = 3000 } = {}) {
  if (!cacheFile) throw new Error('makeUnitWitness needs a cache file');
  const cache = new Map(), stats = { fresh: 0, ms: 0, cached: 0 };
  if (fs.existsSync(cacheFile)) for (const l of fs.readFileSync(cacheFile, 'utf8').split('\n')) if (l) { try { const r = JSON.parse(l); cache.set(r.key, r); } catch {} }
  async function draw(w, p, s) {
    const key = JSON.stringify([w, p, s]); if (cache.has(key)) { stats.cached++; return cache.get(key).answer; }
    const body = unitRequestBody(w, p, s);
    let last;
    for (let k = 0; k < 5; k++) { const t0 = Date.now();
      try { const res = await fetchImpl(url, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(240000) });
        const j = await res.json(); if (!j.message) throw new Error('no message ' + JSON.stringify(j).slice(0, 200));
        let answer = 'unparsed'; try { const a = JSON.parse(j.message.content).answer; if (a === 'yes' || a === 'no') answer = a; } catch {}
        const r = { key, w, answer, ms: Date.now() - t0 }; fs.appendFileSync(cacheFile, JSON.stringify(r) + '\n'); cache.set(key, r); stats.fresh++; stats.ms += r.ms; return answer;
      } catch (e) { last = e; await new Promise((r) => setTimeout(r, retryMs)); } }
    throw last;
  }
  /** "does the PASSAGE say that this one short statement is true?", W1..W3 in order -> [a1, a2, a3] raw */
  async function held(passage, say) { const out = []; for (const w of WORDING_NAMES) out.push(await draw(w, passage, say)); return out; }
  /** "does the PASSAGE say that it is false?", F1..F3 in order -> [a1, a2, a3] raw */
  async function opposed(passage, say) { const out = []; for (const w of FALSITY_NAMES) out.push(await draw(w, passage, say)); return out; }
  return { draw, held, opposed, stats };
}
