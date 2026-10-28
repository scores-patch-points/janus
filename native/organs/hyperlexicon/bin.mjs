// bin.mjs — the hyperlexicon door's reader for HyperlexiconBin@2, the DMD-bounded binary store (under 1 GB; v1 was 18 GB).
//   node native/organs/hyperlexicon/door.mjs --bin <dir> [--port 11450]
// What it holds: the givers' names as written (surface -> node, language, kind, part of speech, the lemma it is a form of, the giver),
// the givers' relations and translation links between nodes (each with its giver), and per (document language, corpus type) its uses,
// documents and the first two documents that heard it (birth and corroboration) — for a type a giver names or two documents carry. A
// type heard once and named by no giver is counted in the manifest, not stored: it cannot change a standing, and the store answers
// `unknown` for it, never `never-set`. No postings, no glosses, no per-use addresses.
// Language-neutral by construction: every incoming surface is NFC-normalized (the store is NFC); the case-folded index is ordered by a
// language-neutral skeleton, and a per-language adapter (FOLDS) decides which candidates really fold together in the asked language
// (Turkish dotted/dotless i, German sharp s); nothing splits on whitespace or assumes ASCII; names and types are plain UTF-8 strings.
// Asks served: names, context, relations, node. The asks that read postings (uses, company, along, absence, nodes, reopen, after,
// dotted) answer a typed gap `no_postings`, never an empty answer. Layout: build_hl_bin.py (little-endian arrays, *.off u64 into *.bin).
import fs from "node:fs";
import path from "node:path";

const NONE = 0xFFFFFFFF;
const GAP_POSTINGS = "this store holds no postings (HyperlexiconBin@2 keeps names, relations, links and per-type counters); v1 serves the asks that read them";

const nfc = (s) => String(s).normalize("NFC");
/** The key of the case-folded index (build_hl_bin.py skeleton(), the same rule): NFC, lower-case, U+0307 dropped, dotless i -> i, sharp s -> ss. */
export const skeleton = (s) => nfc(s).toLowerCase().replace(/̇/g, "").replace(/ı/g, "i").replace(/ß/g, "ss");
/** Per-language fold adapters: two spellings fold together in a language when its fold gives the same string. A language with no entry
 *  folds by NFC and lower-case. Add a language here, not in the lookup. */
const turkic = (s) => nfc(s).replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase().replace(/̇/g, "");
export const FOLDS = {
  tr: turkic, az: turkic,
  de: (s) => nfc(s).toLowerCase().replace(/ß/g, "ss"),
};
export const foldFor = (lang) => FOLDS[lang] ?? ((s) => nfc(s).toLowerCase());

/** Read a file into an aligned typed array (a Buffer's pool offset is not always aligned). */
function column(file, Type) {
  const b = fs.readFileSync(file);
  if (b.byteOffset % Type.BYTES_PER_ELEMENT === 0) return new Type(b.buffer, b.byteOffset, b.length / Type.BYTES_PER_ELEMENT);
  const copy = new Uint8Array(b.length); copy.set(b); return new Type(copy.buffer, 0, b.length / Type.BYTES_PER_ELEMENT);
}
const bytes = (file) => fs.readFileSync(file);

/** A sorted string table: strings i at bin[off[i]..off[i+1]], in UTF-8 byte order. */
function strings(dir, prefix) {
  const bin = bytes(path.join(dir, prefix + ".bin")), off = column(path.join(dir, prefix + ".off"), BigUint64Array);
  const n = off.length - 1, at = (i) => bin.subarray(Number(off[i]), Number(off[i + 1]));
  /** First index whose string is >= key (key a Buffer), by `cmp(string i, key)`. */
  const lower = (key, cmp = (i, k) => Buffer.compare(at(i), k)) => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >>> 1; if (cmp(m, key) < 0) lo = m + 1; else hi = m; } return lo; };
  return { n, at, str: (i) => at(i).toString("utf8"), find: (key) => { const i = lower(key); return i < n && Buffer.compare(at(i), key) === 0 ? i : -1; }, lower };
}

export function openHyperlexiconBin(dir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  if (manifest.schema !== "HyperlexiconBin@2") throw new Error(`not a HyperlexiconBin@2 store: ${manifest.schema}`);
  const col = (n, T) => column(path.join(dir, n), T);
  const types = strings(dir, "types"), surf = strings(dir, "names.surface"), ofs = strings(dir, "names.of");
  const tNamed = col("types.named", Uint8Array);
  const tcOff = col("tc.off", BigUint64Array), tcLang = col("tc.lang", Uint16Array), tcUses = col("tc.uses", Uint32Array), tcDocs = col("tc.docs", Uint32Array), tcBirth = col("tc.birth", Uint32Array), tcCorrob = col("tc.corrob", Uint32Array);
  const grp = col("names.grp", Uint32Array), nNode = col("names.node", Uint32Array), nLang = col("names.lang", Uint16Array), nKind = col("names.kind", Uint8Array), nPos = col("names.pos", Uint8Array), nOf = col("names.of", Uint32Array), nGiver = col("names.giver", Uint8Array), fold = col("names.fold", Uint32Array);
  const ids = col("nodes.id", BigUint64Array), nodePosList = col("nodes.pos", Uint8Array);
  const relFrom = col("rel.from", Uint32Array), relTo = col("rel.to", Uint32Array), relType = col("rel.type", Uint8Array), relGiver = col("rel.giver", Uint8Array);
  const linkFrom = col("link.from", Uint32Array), linkTo = col("link.to", Uint32Array), linkKind = col("link.kind", Uint8Array), linkLang = col("link.lang", Uint16Array), linkGiver = col("link.giver", Uint8Array);
  const { langs, kinds, rels, pos, givers, counter_langs: cLangs } = manifest;
  // the quoted source text of a relation row (rel.witness.json, keyed "<from node>|<to node>|<rel>"), when the store was built with one
  const witnesses = fs.existsSync(path.join(dir, "rel.witness.json")) ? JSON.parse(fs.readFileSync(path.join(dir, "rel.witness.json"), "utf8")) : {};
  // parts of speech of one name row: a lemma row carries its node's senses' parts of speech in the giver's sense order (nodes.pos, sixteen
  // u8 slots, code = pos index + 1); any other row (a form-of) carries only the pos this name row itself is written under
  const posOf = (r) => {
    if (kinds[nKind[r]] !== "lemma") return pos[nPos[r]] ? [pos[nPos[r]]] : [];
    const out = []; for (let k = 0, base = nNode[r] * 16; k < 16 && nodePosList[base + k]; k++) out.push(pos[nodePosList[base + k] - 1]);
    if (!out.length && pos[nPos[r]]) out.push(pos[nPos[r]]);
    return out;
  };
  const nodeName = (ix) => "n_" + ids[ix].toString(16).padStart(16, "0");
  const nodeIx = (id) => { if (!/^n_[0-9a-f]{16}$/.test(id)) return -1; const want = BigInt("0x" + id.slice(2)); let lo = 0, hi = ids.length; while (lo < hi) { const m = (lo + hi) >>> 1; if (ids[m] < want) lo = m + 1; else hi = m; } return lo < ids.length && ids[lo] === want ? lo : -1; };
  const row = (r) => ({ node: nodeName(nNode[r]), lang: langs[nLang[r]], kind: kinds[nKind[r]], pos: posOf(r), giver: givers[nGiver[r]], ...(nOf[r] !== NONE ? { of: [ofs.str(nOf[r])] } : {}) });
  const exact = (s) => { const i = surf.find(Buffer.from(nfc(s), "utf8")); const out = []; if (i >= 0) for (let r = grp[i]; r < grp[i + 1]; r++) out.push(r); return out; };
  // every surface in the same skeleton run as `s`, via the folded index
  const skelKey = (i) => Buffer.from(skeleton(surf.str(i)), "utf8");
  const run = (s) => {
    const key = Buffer.from(skeleton(s), "utf8"); let lo = 0, hi = fold.length;
    while (lo < hi) { const m = (lo + hi) >>> 1; if (Buffer.compare(skelKey(fold[m]), key) < 0) lo = m + 1; else hi = m; }
    const out = []; for (let k = lo; k < fold.length && Buffer.compare(skelKey(fold[k]), key) === 0; k++) out.push(fold[k]);
    return out;
  };
  const rowsOfSurface = (i) => { const out = []; for (let r = grp[i]; r < grp[i + 1]; r++) out.push(r); return out; };
  /** The rows whose surface folds with `s` in `lang` (the adapter decides within the skeleton run); lang null folds by the default. */
  const foldedRows = (s, lang) => { const f = foldFor(lang), want = f(s); return run(s).filter((i) => f(surf.str(i)) === want).flatMap(rowsOfSurface); };
  const typeAt = (word) => types.find(Buffer.from(nfc(word).toLowerCase(), "utf8"));
  /** The counter groups of a type: [{lang, uses, documents, birth, corroboration}]. */
  const groupsOf = (t) => { const out = []; for (let k = Number(tcOff[t]); k < Number(tcOff[t + 1]); k++) out.push({ lang: cLangs[tcLang[k]], uses: tcUses[k], documents: tcDocs[k], birth: tcBirth[k], corroboration: tcCorrob[k] === NONE ? null : tcCorrob[k] }); return out; };

  const head = manifest.from_v1_head;
  const gap = (g, scope) => ({ head, null: "unknown", gap: g, scope });
  const refuse = (g, detail) => ({ refused: true, gap: g, detail });

  function answer(ask = {}) {
    const { op } = ask, ground = ask.ground && typeof ask.ground === "object" ? ask.ground : {};
    switch (op) {
      case "names": {
        const surfaces = Array.isArray(ask.surfaces) ? ask.surfaces.filter((w) => typeof w === "string").slice(0, 2000) : null;
        if (!surfaces) return refuse("no_surfaces");
        const lang = typeof ask.lang === "string" ? ask.lang : "en", out = {};
        for (const sf of surfaces) {
          const all = foldedRows(sf, null);                                      // every language, the default fold: how many languages write it
          const here = foldedRows(sf, lang).filter((r) => langs[nLang[r]] === lang);   // the asked language, its own fold
          const written = exact(sf).filter((r) => langs[nLang[r]] === lang).sort((x, y) => (kinds[nKind[x]] === "lemma" ? 0 : 1) - (kinds[nKind[y]] === "lemma" ? 0 : 1))    // as written: the surface exactly, case included
            .map((r) => ({ node: nodeName(nNode[r]), kind: kinds[nKind[r]], of: nOf[r] !== NONE ? [ofs.str(nOf[r])] : [], pos: posOf(r), giver: givers[nGiver[r]] }));
          const merged = new Map();
          for (const w of written) { const k = `${w.node}|${w.kind}`; const m = merged.get(k) ?? merged.set(k, { node: w.node, kind: w.kind, of: new Set(), pos: new Set(), giver: new Set() }).get(k); w.of.forEach((x) => m.of.add(x)); w.pos.forEach((x) => m.pos.add(x)); m.giver.add(w.giver); }
          out[sf] = { languages: new Set(all.map((r) => nLang[r])).size, here: here.map((r) => { const x = row(r); return { node: x.node, kind: x.kind, lang: x.lang, pos: x.pos, giver: x.giver, ...(x.of ? { of: x.of } : {}) }; }),
            written: [...merged.values()].map((m) => ({ node: m.node, kind: m.kind, of: [...m.of], pos: [...m.pos], giver: [...m.giver] })) };
        }
        return { head, lang, standing: "given · ungrounded · undecided", surfaces: out };
      }
      case "context": {
        const words = Array.isArray(ask.words) ? ask.words.filter((w) => typeof w === "string").slice(0, 200) : null;
        if (!words) return refuse("no_words");
        const lang = typeof ask.lang === "string" ? ask.lang : ground.language ?? null, docLang = typeof ground.language === "string" ? ground.language : null, out = {};
        for (const w of words) {
          const t = typeAt(w), cands = foldedRows(w, lang).filter((r) => !lang || langs[nLang[r]] === lang);
          const base = { candidates: cands.slice(0, 6).map((r) => ({ kind: kinds[nKind[r]], lang: langs[nLang[r]], ...row(r) })), candidatesTotal: cands.length };
          // heard once and named by no giver is not stored: that is `unknown`, not `never-set`
          if (t < 0) { out[w] = { uses: null, null: "unknown", gap: "unseen_or_single_sighting", scope: "the store keeps counters only for a type a giver names or two documents carry; this word was heard at most once", ...base }; continue; }
          const groups = groupsOf(t), g = docLang ? groups.filter((x) => x.lang === docLang) : groups;
          if (!g.length) { out[w] = { uses: 0, null: "never-set", scope: `no document whose language is ${docLang} holds it`, ...base }; continue; }
          const uses = g.reduce((a, x) => a + x.uses, 0), documents = g.reduce((a, x) => a + x.documents, 0);
          const firsts = g.flatMap((x) => [x.birth, x.corroboration]).filter((x) => x != null).sort((a, b) => a - b);   // the two earliest documents overall are among each group's first two
          out[w] = { uses, documents, corroborated: documents >= 2, witnesses: { birth: firsts[0] ?? null, corroboration: firsts[1] ?? null }, languages: g.length,
            dated: { gap: "no_postings", scope: GAP_POSTINGS }, ...base };
        }
        return { head, ground, lang, words: out };
      }
      case "relations": {
        if (typeof ask.id !== "string") return refuse("no_id");
        const n = nodeIx(ask.id); if (n < 0) return { head, null: "unknown", gap: "not_a_giver_node", node: ask.id };
        const lowerBound = (col) => { let lo = 0, hi = col.length; while (lo < hi) { const m = (lo + hi) >>> 1; if (col[m] < n) lo = m + 1; else hi = m; } return lo; };
        const out = [], links = [];
        for (let k = lowerBound(relFrom); k < relFrom.length && relFrom[k] === n; k++) { const w = witnesses[`${ask.id}|${nodeName(relTo[k])}|${rels[relType[k]]}`]; out.push({ rel: rels[relType[k]], to: nodeName(relTo[k]), giver: givers[relGiver[k]], ...(w ? { witness: w } : {}) }); }
        for (let k = lowerBound(linkFrom); k < linkFrom.length && linkFrom[k] === n; k++) links.push({ kind: kinds[linkKind[k]], to: nodeName(linkTo[k]), lang: langs[linkLang[k]] || null, giver: givers[linkGiver[k]] });
        return { head, node: ask.id, relations: out, links, standing: "given · ungrounded · undecided" };
      }
      case "node": {
        if (typeof ask.id !== "string") return refuse("no_id");
        return nodeIx(ask.id) < 0 ? { head, null: "unknown", gap: "not_a_giver_node", node: ask.id } : gap("no_node_record", "this store keeps a node's names and relations, not its glosses; ask `names` or `relations`");
      }
      case "uses": case "company": case "along": case "absence": case "nodes": case "reopen": case "after": case "dotted":
        return gap("no_postings", GAP_POSTINGS);
      default: return refuse("unknown_op", "asks are: names, context, relations, node (postings asks answer a typed gap)");
    }
  }
  return { head, manifest, answer, asks: ["names", "context", "relations", "node", "uses", "company", "along", "absence", "nodes", "reopen", "after", "dotted"] };
}
