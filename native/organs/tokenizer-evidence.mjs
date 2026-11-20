// tokenizer-evidence.mjs: janus is the RESEARCHER for tokenization. It OBSERVES a treebank and WRITES COUNTS, at Structure cells, to the shared log through its door; it writes no rule, no standing and no verdict (a rule is a DEF and a verdict an EVA: Penelope's). REFERENT-FIRST rules 13 and 14.
//   attachmentEvidence(conllu, meta)  -> entries (kind clitic-attachment, SEG·Pattern): per candidate form, how often the gold tokenization CUT it off an attached word (nSplit) and how often the same suffix was left INSIDE a word (nGlued). Attachment is read from the raw sentence text the treebank carries.
//   firingEvidence({ conllu, tokenize, forms, variants }, meta) -> entries (kind clitic-firing, CON·Figure): per form, on a HELD-OUT treebank, how often applying it to the tokenizer's output cut at a point where the gold tokenization has a boundary (fired, correct), plus token-boundary counts with and without the forms.
//   effectEvidence(result, meta) -> one entry (kind clitic-effect, CON·Figure): the DOWNSTREAM DIFFERENCE a clitic split makes (LAS on the other tokens, split minus glued; for 's the nmod:poss relation recovered; the harm of cutting a word that only ends with the form) and the NULL it is judged against (one random word cut at the form's length on the same sentences, `draws` times with a seed): the observed effect, the number of null draws, how many reached it, and the null's mean, spread and range. Counts and numbers only; the empirical rank is Penelope's to read.
//   (effectEvidence also carries `effectUncertainty`: the spread of the effect itself over resamples of the sentences, as a report, never a gate)
//   writeTokenizerEvidence(door, entries) -> { written, refused, why }
// Pure: no clock, no model, no regex, no word list, no file written, no other repo imported (the tokenizer is INJECTED). No entry carries kept, survived, refuted or status: counting is observing; deciding is Penelope's.
import crypto from "node:crypto";
import { splitToken } from "./clitic-split.mjs";
export const TOKENIZER_EVIDENCE_SCHEMA = "TokenizerEvidence@1";
export const KINDS = Object.freeze({ "clitic-attachment": "SEG·Pattern", "clitic-firing": "CON·Figure", "clitic-effect": "CON·Figure" });
const sha16 = (o) => crypto.createHash("sha256").update(JSON.stringify(o), "utf8").digest("hex").slice(0, 16);
const sentencesOf = (conllu) => { const out = []; let raw = null, toks = []; for (const line of conllu.split("\n")) { if (!line.trim()) { if (raw && toks.length) out.push({ raw, toks }); raw = null; toks = []; continue; } if (line[0] === "#") { if (line.startsWith("# text = ")) raw = line.slice(9); continue; } const c = line.split("\t"); if (c.length === 10 && !c[0].includes("-") && !c[0].includes(".")) toks.push({ form: c[1], upos: c[3] }); } if (raw && toks.length) out.push({ raw, toks }); return out; };
const spansOf = (raw, forms) => { const out = []; let cur = 0; for (const f of forms) { const at = raw.indexOf(f, cur); if (at < 0) return null; out.push([at, at + f.length]); cur = at + f.length; } return out; };
const corpusOf = (meta) => ({ name: meta.corpus, sha256: meta.sha256, licence: meta.licence ?? null, language: meta.language, variety: meta.variety ?? null });
export function attachmentEvidence(conllu, meta) {
  const split = {}, glued = {}, all = []; let sentences = 0, unaligned = 0;
  for (const { raw, toks } of sentencesOf(conllu)) { sentences++; let cur = 0, prev = null; for (const t of toks) { const at = raw.indexOf(t.form, cur); if (at < 0) { unaligned++; prev = null; continue; } if (prev && prev.upos !== "PUNCT" && t.upos !== "PUNCT" && at === prev.end) split[t.form] = (split[t.form] ?? 0) + 1; all.push(t.form); cur = at + t.form.length; prev = { upos: t.upos, end: cur }; } }
  const forms = Object.keys(split); for (const f of all) for (const c of forms) if ([...f].length > [...c].length && f.endsWith(c)) glued[c] = (glued[c] ?? 0) + 1;
  return forms.sort().map((form) => ({ cell: KINDS["clitic-attachment"], kind: "clitic-attachment", addr: `clitic-attachment:${sha16([meta.sha256, meta.language, meta.variety ?? null, form])}`, body: { schema: TOKENIZER_EVIDENCE_SCHEMA, by: "janus.tokenizer-evidence", corpus: corpusOf(meta), form, position: "suffix", nSplit: split[form], nGlued: glued[form] ?? 0, sentences, unaligned } }));
}
export function firingEvidence({ conllu, tokenize, forms, variants = null }, meta) {
  if (typeof tokenize !== "function") throw new TypeError("firingEvidence: the tokenizer is injected"); const per = Object.fromEntries(forms.map((f) => [f, { fired: 0, correct: 0 }])), T = { base: [0, 0, 0], withForms: [0, 0, 0] }, measure = { apostropheVariants: variants, rules: forms.map((form) => ({ form, kept: true, status: "survived" })) };
  const bset = (sp) => { const s = new Set(); for (const [a, b] of sp) { s.add(a); s.add(b); } return s; }; let usable = 0;
  for (const { raw, toks } of sentencesOf(conllu)) {
    const gold = spansOf(raw, toks.map((t) => t.form)); if (!gold) continue; const base = tokenize(raw), bsp = spansOf(raw, base); if (!bsp) continue; usable++; const gb = bset(gold), withSp = [];
    for (const [i, t] of base.entries()) { const sp = splitToken(t, measure); if (sp) { const cut = bsp[i][0] + [...sp[0]].length, form = forms.find((f) => f === sp[1] || (variants && variants.to.some((v) => f.split(variants.from).join(v) === sp[1]))); per[form].fired++; if (gb.has(cut)) per[form].correct++; withSp.push([bsp[i][0], cut], [cut, bsp[i][1]]); } else withSp.push(bsp[i]); }
    for (const [key, sp] of [["base", bsp], ["withForms", withSp]]) { const pb = bset(sp); let tp = 0; for (const b of pb) if (gb.has(b)) tp++; T[key][0] += tp; T[key][1] += pb.size; T[key][2] += gb.size; }
  }
  return forms.map((form) => ({ cell: KINDS["clitic-firing"], kind: "clitic-firing", addr: `clitic-firing:${sha16([meta.sha256, meta.language, meta.variety ?? null, form])}`, body: { schema: TOKENIZER_EVIDENCE_SCHEMA, by: "janus.tokenizer-evidence", corpus: corpusOf(meta), form, fired: per[form].fired, correct: per[form].correct, sentences: usable, boundaries: { base: { truePositive: T.base[0], predicted: T.base[1], gold: T.base[2] }, withAllForms: { truePositive: T.withForms[0], predicted: T.withForms[1], gold: T.withForms[2] } } } }));
}
export function effectEvidence(r, meta) {
  if (!Array.isArray(r.nulls) || !r.nulls.length) throw new TypeError("effectEvidence: the null draws are required"); if (!Number.isInteger(r.seed)) throw new TypeError("effectEvidence: the seed is required (the null must be reproducible)");
  const effect = r.lasSplit - r.lasGlued, n = r.nulls.length, mean = r.nulls.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(r.nulls.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  return { cell: KINDS["clitic-effect"], kind: "clitic-effect", addr: `clitic-effect:${sha16([meta.sha256, meta.language, meta.variety ?? null, r.form, r.seed, n])}`, body: { schema: TOKENIZER_EVIDENCE_SCHEMA, by: "janus.tokenizer-evidence", corpus: corpusOf(meta), form: r.form,
    measure: "LAS (points) on the tokens other than the stem and the clitic, split as gold minus glued as a plain tokenizer leaves it, one parser", sentences: r.sentences, tokens: r.tokens, lasSplit: r.lasSplit, lasGlued: r.lasGlued, effect,
    null: { kind: "one random word cut at the form's length on the same sentences", draws: n, seed: r.seed, nullReaching: r.nulls.filter((x) => x >= effect).length, mean, sd, min: Math.min(...r.nulls), max: Math.max(...r.nulls) }, possessive: r.poss ? { ...r.poss, splitRate: r.poss.gold ? r.poss.split / r.poss.gold : null, gluedRate: r.poss.gold ? r.poss.glued / r.poss.gold : null, differencePoints: r.poss.gold ? 100 * (r.poss.split - r.poss.glued) / r.poss.gold : null } : null,
    effectUncertainty: r.bootstrap ?? null, wrongCuts: r.wrong ?? null } };
}
export function writeTokenizerEvidence(door, entries) {
  if (!door?.on) return { written: 0, refused: entries.length, why: door?.why ?? "no door" };
  for (const [kind, cell] of Object.entries(KINDS)) door.declare(kind, cell, "janus's structure for tokenization: counts from a treebank, no rule and no verdict (Penelope DEFs the rule and judges it)");
  let written = 0, refused = 0; for (const e of entries) { if (door.weave(e)) written++; else refused++; } return { written, refused, why: refused ? door.counts?.lastReason ?? "weave refused" : null };
}
