// eotpriors.mjs: PREREG-EOT-PRIORS (stamp in its .sha256short). Priors with CONTENT mined from the EOT of confident readings. Every record goes through khora toEot (content nodes, absorbed markers, arcs: no word order, no surface form).
// The SURFACE arm is the labelled strings-only twin. Counts, add-one smoothing, giver per source; standing candidate. No regex, no word list, no model.
const KH = "/Users/mlacy/Documents/khora-pharos-reading";
const { toEot } = await import(`${KH}/native/kernel/eot-rich.js`);
export const base = (d) => String(d).split(":")[0], ALPHA = 1;
/** rows [{form, lemma, upos, head, deprel}] (1-based heads) -> a sentence object toEot accepts */
export const sentOf = (rows, id = "s") => ({ tokens: rows.map((r, i) => ({ id: i + 1, form: r.form, lemma: r.lemma ?? r.form, upos: r.upos, xpos: "_", feats: "_", head: r.head, deprel: r.deprel, deps: "_", misc: "_" })), lines: [], comments: [], multi: [], empty: [], sentId: id, text: null });
/** EOT arc records, token id (1-based) -> { d: lemma|UPOS, m: markers' lemmas sorted, rel, h: head lemma|UPOS }. A marker's record has itself as marker-less dependent and its host as head. */
export function recordsOf(rows, id = "s") {
  const sent = sentOf(rows, id), e = toEot(sent), nodes = new Map(e.meaning.nodes.map((n) => [n.key, n])), marks = new Map(e.meaning.markers.map((m) => [m.key, m])), arcTo = new Map(e.meaning.arcs.map((a) => [a.to, a])), out = new Map();
  const hostNode = (key) => { let k = key, g = 0; while (k && marks.has(k) && g++ < 50) k = marks.get(k).attachedTo; return nodes.get(k) ?? null; };
  const tag = (n) => (n ? `${n.lemma}|${n.upos}` : "ROOT");
  for (const t of sent.tokens) { const key = e.surface.keyOfId[t.id];
    if (nodes.has(key)) { const n = nodes.get(key), a = arcTo.get(key); out.set(t.id, { d: tag(n), m: n.markers.map((k) => marks.get(k)?.lemma ?? "?").sort().join("+"), rel: base(a?.rel ?? t.deprel), h: a?.from ? tag(nodes.get(a.from)) : "ROOT" }); }
    else if (marks.has(key)) { const m = marks.get(key); out.set(t.id, { d: `${m.lemma}|${m.upos}`, m: "", rel: base(m.rel), h: tag(hostNode(m.attachedTo)) }); } }
  return out;
}
/** the SURFACE twin: strings only, the linear previous token in place of the markers */
export const surfaceRecord = (rows, i, head, deprel) => ({ d: rows[i].form.toLowerCase(), m: i > 0 ? rows[i - 1].form.toLowerCase() : "<s>", rel: base(deprel), h: head === 0 ? "ROOT" : rows[head - 1].form.toLowerCase() });
const bump = (map, k1, k2) => { if (!map.has(k1)) map.set(k1, new Map()); const x = map.get(k1); x.set(k2, (x.get(k2) ?? 0) + 1); };
/** four count tables from records; relabel(r) permutes relation labels for the shuffled twin. E1 dep -> (rel, head); E2 head -> (rel, dep); E3 dep class -> (rel, head); E4 head -> (rel, dep class) */
export function newTables() { return { E1: new Map(), E2: new Map(), E3: new Map(), E4: new Map(), out: [new Set(), new Set(), new Set(), new Set()] }; }
export function mineInto(T, rec, relabel = (r) => r) {
  const r = relabel(rec.rel), dc = rec.d.split("|")[1] ? `${rec.d.split("|")[1]}+${rec.m}` : `${rec.d}+${rec.m}`;   // class of the dependent: its UPOS and markers (surface: the previous token)
  const full = `${rec.d}+${rec.m}`, o1 = `${r}>${rec.h}`, o2 = `${r}<${full}`, o4 = `${r}<${dc}`;
  bump(T.E1, full, o1); bump(T.E2, rec.h, o2); bump(T.E3, dc, o1); bump(T.E4, rec.h, o4); T.out[0].add(o1); T.out[1].add(o2); T.out[2].add(o1); T.out[3].add(o4);
}
const lp = (tabs, name, k1, k2, K) => { let c = 0, tot = 0; for (const T of tabs) { const row = T[name].get(k1); if (row) { c += row.get(k2) ?? 0; tot += [...row.values()].reduce((a, b) => a + b, 0); } } return Math.log2((c + ALPHA) / (tot + ALPHA * K)); };
/** the four log2 weights of a candidate's record over a list of tables (gold, gold+silver...). An unseen context gives the same weight to every candidate: it abstains. */
export function weightsE(tabs, rec) {
  const dc = rec.d.split("|")[1] ? `${rec.d.split("|")[1]}+${rec.m}` : `${rec.d}+${rec.m}`, full = `${rec.d}+${rec.m}`, o1 = `${rec.rel}>${rec.h}`, o2 = `${rec.rel}<${full}`, o4 = `${rec.rel}<${dc}`;
  const K = (j) => Math.max(1, tabs.reduce((a, T) => a + T.out[j].size, 0));
  return { E1: lp(tabs, "E1", full, o1, K(0)), E2: lp(tabs, "E2", rec.h, o2, K(1)), E3: lp(tabs, "E3", dc, o1, K(2)), E4: lp(tabs, "E4", rec.h, o4, K(3)) };
}
export const totalE = (w) => w.E1 + w.E2 + w.E3 + w.E4;
