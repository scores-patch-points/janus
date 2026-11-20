// claimgraph.mjs <dir-or-queries.json> <out.json>: PREREG-CLAIM-GRAPH-UNIVERSE. Per document, the CLAIM GRAPH a universe grows through. A STRUCTURE extractor: it writes facts and judges nothing.
//   classes   the distinct anchor strings of the document's in-prose link mentions (the declared string handle; the link TARGET is carried only as the hidden gold label and no arm reads it)
//   clauses   per reader sentence, per predicate head: the classes whose mention is an ARGUMENT of that head (the mention's root token carries a UD core-argument relation: ARG below, the parser's own labels, giver UD)
//   anaphors  Janus's binding-evidence candidates (all listed, none chosen, number mismatch excluded) as { sent, classes } for the CGB arm
// No regex, no word list: the offsets are the reader's; the anchor class key is the lower-cased NFKD string with marks dropped.
import fs from "node:fs";
const m = await import("/Users/mlacy/Documents/khora-pharos-reading/native/the-fold/pharos-reading.mjs");
const { bindingsOf } = await import("/Users/mlacy/Documents/janus/native/organs/binding-evidence.mjs");
const { depBase } = await import("/Users/mlacy/Documents/janus/native/organs/binding-evidence.mjs");
export const ARG = new Set(["nsubj", "obj", "iobj", "obl", "csubj", "ccomp", "xcomp"]);   // UD core argument relations (declared; giver: Universal Dependencies)
const key = (s) => [...s.normalize("NFKD").toLowerCase()].filter((c) => !(c.codePointAt(0) >= 0x300 && c.codePointAt(0) <= 0x36f)).join("");   // marks dropped by code range: no regex
const LANG = process.env.LANG_CODE ?? process.argv[4] ?? "eng";   // rule 11: a language is a codec; a language with no grammar is a TYPED GAP, never English by default
const g = await m.grammarFor(LANG); if (g.gap) throw new Error(`${g.gap}: ${g.why}`);
const arg = process.argv[2], out = process.argv[3];
const files = arg.endsWith(".json") && Array.isArray(JSON.parse(fs.readFileSync(arg, "utf8"))) ? JSON.parse(fs.readFileSync(arg, "utf8")).map((q) => q.file) : fs.readdirSync(arg).filter((f) => f.endsWith(".json")).sort().map((f) => `${arg}/${f}`);
const res = [];
for (const file of files) {
  const d = JSON.parse(fs.readFileSync(file, "utf8")), text = d.text, cps = [...text]; const u16 = new Array(cps.length + 1); { let o = 0; for (let i = 0; i < cps.length; i++) { u16[i] = o; o += cps[i].length; } u16[cps.length] = o; }
  const sent = d.sentences.map((s) => [u16[s.c0], u16[s.c1]]), sentOf = (at) => { let lo = 0, hi = sent.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (sent[mid][0] <= at) lo = mid; else hi = mid - 1; } return lo; };
  const rows = m.readingRows(g, text).filter((r) => r.at != null);
  const cls = new Map(), mentions = [];
  for (const l of d.links) { const k = key(l.anchor); if (!cls.has(k)) cls.set(k, { anchor: l.anchor, key: k, targets: new Set(), sents: new Set() }); const c = cls.get(k); c.targets.add(l.target); c.sents.add(l.sent); mentions.push({ cls: k, at: u16[l.c0], end: u16[l.c1], target: l.target }); }
  const names = [...cls.keys()], idx = new Map(names.map((k, i) => [k, i]));
  // the reader's row ids are per reader sentence: a clause is (reader sentence, head id)
  const bySent = new Map(); for (const r of rows) { if (!bySent.has(r.s)) bySent.set(r.s, new Map()); bySent.get(r.s).set(r.id, r); }
  const clauses = new Map(); let inArg = 0, noRoot = 0;
  for (const mn of mentions) {
    const toks = rows.filter((r) => r.at >= mn.at && r.end <= mn.end); if (!toks.length) { noRoot++; continue; }
    const ids = new Set(toks.map((r) => r.id)), s = toks[0].s, root = toks.find((r) => !ids.has(r.head) || r.s !== s) ?? toks[0];
    if (root.head === 0 || !ARG.has(depBase(root.deprel))) continue;
    const ck = `${root.s}:${root.head}`; if (!clauses.has(ck)) { const hd = bySent.get(root.s)?.get(root.head); clauses.set(ck, { sent: sentOf(hd?.at ?? root.at), members: new Set() }); }
    clauses.get(ck).members.add(idx.get(mn.cls)); inArg++;
  }
  // the SECOND declared string handle (LEMMA): an argument that is not a link mention and is a common or proper noun joins the clause as a node keyed by its reader lemma; pronouns are left to the binding evidence
  const inMention = (r) => mentions.some((mn) => r.at >= mn.at && r.end <= mn.end), lemmaNode = new Map();
  for (const r of rows) {
    if (!ARG.has(depBase(r.deprel)) || r.head === 0 || (r.upos !== "NOUN" && r.upos !== "PROPN") || inMention(r)) continue;
    const lk = "L:" + key(r.lemma ?? r.form); if (!lemmaNode.has(lk)) lemmaNode.set(lk, names.length + lemmaNode.size);
    const ck = `${r.s}:${r.head}`; if (!clauses.has(ck)) { const hd = bySent.get(r.s)?.get(r.head); clauses.set(ck, { sent: sentOf(hd?.at ?? r.at), members: new Set() }); }
    clauses.get(ck).members.add(lemmaNode.get(lk));
  }
  const beings = mentions.map((mn) => ({ being: mn.cls, at: mn.at, end: mn.end })), bres = bindingsOf(rows, beings, { window: 3 }), anaphors = [];
  for (const a of bres.anaphors) { const cs = [...new Set(a.candidates.filter((c) => c.ref?.being != null && idx.has(c.ref.being) && c.agreement.number !== "mismatch").map((c) => idx.get(c.ref.being)))]; if (cs.length) anaphors.push({ sent: sentOf(a.anaphor.at), classes: cs.sort((x, y) => x - y) }); }
  res.push({ file, title: d.title, n: d.sentences.length, classes: names.map((k) => ({ anchor: cls.get(k).anchor, key: k, targets: [...cls.get(k).targets].sort(), sents: [...cls.get(k).sents].sort((a, b) => a - b) })),
    clauses: [...clauses.values()].filter((c) => c.members.size >= 1).map((c) => ({ sent: c.sent, members: [...c.members].sort((a, b) => a - b) })), anaphors, nLemma: lemmaNode.size, stats: { mentions: mentions.length, inArg, noRoot, rows: rows.length } });
}
fs.writeFileSync(out, JSON.stringify(res)); console.log(`wrote ${out}: ${res.length} documents, ${res.reduce((s, r) => s + r.classes.length, 0)} anchor classes, ${res.reduce((s, r) => s + r.clauses.length, 0)} clauses, ${res.reduce((s, r) => s + r.anaphors.length, 0)} anaphors with candidates`);
