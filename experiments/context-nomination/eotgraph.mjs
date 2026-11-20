// eotgraph.mjs <dir-or-queries.json> <out.json> <eotdocs-dir> [lang]: ADDENDUM-4 of PREREG-CLAIM-GRAPH-UNIVERSE. The documents PARSED INTO EOT (REFERENT-FIRST rule 11): text -> the language's codec (nl-eot.mjs loadGrammar, read) -> EOT records (khora kernel/eot-rich.js toEot).
// Output has the SAME shape as fullgraph.mjs so the frozen scorers run unchanged, but its tokens ARE the EOT content nodes (function words and punctuation absorbed or dropped), its heads/relations are the EOT arcs, copulas are read from absorbed markers (`mk`), the class handle is the set of content lemmas of the mention, and the sentences an embedder sees are the sentence's content-lemma set (no order).
// Anaphors are recomputed on EOT: pronoun nodes and definite-description nodes; candidates = class nodes in the same sentence and the previous 3, minus a cube-addressed Number/Gender mismatch; all listed, none chosen. No regex, no word list, no model.
import fs from "node:fs";
import { loadGrammar, read } from "/Users/mlacy/Documents/janus/native/organs/nl-eot.mjs";
import { tokenize, sentences } from "/Users/mlacy/Documents/khora/native/adapters/text/ud-tokenizer.js";
const LANG = process.env.LANG_CODE ?? process.argv[5] ?? "eng", WINDOW = 3;
const G = loadGrammar(LANG); if (G.gap) throw new Error(`${G.gap}: ${G.why}`);   // rule 11: no codec, no reading
const key = (s) => [...s.normalize("NFKD").toLowerCase()].filter((c) => !(c.codePointAt(0) >= 0x300 && c.codePointAt(0) <= 0x36f)).join("");
const base = (d) => { const s = String(d ?? ""), i = s.indexOf(":"); return i < 0 ? s : s.slice(0, i); };
const arg = process.argv[2], out = process.argv[3], docDir = process.argv[4]; fs.mkdirSync(docDir, { recursive: true });
const files = arg.endsWith(".json") && Array.isArray(JSON.parse(fs.readFileSync(arg, "utf8"))) ? JSON.parse(fs.readFileSync(arg, "utf8")).map((q) => q.file) : fs.readdirSync(arg).filter((f) => f.endsWith(".json")).sort().map((f) => `${arg}/${f}`);
const feat = (n, name) => n.feats.find((f) => f.name === name)?.value ?? null;
const res = []; let misaligned = 0, sentTotal = 0, noContent = 0, mentionTotal = 0;
for (const file of files) {
  const d = JSON.parse(fs.readFileSync(file, "utf8")), text = d.text, cps = [...text]; const u16 = new Array(cps.length + 1); { let o = 0; for (let i = 0; i < cps.length; i++) { u16[i] = o; o += cps[i].length; } u16[cps.length] = o; }
  const dsent = d.sentences.map((s) => [u16[s.c0], u16[s.c1]]), sentOf = (at) => { let lo = 0, hi = dsent.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (dsent[mid][0] <= at) lo = mid; else hi = mid - 1; } return lo; };
  const recs = read(G, text).records; let ri = 0, cur = 0;
  const nodes = [], arcs = [], tokSpans = [];   // nodes: global content nodes; tokSpans: [at, end, nodeIdx] for the content tokens of each sentence
  for (const s of sentences(text, "und", G.tokenizer)) {
    const forms = tokenize(s, G.tokenizer); if (!forms.length) continue; const rec = recs[ri++]; sentTotal++;
    const b0 = text.indexOf(s, cur); if (b0 >= 0) cur = b0 + s.length;
    const keyOfId = rec.surface.keyOfId, ids = Object.keys(keyOfId); if (b0 < 0 || ids.length !== forms.length) { misaligned++; continue; }
    const idxOfKey = new Map(), mkOf = new Map(); let c = 0; const span = [];
    for (let i = 0; i < forms.length; i++) { const f = forms[i], j = s.indexOf(f, c); if (j < 0) { span.push(null); continue; } c = j + f.length; span.push([b0 + j, b0 + c]); }
    const sentIdx = sentOf(b0);
    for (const nd of rec.meaning.nodes) { idxOfKey.set(nd.key, nodes.length); nodes.push({ sent: sentIdx, lemma: key(nd.lemma ?? ""), upos: nd.upos, dep: "", cls: -1, head: -1, mk: [], feats: Object.fromEntries(nd.feats.map((f) => [f.name, f.value])), definite: false, _key: nd.key, _markers: nd.markers }); }
    const markerByKey = new Map(rec.meaning.markers.map((m) => [m.key, m]));
    for (const nd of rec.meaning.nodes) { const n = nodes[idxOfKey.get(nd.key)]; for (const mk of nd.markers) { const m = markerByKey.get(mk); if (!m) continue; n.mk.push(base(m.rel)); if (base(m.rel) === "det" && (m.feats ?? []).some((f) => f.name === "Definite" && f.value === "Def")) n.definite = true; } }
    for (const a of rec.meaning.arcs) { const to = idxOfKey.get(a.to), from = a.from == null ? -1 : (idxOfKey.get(a.from) ?? -1); if (to == null) continue; nodes[to].dep = a.rel; nodes[to].head = from; }
    for (let i = 0; i < forms.length; i++) { const k = keyOfId[String(i + 1)]; if (span[i] && idxOfKey.has(k)) tokSpans.push([span[i][0], span[i][1], idxOfKey.get(k)]); }
  }
  // mentions -> classes: the class handle is the SET of content lemmas of the mention's nodes (EOT-level), else the surface key
  const cls = new Map(), classes = [], mentionNodes = [];
  for (const l of d.links) {
    mentionTotal++; const at = u16[l.c0], end = u16[l.c1], ns = [...new Set(tokSpans.filter((t) => t[0] >= at && t[1] <= end).map((t) => t[2]))];
    let k; if (ns.length) k = "e:" + [...new Set(ns.map((i) => nodes[i].lemma))].sort().join("|"); else { k = "s:" + key(l.anchor); noContent++; }
    if (!cls.has(k)) { cls.set(k, classes.length); classes.push({ anchor: ns.length ? [...new Set(ns.map((i) => nodes[i].lemma))].sort().join(" ") : l.anchor, key: k, targets: new Set(), sents: new Set() }); }
    const c = classes[cls.get(k)]; c.targets.add(l.target); c.sents.add(l.sent); for (const i of ns) if (nodes[i].cls < 0) nodes[i].cls = cls.get(k);
  }
  // anaphors on EOT: pronoun nodes and definite descriptions; candidates = class nodes in the same + previous WINDOW sentences, cube-addressed Number/Gender mismatch excluded
  const bySent = new Map(); nodes.forEach((n, i) => { if (n.cls >= 0) { if (!bySent.has(n.sent)) bySent.set(n.sent, []); bySent.get(n.sent).push(i); } });
  const anaphors = [];
  nodes.forEach((n, i) => {
    const pron = n.upos === "PRON" && (n.feats.PronType === "Prs" || n.feats.PronType === undefined), defd = n.upos === "NOUN" && n.definite && n.cls < 0; if (!pron && !defd) return;
    const cs = new Set(); for (let s = n.sent - WINDOW; s <= n.sent; s++) for (const j of bySent.get(s) ?? []) { const m = nodes[j]; if (j === i) continue; const bad = (a, b) => a != null && b != null && a !== b; if (bad(n.feats.Number, m.feats.Number) || bad(n.feats.Gender, m.feats.Gender)) continue; cs.add(m.cls); }
    if (cs.size) anaphors.push({ tok: i, classes: [...cs].sort((x, y) => x - y) });
  });
  // the EOT surrogate document: one line per ORIGINAL sentence = its content-lemma set, no order (the representation an embedder is shown)
  const bag = d.sentences.map(() => new Set()); for (const n of nodes) if (n.lemma) bag[n.sent].add(n.lemma);
  let pos = 0, sur = ""; const ss = []; for (const b of bag) { const t = [...b].sort().join(" "), c0 = [...sur].length; sur += t + "\n"; ss.push({ c0, c1: c0 + [...t].length }); }
  const base2 = file.slice(file.lastIndexOf("/") + 1), docFile = `${docDir}/${base2}`; fs.writeFileSync(docFile, JSON.stringify({ title: d.title, text: sur, sentences: ss }));
  res.push({ file: docFile, title: d.title, n: d.sentences.length, classes: classes.map((c) => ({ anchor: c.anchor, key: c.key, targets: [...c.targets].sort(), sents: [...c.sents].sort((a, b) => a - b) })), tokens: nodes.map(({ sent, upos, lemma, dep, cls, head, mk }) => ({ sent, upos, lemma, dep, cls, head, mk })), anaphors });
}
fs.writeFileSync(out, JSON.stringify(res));
console.log(`wrote ${out}: ${res.length} documents, ${res.reduce((s, r) => s + r.tokens.length, 0)} EOT content nodes, ${res.reduce((s, r) => s + r.classes.length, 0)} classes (content-lemma handle), ${res.reduce((s, r) => s + r.anaphors.length, 0)} EOT anaphors with candidates; sentences ${sentTotal}, misaligned and skipped ${misaligned}; mentions ${mentionTotal}, with no content node ${noContent}`);
