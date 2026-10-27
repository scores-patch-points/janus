// bin.mjs — the hyperlexicon door's reader for HyperlexiconBin@1, the DMD-bounded binary store (under 1 GB; v1 was 18 GB).
//   node native/organs/hyperlexicon/door.mjs --bin <dir> [--port 11450]
// What it holds: the givers' names as written (surface -> node, language, kind, part of speech, the lemma it is a form of), the givers'
// relations and translation links between nodes, and per corpus type its uses, documents and the first two documents that heard it
// (birth and corroboration) — for a type a giver names or two documents carry. A type heard once and named by no giver is counted in
// the manifest, not stored: it cannot change a standing. No postings, no glosses, no per-use addresses.
// Asks served: names, context, relations, node. The asks that read postings (uses, company, along, absence, nodes, reopen, after,
// dotted) answer a typed gap `no_postings`, never an empty answer. Layout: build_hl_bin.py (little-endian arrays, *.off u64 into *.bin).
import fs from "node:fs";
import path from "node:path";

const NONE = 0xFFFFFFFF;
const GAP_POSTINGS = "this store holds no postings (HyperlexiconBin@1 keeps names, relations, links and per-type counters); v1 serves the asks that read them";

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
  if (manifest.schema !== "HyperlexiconBin@1") throw new Error(`not a HyperlexiconBin@1 store: ${manifest.schema}`);
  const col = (n, T) => column(path.join(dir, n), T);
  const types = strings(dir, "types"), surf = strings(dir, "names.surface"), ofs = strings(dir, "names.of");
  const tUses = col("types.uses", Uint32Array), tDocs = col("types.docs", Uint32Array), tBirth = col("types.birth", Uint32Array), tCorrob = col("types.corrob", Uint32Array), tNamed = col("types.named", Uint8Array);
  const grp = col("names.grp", Uint32Array), nNode = col("names.node", Uint32Array), nLang = col("names.lang", Uint16Array), nKind = col("names.kind", Uint8Array), nPos = col("names.pos", Uint8Array), nOf = col("names.of", Uint32Array), fold = col("names.fold", Uint32Array);
  const ids = col("nodes.id", BigUint64Array), nodePosList = col("nodes.pos", Uint8Array);
  const relFrom = col("rel.from", Uint32Array), relTo = col("rel.to", Uint32Array), relType = col("rel.type", Uint8Array);
  const linkFrom = col("link.from", Uint32Array), linkTo = col("link.to", Uint32Array), linkKind = col("link.kind", Uint8Array), linkLang = col("link.lang", Uint16Array);
  const { langs, kinds, rels, pos } = manifest;
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
  const row = (r) => ({ node: nodeName(nNode[r]), lang: langs[nLang[r]], kind: kinds[nKind[r]], pos: posOf(r), ...(nOf[r] !== NONE ? { of: [ofs.str(nOf[r])] } : {}) });
  const exact = (s) => { const i = surf.find(Buffer.from(s, "utf8")); const out = []; if (i >= 0) for (let r = grp[i]; r < grp[i + 1]; r++) out.push(r); return out; };
  // every surface that folds (lower-cases) to `low`, via the folded index; compares the lower-cased surface by its UTF-8 bytes
  const foldKey = (i) => Buffer.from(surf.str(i).toLowerCase(), "utf8");
  const folded = (low) => {
    const key = Buffer.from(low, "utf8"); let lo = 0, hi = fold.length;
    while (lo < hi) { const m = (lo + hi) >>> 1; if (Buffer.compare(foldKey(fold[m]), key) < 0) lo = m + 1; else hi = m; }
    const out = []; for (let k = lo; k < fold.length && Buffer.compare(foldKey(fold[k]), key) === 0; k++) out.push(fold[k]);
    return out;
  };
  const rowsOfSurface = (i) => { const out = []; for (let r = grp[i]; r < grp[i + 1]; r++) out.push(r); return out; };
  const typeAt = (word) => types.find(Buffer.from(String(word).toLowerCase(), "utf8"));

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
          const all = folded(sf.toLowerCase()).flatMap(rowsOfSurface);          // the index folds case, as v1's names-index did
          const here = all.filter((r) => langs[nLang[r]] === lang);
          const written = exact(sf).filter((r) => langs[nLang[r]] === lang).sort((x, y) => (kinds[nKind[x]] === "lemma" ? 0 : 1) - (kinds[nKind[y]] === "lemma" ? 0 : 1))    // as written: the surface exactly, case included
            .map((r) => ({ node: nodeName(nNode[r]), kind: kinds[nKind[r]], of: nOf[r] !== NONE ? [ofs.str(nOf[r])] : [], pos: posOf(r) }));
          const merged = new Map();
          for (const w of written) { const k = `${w.node}|${w.kind}`; const m = merged.get(k) ?? merged.set(k, { node: w.node, kind: w.kind, of: new Set(), pos: new Set() }).get(k); w.of.forEach((x) => m.of.add(x)); w.pos.forEach((x) => m.pos.add(x)); }
          out[sf] = { languages: new Set(all.map((r) => nLang[r])).size, here: here.map((r) => { const x = row(r); return { node: x.node, kind: x.kind, lang: x.lang, pos: x.pos, ...(x.of ? { of: x.of } : {}) }; }),
            written: [...merged.values()].map((m) => ({ node: m.node, kind: m.kind, of: [...m.of], pos: [...m.pos] })) };
        }
        return { head, lang, standing: "given · ungrounded · undecided", surfaces: out };
      }
      case "context": {
        const words = Array.isArray(ask.words) ? ask.words.filter((w) => typeof w === "string").slice(0, 200) : null;
        if (!words) return refuse("no_words");
        const lang = typeof ask.lang === "string" ? ask.lang : ground.language ?? null, out = {};
        for (const w of words) {
          const t = typeAt(w), cands = folded(w.toLowerCase()).flatMap(rowsOfSurface).filter((r) => !lang || langs[nLang[r]] === lang);
          const base = { candidates: cands.slice(0, 6).map((r) => ({ kind: kinds[nKind[r]], lang: langs[nLang[r]], ...row(r) })), candidatesTotal: cands.length };
          if (t < 0) { out[w] = { uses: 0, null: "never-set", scope: "the store keeps counters only for a type a giver names or two documents carry", ...base }; continue; }
          out[w] = { uses: tUses[t], documents: tDocs[t], corroborated: tDocs[t] >= 2, witnesses: { birth: tBirth[t] === NONE ? null : tBirth[t], corroboration: tCorrob[t] === NONE ? null : tCorrob[t] },
            dated: { gap: "no_postings", scope: GAP_POSTINGS }, ...base };
        }
        return { head, ground, lang, words: out };
      }
      case "relations": {
        if (typeof ask.id !== "string") return refuse("no_id");
        const n = nodeIx(ask.id); if (n < 0) return { head, null: "unknown", gap: "not_a_giver_node", node: ask.id };
        const lowerBound = (col) => { let lo = 0, hi = col.length; while (lo < hi) { const m = (lo + hi) >>> 1; if (col[m] < n) lo = m + 1; else hi = m; } return lo; };
        const out = [], links = [];
        for (let k = lowerBound(relFrom); k < relFrom.length && relFrom[k] === n; k++) out.push({ rel: rels[relType[k]], to: nodeName(relTo[k]) });
        for (let k = lowerBound(linkFrom); k < linkFrom.length && linkFrom[k] === n; k++) links.push({ kind: kinds[linkKind[k]], to: nodeName(linkTo[k]), lang: langs[linkLang[k]] || null });
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
