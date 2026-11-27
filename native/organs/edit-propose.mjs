// organs/edit-propose.mjs: WHAT THE MATERIAL ITSELF SUPPLIES for the params a sentence leaves open. No model and no hand-set threshold: every cut-off is a quantile of the material's OWN distribution (Tukey's fence on its own gaps; the padding is its own median gap).
// These are PROPOSALS with their measured effect, never edits: choosing one is a DEFINITION (DEF) by the person; janus only nominates. Input is a transcript's word timing (start, end seconds) from whatever read the audio: not produced here.
const q = (xs, p) => { const a = [...xs].sort((x, y) => x - y); if (!a.length) return null; const i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); };
const r3 = (x) => Math.round(x * 1000) / 1000;
/** gapsOf(words) -> [{ from, to, dur }] silences between consecutive words (words sorted by start) */
export const gapsOf = (words) => words.slice(1).map((w, i) => ({ from: words[i].end, to: w.start, dur: r3(w.start - words[i].end) })).filter((g) => g.dur > 0);
/** trimProposal(clip{start,end}, words): the head and tail with no speech, each kept back by the material's own MEDIAN gap so no word is clipped. Returns { remove: [{from,to}], pad, kept, why } */
export function trimProposal(clip, words) {
  const inside = words.filter((w) => w.end > clip.start && w.start < clip.end).sort((a, b) => a.start - b.start); if (!inside.length) return { remove: [], pad: null, kept: null, why: "no_speech_in_clip: nothing to anchor a trim on" };
  const gs = gapsOf(inside).map((g) => g.dur), pad = gs.length ? q(gs, 0.5) : 0, a = Math.max(clip.start, inside[0].start - pad), b = Math.min(clip.end, inside.at(-1).end + pad), remove = [];
  if (a > clip.start) remove.push({ from: r3(clip.start), to: r3(a) }); if (b < clip.end) remove.push({ from: r3(b), to: r3(clip.end) });
  return { remove, pad: r3(pad), kept: { from: r3(a), to: r3(b) }, why: remove.length ? "head/tail without speech, padded by the clip's own median inter-word gap" : "the clip already starts and ends on speech (within its own median gap)" };
}
/** pacingProposals(words): the gaps that are outliers of THIS material's gap distribution (above Q3 + 1.5 IQR), each a candidate remove_span with the time it would save. "Better" is DEFINED here as fewer outlier gaps: a criterion for the person to accept (DEF), not a fact about pacing. */
export function pacingProposals(words) {
  const gs = gapsOf(words); if (gs.length < 8) return { fence: null, proposals: [], why: "too_few_gaps: fewer than 8 gaps cannot say what is long for this material" };
  const q1 = q(gs.map((g) => g.dur), 0.25), q3 = q(gs.map((g) => g.dur), 0.75), fence = q3 + 1.5 * (q3 - q1), median = q(gs.map((g) => g.dur), 0.5), long = gs.filter((g) => g.dur > fence);
  return { fence: r3(fence), median: r3(median), proposals: long.map((g) => ({ op: "remove_span", from: g.from, to: g.to, saves: r3(g.dur - median), keep: r3(median) })), why: long.length ? "gaps above the material's own Tukey fence, each shortened to the median gap" : "no gap is an outlier of this material's own gap distribution: by this criterion there is nothing to improve" };
}
