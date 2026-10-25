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
// Loopback only: it listens on 127.0.0.1 and nowhere else. A bridge (fold-door-cf/ssh-bridge.mjs) carries a Mac's asks to it.
import http from "node:http";
import { openHyperlexicon } from "./traverse.mjs";

export const SCHEMA = "HyperlexiconDoor@1";
const MAX_BODY = 1 << 20, MAX_BATCH = 400, MAX_LIMIT = 5000, MAX_CHARS = 64;
const clamp = (n, lo, hi, d) => (Number.isFinite(+n) ? Math.min(hi, Math.max(lo, Math.floor(+n))) : d);
const refuse = (gap, detail) => ({ refused: true, gap, detail });

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
    default: return refuse("unknown_op", `asks are: uses, company, along, absence, nodes, node, relations, reopen, after`);
  }
}

const send = (res, status, obj) => { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(obj)); };
const safe = (hl, ask) => { try { return answer(hl, ask); } catch (e) { return refuse("ask_failed", String(e?.message ?? e).slice(0, 200)); } };

/** The door's HTTP server over an open hyperlexicon. Exported for the tests (they pass a stand-in `hl`). */
export function door(hl) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/v1/hyperlexicon") {
      let types = null, docs = null; try { types = hl.manifest?.types ?? null; docs = hl.docs ? hl.docs().length : null; } catch {}
      return send(res, 200, { schema: SCHEMA, head: hl.head, types, docs, asks: ["uses", "company", "along", "absence", "nodes", "node", "relations", "reopen", "after"] });
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
  door(hl).listen(port, "127.0.0.1", () => console.log(`${new Date().toISOString()} hyperlexicon door on 127.0.0.1:${port} · head ${hl.head} · opened in ${Date.now() - t0} ms`));
}
