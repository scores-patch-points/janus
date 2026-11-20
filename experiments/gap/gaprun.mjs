// gaprun.mjs <rows.json> <out.json> [lang]: PREREG-GAP-PRONOUN-EOT. Per GAP row, the decisions of the structure arms. Every arm outputs A, B, NEITHER or HELD; none reads the gold.
//   EOT_J   the passage parsed into EOT (nl-eot.mjs read: content nodes, cube-addressed arcs and features, absorbed markers); candidates removed only by a cube-addressed Gender or Number mismatch (Janus's facts)
//   EOT_P   EOT_J plus the MIRROR of Penelope's three declared rules over EOT records: gender-clash (cube), non-nominal (upos), disjoint-reference (core arguments of one predicate). A test double, labelled a mirror; no DEF is written anywhere
//   ROWS_P  Penelope's own organ (organs/anaphor-commit.mjs `decide`) run over the reader's surface rows (the GRAMMAR level), A and B as the spectrum
//   SHUF    EOT_P with the cube features and the head/relation structure shuffled among the passage's nodes (seeded): same strings, structure destroyed
// survivors: 1 -> that candidate; 0 -> NEITHER; 2 -> HELD. No regex, no word list, no model. A language with no codec is a typed gap (rule 11).
import fs from "node:fs";
import { loadGrammar, read } from "/Users/mlacy/Documents/janus/native/organs/nl-eot.mjs";
import { tokenize, sentences } from "/Users/mlacy/Documents/khora/native/adapters/text/ud-tokenizer.js";
import { decide } from "/Users/mlacy/Documents/khora-cast/penelope/organs/anaphor-commit.mjs";
const m = await import("/Users/mlacy/Documents/khora-pharos-reading/native/the-fold/pharos-reading.mjs");
const LANG = process.env.LANG_CODE ?? process.argv[4] ?? "eng", SEED = 20261119, CORE = ["nsubj", "obj", "iobj"];
const G = loadGrammar(LANG); if (G.gap) throw new Error(`${G.gap}: ${G.why}`);
const GR = await m.grammarFor(LANG); if (GR.gap) throw new Error(`${GR.gap}: ${GR.why}`);
const base = (d) => { const s = String(d ?? ""), i = s.indexOf(":"); return i < 0 ? s : s.slice(0, i); };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
const rows = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), out = [];
let noPron = 0, swapViolations = 0;
function eotNodes(text) {
  const recs = read(G, text).records, nodes = []; let ri = 0, cur = 0, sentIdx = 0;
  for (const s of sentences(text, "und", G.tokenizer)) {
    const forms = tokenize(s, G.tokenizer); if (!forms.length) continue; const rec = recs[ri++], b0 = text.indexOf(s, cur); if (b0 >= 0) cur = b0 + s.length;
    const keyOfId = rec.surface.keyOfId; if (b0 < 0 || Object.keys(keyOfId).length !== forms.length) { sentIdx++; continue; }
    const idx = new Map(), span = []; let c = 0;
    for (const f of forms) { const j = s.indexOf(f, c); if (j < 0) { span.push(null); continue; } c = j + f.length; span.push([b0 + j, b0 + c]); }
    for (const nd of rec.meaning.nodes) { idx.set(nd.key, nodes.length); nodes.push({ sent: sentIdx, upos: nd.upos, lemma: nd.lemma, feats: Object.fromEntries(nd.feats.map((f) => [f.name, f.value])), head: -1, dep: "", at: null, end: null }); }
    for (const a of rec.meaning.arcs) { const to = idx.get(a.to); if (to == null) continue; nodes[to].dep = a.rel; nodes[to].head = a.from == null ? -1 : (idx.get(a.from) ?? -1); }
    for (let i = 0; i < forms.length; i++) { const n = idx.get(keyOfId[String(i + 1)]); if (n != null && span[i]) { nodes[n].at = span[i][0]; nodes[n].end = span[i][1]; } }
    sentIdx++;
  }
  return nodes;
}
const lift = (N, i) => { let c = i; for (let n = 0; n < 32 && c >= 0 && base(N[c].dep) === "conj"; n++) c = N[c].head; return c; };
const mentionHead = (N, a, b) => { const ids = N.map((n, i) => (n.at != null && n.at >= a && n.end <= b ? i : -1)).filter((i) => i >= 0), set = new Set(ids); return ids.find((i) => !set.has(N[i].head)) ?? ids[0] ?? null; };
const mismatch = (x, y) => x != null && y != null && x !== y;
/** the three declared rules over EOT nodes; returns { J: survivors after cube agreement only, P: survivors after all rules } for candidates {A: nodeIdx, B: nodeIdx} */
function eotDecide(N, pi, cands) {
  const p = N[pi], gender = p.feats.Gender ?? null, number = p.feats.Number ?? null, reflexive = p.feats.Reflex === "Yes", possessive = p.feats.Poss === "Yes", coreP = CORE.includes(base(p.dep)) && !reflexive && !possessive;
  const myLift = coreP ? lift(N, pi) : -1, J = [], P = [];
  for (const [ref, ci] of Object.entries(cands)) {
    if (ci == null) { J.push(ref); P.push(ref); continue; }
    const c = N[ci], gm = (gender === "Masc" || gender === "Fem") && mismatch(gender, c.feats.Gender ?? null), nm = mismatch(number, c.feats.Number ?? null);
    if (gm || nm) continue; J.push(ref);
    if ((gender === "Masc" || gender === "Fem") && c.upos !== "NOUN" && c.upos !== "PROPN") continue;                  // non-nominal
    if (coreP && myLift >= 0 && CORE.includes(base(N[myLift].dep))) { const l = lift(N, ci); if (l >= 0 && N[l].sent === N[myLift].sent && l !== myLift && N[l].head === N[myLift].head && CORE.includes(base(N[l].dep))) continue; }   // disjoint-reference
    P.push(ref);
  }
  return { J, P };
}
const verdict = (s) => (s.length === 1 ? s[0] : s.length === 0 ? "NEITHER" : "HELD");
const sepOf = (N, cands) => { const a = cands.A != null ? N[cands.A] : null, b = cands.B != null ? N[cands.B] : null; return !!(a && b && (mismatch(a.feats.Gender ?? null, b.feats.Gender ?? null) || mismatch(a.feats.Number ?? null, b.feats.Number ?? null) || (a.upos !== b.upos))); };
for (const row of rows) {
  const cp = [...row.text], u16 = new Array(cp.length + 1); { let o = 0; for (let i = 0; i < cp.length; i++) { u16[i] = o; o += cp[i].length; } u16[cp.length] = o; }
  const pA = u16[row.pOff], pE = u16[row.pOff + [...row.pronoun].length], aA = u16[row.aOff], aE = u16[row.aOff + [...row.A].length], bA = u16[row.bOff], bE = u16[row.bOff + [...row.B].length];
  const N = eotNodes(row.text), pi = N.findIndex((n) => n.at === pA && n.end === pE), r = { id: row.id, url: row.url, gold: row.gold, pOff: row.pOff, aOff: row.aOff, bOff: row.bOff, pronoun: row.pronoun };
  if (pi < 0) { noPron++; Object.assign(r, { EOT_J: "HELD", EOT_P: "HELD", SHUF: "HELD", gap: "no_pronoun_node", separable: false }); }
  else {
    const cands = { A: mentionHead(N, aA, aE), B: mentionHead(N, bA, bE) }, d = eotDecide(N, pi, cands);
    r.pgender = N[pi].feats.Gender ?? null; r.sameSent = [cands.A, cands.B].every((c) => c != null && N[c].sent === N[pi].sent); r.EOT_J = verdict(d.J); r.EOT_P = verdict(d.P); r.separable = sepOf(N, cands); r.nodes = N.length;
    const sw = eotDecide(N, pi, { A: cands.B, B: cands.A }), swapMap = (s) => s.map((x) => (x === "A" ? "B" : "A")).sort().join();   // swapped roles: survivors must map back identically
    if (swapMap(sw.P) !== [...d.P].sort().join()) swapViolations++;
    const rr = rng(SEED ^ hash(row.id)), idxs = N.map((_, i) => i), heads = shuffle(N.map((n) => n.head), rr), deps = N.map((n) => n.dep), feats = shuffle(N.map((n) => n.feats), rr), perm = shuffle([...idxs], rr);
    const S = N.map((n, i) => ({ ...n, head: heads[i], dep: deps[perm[i]], feats: feats[i] })); r.SHUF = verdict(eotDecide(S, pi, cands).P);
  }
  // ROWS_P: Penelope's organ over the reader's surface rows
  const rowsR = m.readingRows(GR, row.text).filter((x) => x.at != null);
  const dec = decide({ held: [{ pronoun: row.pronoun, at: [pA, pE], cands: [["A", 1], ["B", 1]], bound: null }], referents: [{ ref: "A", spans: [[aA, aE]], pronouns: [] }, { ref: "B", spans: [[bA, bE]], pronouns: [] }], rows: rowsR, evidence: [] });
  const dp = dec.pronouns[0]; r.ROWS_P = !dp ? "HELD" : dp.verdict === "committed" ? dp.defined : dp.survivors.length === 0 && dp.total > 0 && !(dp.gaps ?? []).some((g) => String(g).startsWith("no_")) ? "NEITHER" : "HELD"; r.rowsGaps = dp?.gaps ?? [];
  out.push(r);
}
fs.writeFileSync(process.argv[3], JSON.stringify({ rows: out, swapViolations, noPronounNode: noPron }));
const tally = (k) => out.reduce((o, r) => ((o[r[k]] = (o[r[k]] ?? 0) + 1), o), {});
console.log(`wrote ${process.argv[3]}: ${out.length} rows; no pronoun node ${noPron}; swap-invariance violations ${swapViolations}\nEOT_J ${JSON.stringify(tally("EOT_J"))}\nEOT_P ${JSON.stringify(tally("EOT_P"))}\nROWS_P ${JSON.stringify(tally("ROWS_P"))}\nSHUF ${JSON.stringify(tally("SHUF"))}`);
