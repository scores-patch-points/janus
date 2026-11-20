// fullgraph.mjs <dir-or-queries.json> <out.json>: ADDENDUM-1 of PREREG-CLAIM-GRAPH-UNIVERSE. The referent's connections to ALL other nodes, not only the clauses it is a core argument of.
// Per document it writes every reader token with its sentence, its part of speech, its lemma key, the anchor class whose mention span it lies in (or -1) and its dependency head (any relation), plus Janus's binding candidates
// (anaphor token -> anchor classes, all listed, none chosen, number mismatch excluded). A structure extractor: it merges and judges nothing; the graph is built and grown in ctxalias.py.
// No regex, no word list: marks are dropped by code range; the offsets are the reader's.
import fs from "node:fs";
const m = await import("/Users/mlacy/Documents/khora-pharos-reading/native/the-fold/pharos-reading.mjs");
const { bindingsOf } = await import("/Users/mlacy/Documents/janus/native/organs/binding-evidence.mjs");
const key = (s) => [...s.normalize("NFKD").toLowerCase()].filter((c) => !(c.codePointAt(0) >= 0x300 && c.codePointAt(0) <= 0x36f)).join("");
const LANG = process.env.LANG_CODE ?? process.argv[4] ?? "eng";   // rule 11: a language is a codec; a language with no grammar is a TYPED GAP, never English by default
const g = await m.grammarFor(LANG); if (g.gap) throw new Error(`${g.gap}: ${g.why}`);
const arg = process.argv[2], out = process.argv[3];
const files = arg.endsWith(".json") && Array.isArray(JSON.parse(fs.readFileSync(arg, "utf8"))) ? JSON.parse(fs.readFileSync(arg, "utf8")).map((q) => q.file) : fs.readdirSync(arg).filter((f) => f.endsWith(".json")).sort().map((f) => `${arg}/${f}`);
const res = [];
for (const file of files) {
  const d = JSON.parse(fs.readFileSync(file, "utf8")), text = d.text, cps = [...text]; const u16 = new Array(cps.length + 1); { let o = 0; for (let i = 0; i < cps.length; i++) { u16[i] = o; o += cps[i].length; } u16[cps.length] = o; }
  const sent = d.sentences.map((s) => [u16[s.c0], u16[s.c1]]), sentOf = (at) => { let lo = 0, hi = sent.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (sent[mid][0] <= at) lo = mid; else hi = mid - 1; } return lo; };
  const rows = m.readingRows(g, text).filter((r) => r.at != null);
  const names = [], idx = new Map(), mentions = [];
  for (const l of d.links) { const k = key(l.anchor); if (!idx.has(k)) { idx.set(k, names.length); names.push({ anchor: l.anchor, key: k, targets: new Set(), sents: new Set() }); } const c = names[idx.get(k)]; c.targets.add(l.target); c.sents.add(l.sent); mentions.push({ cls: k, at: u16[l.c0], end: u16[l.c1] }); }
  const tokOf = new Map(), tokens = rows.map((r, i) => { tokOf.set(`${r.s}:${r.id}`, i); return r; });
  const T = tokens.map((r) => { const mn = mentions.find((x) => r.at >= x.at && r.end <= x.end); return { sent: sentOf(r.at), upos: r.upos, lemma: key(r.lemma ?? r.form), dep: r.deprel ?? "", cls: mn ? idx.get(mn.cls) : -1, head: r.head === 0 ? -1 : (tokOf.get(`${r.s}:${r.head}`) ?? -1), at: r.at }; });
  const bres = bindingsOf(rows, mentions.map((mn) => ({ being: mn.cls, at: mn.at, end: mn.end })), { window: 3 }), anaphors = [];
  for (const a of bres.anaphors) { const ti = tokens.findIndex((r) => r.at === a.anaphor.at); const cs = [...new Set(a.candidates.filter((c) => c.ref?.being != null && idx.has(c.ref.being) && c.agreement.number !== "mismatch").map((c) => idx.get(c.ref.being)))]; if (ti >= 0 && cs.length) anaphors.push({ tok: ti, classes: cs.sort((x, y) => x - y) }); }
  res.push({ file, title: d.title, n: d.sentences.length, classes: names.map((c) => ({ anchor: c.anchor, key: c.key, targets: [...c.targets].sort(), sents: [...c.sents].sort((a, b) => a - b) })), tokens: T, anaphors });
}
fs.writeFileSync(out, JSON.stringify(res)); console.log(`wrote ${out}: ${res.length} documents, ${res.reduce((s, r) => s + r.tokens.length, 0)} tokens, ${res.reduce((s, r) => s + r.anaphors.length, 0)} anaphors with candidates`);
