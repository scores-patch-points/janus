// door.mjs — the hyperlexicon's door: janus's traversal API (traverse.mjs) over HTTP on one machine's loopback, so a reader that
// cannot hold the 12 GB log asks it for what it needs. It answers exactly what traverse.mjs answers — every answer keeps its
// addresses and the log's head — and adds nothing: no decision, no ranking, no default ground, no reach it was not given.
//   node native/organs/hyperlexicon/door.mjs --log <logDir> --zen <zenodotusRoot> [--port 11450]
//   GET  /v1/hyperlexicon                          → { schema: "HyperlexiconDoor@1", head, types, docs, asks }   (the handshake)
//   POST /v1/ask   { op, ...args }                 → one answer
//   POST /v1/batch { asks: [{ op, ...args }, ...] } → { head, answers: [...] }, in order (a bridge pays per request, not per ask)
// The asks, each one traverse.mjs's own call:
//   uses     { word, ground, limit, offset }   usesOf
//   company  { word, ground, radius, maxUses } companyOf — the radius is the caller's declaration; an ask without one is refused
//   along    { word, ground }                  along
//   absence  { word, ground }                  absence
//   nodes    { path, byte }                    nodesAt
//   node     { id }                            node
//   relations{ id }                            relations
//   reopen   { address, length, context }      reopen — the text, not the bytes
//   after    { word, ground, limit, offset, chars }
//            usesOf, then each use's `chars` characters straight after it (reopen with the use's own length): what the material
//            writes next to a word, read off its bytes. An observation with its address, not a judgement about it.
//   dotted   { words, lang }                 the S6 dotted share (scripts/hyperlexicon/s6_dotted.py, <log>/use/dotted.tsv.gz): per word,
//            its uses in the language (n), those written with a period straight after (d), and what followed the period. Counts,
//            exact over the whole log; the reader's rule (DOTTED-PREREG.md, Rule H) decides, not the door.
//   names    { surfaces, lang }               the givers' names for each written form, from the names index: for each surface, every
//            (language, node, kind) a giver lists it under, and — for the asked language — the node's record (lemma, part of speech,
//            what it is a form of, the giver), and `written`: the nodes whose own names write the form exactly as asked, case
//            included (the index folds case; DOTTED-PREREG-4.md). Candidates only: a name licenses nothing until the reader's rule takes it.
//   context  { words, ground }                a word's context in the ledger under a ground: its uses and the documents holding them,
//            the dated span of those documents (P1 intervals: earliest, latest, uses dated and undated), and the givers' candidate
//            nodes for it in the ground's language. The record of where and when a word is used, not a reading of it.
// Loopback only: it listens on 127.0.0.1 and nowhere else. A bridge (fold-door-cf/ssh-bridge.mjs) carries a Mac's asks to it.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { openHyperlexicon } from "./traverse.mjs";

export const SCHEMA = "HyperlexiconDoor@1";
const MAX_BODY = 1 << 20, MAX_BATCH = 400, MAX_LIMIT = 5000, MAX_CHARS = 64;
const clamp = (n, lo, hi, d) => (Number.isFinite(+n) ? Math.min(hi, Math.max(lo, Math.floor(+n))) : d);
const refuse = (gap, detail) => ({ refused: true, gap, detail });

/** S6's dotted-share table for one language, read once from <log>/use/dotted.tsv.gz: word -> its counts. Null when S6 has not run. */
export function dottedTable(useDir, lang) {
  const file = path.join(useDir, "dotted.tsv.gz"); if (!fs.existsSync(file)) return null;
  const lines = zlib.gunzipSync(fs.readFileSync(file)).toString("utf8").split("\n");
  const cols = lines[0].split("\t"), at = Object.fromEntries(cols.map((c, i) => [c, i])), table = new Map();
  for (let i = 1; i < lines.length; i++) {
    const r = lines[i].split("\t"); if (r.length < cols.length || r[at.lang] !== lang) continue;
    table.set(r[at.surface], Object.fromEntries(cols.slice(3).map((c) => [c, +r[at[c]]])));
  }
  const man = path.join(useDir, "dotted.manifest.json");
  return { table, manifest: fs.existsSync(man) ? JSON.parse(fs.readFileSync(man, "utf8")) : null };
}

/** The givers' names index, read once: surface -> [[lang, node, kind], ...] for the surfaces `keep` admits (default: those holding a
 *  period — what a reader's cut asks about). The full index is 4.5M+ names; a door holds only what its asks reach. */
export function namesIndex(dir, keep = (surface) => surface.includes(".")) {
  const out = new Map(); if (!fs.existsSync(dir)) return null;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".tsv.gz")).sort()) {
    const text = zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString("utf8");
    let i = 0;
    while (i < text.length) {
      let j = text.indexOf("\n", i); if (j < 0) j = text.length;
      const tab = text.indexOf("\t", i);
      if (tab > i && tab < j) {
        const surface = text.slice(i, tab);
        if (keep(surface)) { const [, lang, node, kind] = text.slice(i, j).split("\t"); (out.get(surface) ?? out.set(surface, []).get(surface)).push([lang, node, kind]); }
      }
      i = j + 1;
    }
  }
  return out;
}

const brief = (r) => r && { node: r.node, lemma: r.lemma ?? null, givers: r.givers ?? [], pos: [...new Set([...(r.names ?? []).map((n) => n.pos), ...(r.senses ?? []).map((x) => x.pos)].filter(Boolean))],
  of: [...new Set((r.names ?? []).map((n) => n.of).filter(Boolean))], gloss: (r.senses ?? []).map((x) => (Array.isArray(x.g) ? x.g[x.g.length - 1] : null)).filter(Boolean).slice(0, 2) };

/** One ask against an open hyperlexicon (`hl`, traverse.mjs::openHyperlexicon's object). Exported for the tests. */
export function answer(hl, ask = {}) {
  const { op } = ask, ground = ask.ground && typeof ask.ground === "object" ? ask.ground : {};
  const word = typeof ask.word === "string" || typeof ask.word === "number" ? ask.word : null;
  switch (op) {
    case "uses": if (word == null) return refuse("no_word"); return hl.usesOf(word, ground, { limit: clamp(ask.limit, 0, MAX_LIMIT, 100), offset: clamp(ask.offset, 0, 2 ** 31, 0) });
    case "company": {
      if (word == null) return refuse("no_word");
      if (!Number.isFinite(+ask.radius)) return refuse("no_radius", "company is read at a reach the caller declares (radius); the door assumes none");
      return hl.companyOf(word, ground, { radius: clamp(ask.radius, 1, 50, 1), ...(ask.maxUses != null ? { maxUses: clamp(ask.maxUses, 1, 1e7, 1e7) } : {}) });
    }
    case "along": if (word == null) return refuse("no_word"); return hl.along(word, ground);
    case "absence": if (word == null) return refuse("no_word"); return hl.absence(word, ground);
    case "nodes": if (typeof ask.path !== "string") return refuse("no_path"); return hl.nodesAt(ask.path, clamp(ask.byte, 0, 2 ** 40, 0));
    case "node": if (typeof ask.id !== "string") return refuse("no_id"); return hl.node(ask.id) ?? { null: "unknown", gap: "not_a_giver_node", node: ask.id, head: hl.head };
    case "relations": if (typeof ask.id !== "string") return refuse("no_id"); return hl.relations(ask.id);
    case "reopen": {
      if (typeof ask.address !== "string") return refuse("no_address");
      const r = hl.reopen(ask.address, { length: clamp(ask.length, 0, 4096, 64), context: clamp(ask.context, 0, 512, 0) });
      const { bytes, ...rest } = r; return { ...rest, head: hl.head };
    }
    case "after": {
      if (word == null) return refuse("no_word");
      const chars = clamp(ask.chars, 1, MAX_CHARS, 8);
      const u = hl.usesOf(word, ground, { limit: clamp(ask.limit, 0, MAX_LIMIT, 100), offset: clamp(ask.offset, 0, 2 ** 31, 0) });
      const after = u.uses.map((x) => {
        if (!x.address) return { address: null, gap: "code_point_offsets", doc: x.doc };
        // the bytes from the use's end: up to 4 bytes per character, cut back to `chars` characters
        const r = hl.reopen(`${x.path}#${x.start + x.length}`, { length: chars * 4 });
        return r.text != null ? { address: x.address, next: [...r.text].slice(0, chars).join("") } : { address: x.address, gap: r.gap };
      });
      const { uses, ...rest } = u; return { ...rest, chars, after };
    }
    case "dotted": {
      const words = Array.isArray(ask.words) ? ask.words.filter((w) => typeof w === "string").slice(0, 2000) : null;
      if (!words) return refuse("no_words");
      const lang = typeof ask.lang === "string" ? ask.lang : "en";
      const T = hl.dotted ? hl.dotted(lang) : null;
      if (!T) return { head: hl.head, null: "unknown", gap: "no_dotted_share", scope: "S6 (s6_dotted.py) has not run on this log" };
      const out = {};
      for (const w of words) {
        const k = String(w).toLowerCase().replace(/\.$/, ""), row = T.table.get(k);
        // a word never written with a period has no row: its uses in the language are L1's count, and d is 0
        out[w] = row ?? { n: hl.usesOf(k, { language: lang }, { limit: 0 }).total, d: 0 };
      }
      return { head: hl.head, lang, stage: T.manifest && { s6_sha256: T.manifest.script_sha256, compiled_from_head: T.manifest.compiled_from_head }, words: out };
    }
    case "names": {
      const surfaces = Array.isArray(ask.surfaces) ? ask.surfaces.filter((w) => typeof w === "string").slice(0, 2000) : null;
      if (!surfaces) return refuse("no_surfaces");
      const lang = typeof ask.lang === "string" ? ask.lang : "en";
      const N = hl.names ? hl.names() : null;
      if (!N) return { head: hl.head, null: "unknown", gap: "no_names_index", scope: "the log has no names-index beside it" };
      const out = {};
      for (const sf of surfaces) {
        const rows = N.get(sf.toLowerCase()) ?? [];          // the index keeps surfaces lower-cased (s2_givers.mjs::nameRow)
        const here = rows.filter(([l]) => l === lang);
        // as written: the nodes whose own names in this language write the form exactly, case included (the index folds case)
        const written = [];
        for (const [, node, kind] of here) {
          const exact = (hl.node(node)?.names ?? []).filter((n) => n.lang === lang && n.surface === sf);
          if (exact.length) written.push({ node, kind, of: [...new Set(exact.map((n) => n.of).filter(Boolean))], pos: [...new Set(exact.map((n) => n.pos).filter(Boolean))] });
        }
        out[sf] = { languages: [...new Set(rows.map(([l]) => l))].length, here: here.map(([, node, kind]) => ({ node, kind, ...brief(hl.node(node)) })), written };
      }
      return { head: hl.head, lang, standing: "given · ungrounded · undecided", surfaces: out };
    }
    case "context": {
      const words = Array.isArray(ask.words) ? ask.words.filter((w) => typeof w === "string").slice(0, 200) : null;
      if (!words) return refuse("no_words");
      const out = {};
      for (const w of words) {
        const u = hl.usesOf(w, ground, { limit: 0 });
        if (!u.total) { out[w] = { uses: 0, null: u.null ?? "never-set", gap: u.gap ?? null, scope: u.scope }; continue; }
        const a = hl.along(w, ground); let dated = 0, lo = null, hi = null;
        for (const p of a.points) { dated += p.count; lo = lo == null ? p.lo : Math.min(lo, p.lo); hi = hi == null ? p.hi : Math.max(hi, p.hi); }
        const lang = ground.language ?? null;
        const cands = hl.candidatesOf(u.type).filter((c) => !lang || c.lang === lang);
        out[w] = { uses: u.total, documents: u.docsMatched, dated: { uses: dated, earliest: lo, latest: hi, documents: a.points.length }, undated: a.undated.uses,
          candidates: cands.slice(0, 6).map((c) => ({ kind: c.kind, ...brief(hl.node(c.node)) })), candidatesTotal: cands.length };
      }
      return { head: hl.head, ground, words: out };
    }
    default: return refuse("unknown_op", `asks are: uses, company, along, absence, nodes, node, relations, reopen, after, dotted, names, context`);
  }
}

const send = (res, status, obj) => { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(obj)); };
const safe = (hl, ask) => { try { return answer(hl, ask); } catch (e) { return refuse("ask_failed", String(e?.message ?? e).slice(0, 200)); } };

/** The door's HTTP server over an open hyperlexicon. Exported for the tests (they pass a stand-in `hl`). */
export function door(hl) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/v1/hyperlexicon") {
      let types = null, docs = null; try { types = hl.manifest?.counts?.types ?? hl.manifest?.types ?? null; docs = hl.docs ? hl.docs().length : null; } catch {}
      return send(res, 200, { schema: SCHEMA, head: hl.head, types, docs, asks: ["uses", "company", "along", "absence", "nodes", "node", "relations", "reopen", "after", "dotted", "names", "context"] });
    }
    if (req.method !== "POST" || !["/v1/ask", "/v1/batch"].includes(url.pathname)) return send(res, 404, { gap: "no_such_door", paths: ["GET /v1/hyperlexicon", "POST /v1/ask", "POST /v1/batch"] });
    const chunks = []; let n = 0;
    for await (const c of req) { n += c.length; if (n > MAX_BODY) { req.destroy(); return; } chunks.push(c); }
    let body; try { body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { return send(res, 400, { gap: "body_is_not_json" }); }
    if (url.pathname === "/v1/ask") return send(res, 200, safe(hl, body));
    const asks = Array.isArray(body.asks) ? body.asks : null;
    if (!asks) return send(res, 400, { gap: "no_asks" });
    if (asks.length > MAX_BATCH) return send(res, 413, { gap: "too_many_asks", max: MAX_BATCH });
    return send(res, 200, { head: hl.head, answers: asks.map((a) => safe(hl, a)) });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
  const log = arg("log"), zen = arg("zen"), port = +arg("port", 11450);
  if (!log || !zen) { console.error("usage: door.mjs --log <logDir> --zen <zenodotusRoot> [--port 11450]"); process.exit(2); }
  const t0 = Date.now(), hl = openHyperlexicon(log, { zen });
  const tables = new Map();
  hl.dotted = (lang) => { if (!tables.has(lang)) tables.set(lang, dottedTable(path.join(log, "use"), lang)); return tables.get(lang); };
  let names; hl.names = () => (names === undefined ? (names = namesIndex(path.join(log, "names-index"))) : names);
  door(hl).listen(port, "127.0.0.1", () => console.log(`${new Date().toISOString()} hyperlexicon door on 127.0.0.1:${port} · head ${hl.head} · opened in ${Date.now() - t0} ms`));
}
