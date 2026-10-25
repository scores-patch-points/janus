// traverse.mjs — the hyperlexicon's traversal API over the L1 projection of the v1 log (HYPERLEXICON-V1-JANUS-PLAN.md section 4).
//
// The log (L0) is janus's; Zenodotus holds the sources unchanged. L1 (`<log>/l1/`, compiled by scripts/hyperlexicon/s5_compile.py) answers
// "where is this word used, under which ground" fast; the per-document postings beside it (`<log>/postings/<doc>.npy`: type, byteStart,
// byteLength per token) are read on demand. Nothing is smeared: every answer returns the addresses it was computed from (`<path>#<byte>`,
// the weft's address) and the head hash of the log, every claim keeps its basis, every candidate stays undecided, and an empty answer is a
// typed null with its scope (THE-NULL-STATES.md), never a zero.
//
//   const hl = openHyperlexicon("/mnt/eo-data/janus-hyperlexicon/v1", { zen: "/mnt/eo-data/zenodotus-v1" });
//   hl.usesOf("consumption", { language: "en", year: [1800, 1850] }, { limit: 20 })
//   hl.nodesAt("20-first-person-voices/old-bailey/17000115.txt", 1234)
//   hl.relations("n_0123456789abcdef")
//   hl.companyOf("consumption", { language: "en" }, { radius: 5 })   // the reach is the caller's declaration, or measured by khora's dmdWindow
//   hl.along("consumption", { language: "en" })                       // the date-ordered profile, no bins
//   hl.absence("consumption", { year: [1950, 2026] })
//   hl.reopen(address, { length })                                   // the bytes behind an address (length: the use's own byte length)
import { openSync, readSync, readFileSync, existsSync, statSync, closeSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

const u8 = new TextEncoder(), d8 = new TextDecoder();

function readArray(file, Ctor) {
  const b = readFileSync(file); return new Ctor(b.buffer, b.byteOffset, b.byteLength / Ctor.BYTES_PER_ELEMENT);
}
function readSlice(fd, Ctor, from, n) {
  const buf = Buffer.alloc(n * Ctor.BYTES_PER_ELEMENT); if (n) readSync(fd, buf, 0, buf.length, from * Ctor.BYTES_PER_ELEMENT);
  return new Ctor(buf.buffer, buf.byteOffset, n);
}
// a numpy .npy file of uint32 with shape (n, 3): the postings of one document
function readNpyU32(file) {
  const b = readFileSync(file);
  if (b[0] !== 0x93 || b.toString("latin1", 1, 6) !== "NUMPY") throw new Error(`not an .npy file: ${file}`);
  const major = b[6], hlen = major === 1 ? b.readUInt16LE(8) : b.readUInt32LE(8), start = (major === 1 ? 10 : 12) + hlen;
  const header = b.toString("latin1", major === 1 ? 10 : 12, start);
  if (!/'descr':\s*'<u4'/.test(header) || /'fortran_order':\s*True/.test(header)) throw new Error(`unexpected postings layout in ${file}: ${header}`);
  const shape = header.match(/'shape':\s*\((\d+),\s*(\d+)?\)/); const rows = shape ? +shape[1] : 0;
  const copy = b.subarray(start); const aligned = Buffer.alloc(copy.length); copy.copy(aligned);
  return { rows, data: new Uint32Array(aligned.buffer, aligned.byteOffset, rows * 3) };
}
const cmpBytes = (a, b) => { const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; };

export function openHyperlexicon(logDir, { zen = null } = {}) {
  const L1 = join(logDir, "l1"), manifest = JSON.parse(readFileSync(join(L1, "manifest.json"), "utf8"));
  const head = manifest.compiled_from_head;
  const vocabBin = readFileSync(join(L1, "vocab.bin")), vocabOff = readArray(join(L1, "vocab.off"), BigUint64Array);
  const sorted = readArray(join(L1, "sorted.ids"), Uint32Array), V = sorted.length;
  const typeBytes = (t) => vocabBin.subarray(Number(vocabOff[t]), Number(vocabOff[t + 1]));
  const typeOf = (t) => d8.decode(typeBytes(t));
  const candOff = readArray(join(L1, "cands.off"), BigUint64Array), candLang = readArray(join(L1, "cands.lang"), Uint16Array);
  const candKind = readArray(join(L1, "cands.kind"), Uint8Array), candNode = readArray(join(L1, "cands.node"), BigUint64Array);
  const langs = JSON.parse(readFileSync(join(L1, "langs.json"), "utf8")), kinds = JSON.parse(readFileSync(join(L1, "kinds.json"), "utf8"));
  const t2dOff = readArray(join(L1, "t2d.off"), BigUint64Array), t2dDocFd = openSync(join(L1, "t2d.doc"), "r"), t2dCntFd = openSync(join(L1, "t2d.cnt"), "r");
  const docs = readFileSync(join(L1, "docs.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const byPath = new Map(docs.map((d) => [d.path, d]));
  const nodesIdx = JSON.parse(readFileSync(join(L1, "nodes.idx.json"), "utf8")), nodesFd = openSync(join(L1, "nodes.bin"), "r");
  const chunkCache = new Map();
  const zenRoot = zen;

  /** The type id of a surface (lowercased, as S1 tokenized it), or null. */
  function typeId(surface) {
    const key = u8.encode(String(surface).toLowerCase()); let lo = 0, hi = V - 1;
    while (lo <= hi) { const mid = (lo + hi) >> 1, c = cmpBytes(typeBytes(sorted[mid]), key); if (c === 0) return sorted[mid]; if (c < 0) lo = mid + 1; else hi = mid - 1; }
    return null;
  }
  const resolveType = (x) => (typeof x === "number" ? x : typeId(x));

  /** A ground is a filter over the documents' claims: { language, atmosphere, year: [lo, hi], <any claim>: value | [values] }.
   *  `language` reads the document's working language (with its method); `year` reads the P1 date resolution; any other key reads the
   *  claim of that name. A document without the claim does not match: unknown is never treated as a match. */
  function matches(d, ground = {}) {
    for (const [k, want] of Object.entries(ground)) {
      if (want == null) continue;
      if (k === "language") { if (![].concat(want).includes(d.lang)) return false; continue; }
      if (k === "atmosphere") { if (![].concat(want).includes(d.atmosphere)) return false; continue; }
      if (k === "year") { const p = d.ground.date_p1?.value; if (!p || p.lo == null) return false; const [lo, hi] = want; if (p.hi < lo || p.lo > hi) return false; continue; }
      const c = d.ground[k]; if (!c || c.value == null || c.value === "unknown") return false;
      if (![].concat(want).includes(c.value)) return false;
    }
    return true;
  }
  const docsMatching = (ground) => docs.filter((d) => matches(d, ground));

  function docsOf(t) {
    const a = Number(t2dOff[t]), n = Number(t2dOff[t + 1]) - a;
    return { docs: readSlice(t2dDocFd, Uint32Array, a, n), counts: readSlice(t2dCntFd, Uint32Array, a, n) };
  }
  const postingsCache = new Map();
  function postingsOf(d) {
    if (postingsCache.has(d.id)) return postingsCache.get(d.id);
    const p = readNpyU32(join(logDir, "postings", d.id + ".npy")); if (postingsCache.size > 64) postingsCache.delete(postingsCache.keys().next().value);
    postingsCache.set(d.id, p); return p;
  }
  const address = (d, start) => `${d.path}#${start}`;

  /** Every use of a word under a ground, in document order: addresses, with the exact total and the scope searched. */
  function usesOf(word, ground = {}, { limit = 100, offset = 0 } = {}) {
    const t = resolveType(word); if (t == null) return { word, head, uses: [], total: 0, null: "never-set", gap: "unheard", scope: "the whole vocabulary of the log" };
    const { docs: ds, counts } = docsOf(t); const uses = []; let total = 0, docsMatched = 0, skipped = offset;
    for (let i = 0; i < ds.length; i++) {
      const d = docs[ds[i]]; if (!matches(d, ground)) continue; docsMatched++; total += counts[i];
      if (uses.length >= limit) continue;
      if (skipped >= counts[i]) { skipped -= counts[i]; continue; }
      const { rows, data } = postingsOf(d);
      for (let r = 0; r < rows && uses.length < limit; r++) if (data[r * 3] === t) {
        if (skipped > 0) { skipped--; continue; }
        uses.push({ doc: d.id, path: d.path, address: d.offsets === "byte" ? address(d, data[r * 3 + 1]) : null, start: data[r * 3 + 1], length: data[r * 3 + 2], offsets: d.offsets, token: r });
      }
    }
    const out = { word, type: t, head, ground, total, docsMatched, uses, scope: `${docsMatched} documents in the ground hold the word` };
    if (!total) Object.assign(out, absence(t, ground));
    return out;
  }

  /** The candidate lexical nodes at an address, with each giver's record: undecided. */
  function nodesAt(path, byteStart) {
    const d = byPath.get(path); if (!d) return { head, null: "unknown", gap: "no_material", scope: `no document at ${path} in this log` };
    const { rows, data } = postingsOf(d); let lo = 0, hi = rows - 1, r = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1, s = data[mid * 3 + 1]; if (s === byteStart) { r = mid; break; } if (s < byteStart) lo = mid + 1; else hi = mid - 1; }
    if (r < 0) return { head, null: "unknown", gap: "no_token_at_address", scope: `${path}#${byteStart}` };
    const t = data[r * 3]; return { head, address: `${path}#${byteStart}`, type: t, surface: typeOf(t), decided: null, candidates: candidatesOf(t) };
  }
  function candidatesOf(t) {
    const out = []; for (let i = Number(candOff[t]); i < Number(candOff[t + 1]); i++)
      out.push({ node: "n_" + candNode[i].toString(16).padStart(16, "0"), lang: langs[candLang[i]], kind: kinds[candKind[i]] });
    return out;
  }

  /** A giver's record for a lexical node: names, senses (with their tags), relations and links, each with its standing. */
  function node(id) {
    let lo = 0, hi = nodesIdx.length - 1, k = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (nodesIdx[mid][0] <= id) { k = mid; lo = mid + 1; } else hi = mid - 1; }
    if (k < 0) return null;
    if (!chunkCache.has(k)) {
      const [, off, len] = nodesIdx[k], buf = Buffer.alloc(len); readSync(nodesFd, buf, 0, len, off);
      const m = new Map(gunzipSync(buf).toString("utf8").split("\n").filter(Boolean).map((l) => { const r = JSON.parse(l); return [r.node, r]; }));
      if (chunkCache.size > 32) chunkCache.delete(chunkCache.keys().next().value); chunkCache.set(k, m);
    }
    return chunkCache.get(k).get(id) ?? null;
  }
  function relations(id) {
    const r = node(id); if (!r) return { head, node: id, null: "unknown", gap: "not_a_giver_node" };
    return { head, node: id, lang: r.lang, lemma: r.lemma, rel: r.rel, links: r.links, givers: r.givers };
  }

  /** Company at a declared reach: the types at hops 1..radius around every use under the ground, with exact counts and the uses read.
   *  The reach is never chosen here: pass `radius` (recorded as the caller's declaration) or measure it with khora's dmdWindow over your
   *  own conclusion. `maxUses` bounds the work and is reported as scope, never hidden. */
  function companyOf(word, ground = {}, { radius, maxUses = Infinity } = {}) {
    if (!Number.isInteger(radius) || radius < 1) throw new TypeError("companyOf: radius is declared by the caller (or measured by dmdWindow), never defaulted");
    const t = resolveType(word); if (t == null) return { word, head, null: "never-set", gap: "unheard" };
    const { docs: ds } = docsOf(t); const counts = new Map(); let usesRead = 0, usesTotal = 0;
    for (let i = 0; i < ds.length; i++) {
      const d = docs[ds[i]]; if (!matches(d, ground)) continue; const { rows, data } = postingsOf(d);
      for (let r = 0; r < rows; r++) if (data[r * 3] === t) {
        usesTotal++; if (usesRead >= maxUses) continue; usesRead++;
        for (let h = 1; h <= radius; h++) for (const q of [r - h, r + h]) if (q >= 0 && q < rows) { const u = data[q * 3]; counts.set(u, (counts.get(u) ?? 0) + 1); }
      }
    }
    const company = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([u, n]) => ({ type: u, surface: typeOf(u), n }));
    return { word, type: t, head, ground, reach: { radius, basis: "declared by the caller" }, usesRead, usesTotal, company,
             scope: usesRead < usesTotal ? `partial: ${usesRead} of ${usesTotal} uses read (maxUses)` : `all ${usesTotal} uses in the ground` };
  }

  /** The date-ordered profile of a word: per dated document, its P1 interval and the word's count. Undated documents are counted, not binned. */
  function along(word, ground = {}) {
    const t = resolveType(word); if (t == null) return { word, head, null: "never-set", gap: "unheard" };
    const { docs: ds, counts } = docsOf(t); const points = []; let undated = 0;
    for (let i = 0; i < ds.length; i++) {
      const d = docs[ds[i]]; if (!matches(d, ground)) continue; const p = d.ground.date_p1?.value;
      if (!p || p.lo == null) { undated += counts[i]; continue; }
      points.push({ lo: p.lo, hi: p.hi, count: counts[i], tokens: d.tokens, doc: d.id, path: d.path });
    }
    points.sort((a, b) => a.lo - b.lo || a.path.localeCompare(b.path));
    return { word, type: t, head, ground, points, undated: { uses: undated, null: undated ? "unknown" : undefined, basis: "documents with no P1 date resolution" } };
  }

  /** The typed null for a word under a ground (THE-NULL-STATES.md), with its scope. */
  function absence(word, ground = {}) {
    const t = resolveType(word); const inGround = docsMatching(ground);
    if (!inGround.length) return { null: "unknown", gap: "no_material", scope: "no document in the log matches the ground", fill: "a document under this ground" };
    if (t == null) return { null: "never-set", gap: "unheard", scope: "the whole log", fill: "one use anywhere" };
    const { docs: ds, counts } = docsOf(t); const inSet = new Set(inGround.map((d) => d.i)); let here = 0, elsewhere = 0, lastYearBefore = null;
    for (let i = 0; i < ds.length; i++) {
      const d = docs[ds[i]]; if (inSet.has(d.i)) { here += counts[i]; continue; } elsewhere += counts[i];
      const p = d.ground.date_p1?.value; if (ground.year && p && p.hi != null && p.hi < ground.year[0]) lastYearBefore = Math.max(lastYearBefore ?? -Infinity, p.hi);
    }
    const scope = `${inGround.length} documents, ${inGround.reduce((a, d) => a + d.tokens, 0)} tokens in the ground`;
    if (here) return { null: null, present: here, scope };
    if (lastYearBefore != null) return { null: "cleared", lastSeenYear: lastYearBefore, scope, fill: "one use in the ground" };
    return { null: "never-set", usesOutsideGround: elsewhere, scope, fill: "one use in the ground" };
  }

  /** The bytes behind an address, from the Zenodotus copy (the reopen gate's check, available to any caller). */
  function reopen(addr, { length = 64, context = 0 } = {}) {
    if (!zenRoot) throw new Error("reopen: pass { zen } (the Zenodotus root this log was built from)");
    const [path, s] = addr.split("#"); const d = byPath.get(path); const start = +s;
    if (!d) return { address: addr, null: "unknown", gap: "no_material", scope: "no document at this path in the log" };
    if (!existsSync(join(zenRoot, path))) return { address: addr, null: "unknown", gap: "source_absent", scope: `${path} is in the log but not under ${zenRoot}` };
    // the file is closed after every read: a long-running caller (the door) reopens thousands of addresses
    const fd = openSync(join(zenRoot, path), "r");
    try {
      const size = statSync(join(zenRoot, path)).size;
      const a = Math.max(0, start - context), b = Math.min(size, start + length + context), buf = Buffer.alloc(Math.max(0, b - a)); if (b > a) readSync(fd, buf, 0, b - a, a);
      return { address: addr, bytes: buf, text: buf.toString("utf8") };
    } finally { closeSync(fd); }
  }

  return { head, manifest, typeId, typeOf, usesOf, nodesAt, candidatesOf, node, relations, companyOf, along, absence, reopen, docs: () => docs, matches };
}
