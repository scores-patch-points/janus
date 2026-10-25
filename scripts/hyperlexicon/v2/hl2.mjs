// v2/hl2.mjs — the v2 hyperlexicon's door: the same POST /v1/batch protocol and the same `names` and `context` answers as v1's door
// (native/organs/hyperlexicon/door.mjs), read from v2's tables (V2-PREREG.md). khora's makeHyperlexicon client asks it unchanged.
//   node v2/hl2.mjs --dir <v2 dir> [--port 11451]
// Asks served: names, context, record. The asks that need postings (uses, company, along, after, reopen, nodes, dotted, absence) answer a
// typed gap naming v1 (release v1-fa9add32): v2 holds no postings.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import http from "node:http";

const TAB = "\t";
const readGz = (f) => zlib.gunzipSync(fs.readFileSync(f));

/** A sorted, newline-separated table as one Buffer with its line starts, binary-searched by the first column (the folded surface). */
function sortedTable(file) {
  const buf = readGz(file), starts = [];
  let i = 0;
  while (i < buf.length) { starts.push(i); const j = buf.indexOf(10, i); if (j < 0) break; i = j + 1; }
  const line = (k) => { const e = k + 1 < starts.length ? starts[k + 1] - 1 : buf.length - (buf[buf.length - 1] === 10 ? 1 : 0); return buf.toString("utf8", starts[k], e); };
  const key = (k) => { const t = buf.indexOf(9, starts[k]); return buf.toString("utf8", starts[k], t); };
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);   // the order givers.mjs sorted by: JS string comparison
  const rows = (folded) => {
    let lo = 0, hi = starts.length - 1, at = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1, c = cmp(key(mid), folded); if (c === 0) { at = mid; break; } if (c < 0) lo = mid + 1; else hi = mid - 1; }
    if (at < 0) return [];
    let a = at, b = at;
    while (a > 0 && key(a - 1) === folded) a--;
    while (b + 1 < starts.length && key(b + 1) === folded) b++;
    const out = []; for (let k = a; k <= b; k++) out.push(line(k).split(TAB));
    return out;
  };
  return { rows, lines: starts.length };
}

export function openHyperlexicon2(dir) {
  const head = fs.readFileSync(path.join(dir, "head.sha256"), "utf8").split(/\s/)[0];
  const names = sortedTable(path.join(dir, "givers", "names.tsv.gz"));
  const nodes = new Map();   // node \t giver -> { lemma, pos, tags }
  for (const l of readGz(path.join(dir, "givers", "nodes.tsv.gz")).toString("utf8").split("\n")) {
    if (!l) continue; const [id, lang, lemma, pos, tags, giver] = l.split(TAB);
    nodes.set(`${id}|${giver}`, { id, lang, lemma, pos: pos ? pos.split(",") : [], tags: tags ? tags.split(",") : [], giver });
  }
  const counters = new Map();   // type -> [uses, documents, datedUses, lo, hi]
  const cf = path.join(dir, "counters", "types.tsv.gz");
  if (fs.existsSync(cf)) for (const l of readGz(cf).toString("utf8").split("\n")) { if (!l) continue; const c = l.split(TAB); counters.set(c[0], c.slice(1)); }
  const slots = new Map();      // head word -> record rows of the slot grain
  const rf = path.join(dir, "record", "record.tsv.gz");
  if (fs.existsSync(rf)) for (const l of readGz(rf).toString("utf8").split("\n")) {
    if (!l || !l.startsWith("s" + TAB)) continue; const c = l.split(TAB), h = c[1].split("|", 1)[0];
    (slots.get(h) ?? slots.set(h, []).get(h)).push({ key: c[1], birth: c[2], corroboration: c[3], documents: +c[4], sightings: +c[5], earliest: c[6] === "" ? null : +c[6], latest: c[7] === "" ? null : +c[7] });
  }
  return { head, dir, names, nodes, counters, slots };
}

const refuse = (gap, scope) => ({ null: "unknown", gap, scope });
const V1 = "v2 holds no postings; the hyperlexicon v1 (release v1-fa9add32 of the hyperlexicon repository) serves the asks that read them";
const NEEDS_POSTINGS = ["uses", "company", "along", "absence", "nodes", "node", "relations", "reopen", "after", "dotted"];
const uniq = (a) => [...new Set(a)];

/** The `names` answer: every name the givers list for each surface, and `written` — the nodes whose own names in this language write the
 *  form exactly as asked, case included (the index folds case; the surface column keeps it). */
function namesOf(hl, surfaces, lang) {
  const out = {};
  for (const sf of surfaces) {
    const rows = hl.names.rows(sf.toLowerCase());
    const here = rows.filter((r) => r[2] === lang);
    const written = new Map();
    for (const r of here) {
      if (r[1] !== sf) continue;
      const w = written.get(r[3] + "|" + r[4]) ?? written.set(r[3] + "|" + r[4], { node: r[3], kind: r[4], of: [], pos: [] }).get(r[3] + "|" + r[4]);
      if (r[5]) w.of.push(r[5]); if (r[6]) w.pos.push(r[6]);
    }
    out[sf] = {
      languages: uniq(rows.map((r) => r[2])).length,
      here: uniq(here.map((r) => r[3] + "|" + r[4])).map((k) => { const [node, kind] = k.split("|"); return { node, kind }; }),
      written: [...written.values()].map((w) => ({ ...w, of: uniq(w.of), pos: uniq(w.pos) })),
    };
  }
  return out;
}

export function answer2(hl, ask = {}) {
  const { op } = ask;
  if (op === "names") {
    const surfaces = Array.isArray(ask.surfaces) ? ask.surfaces.filter((w) => typeof w === "string").slice(0, 2000) : null;
    if (!surfaces) return refuse("no_surfaces");
    const lang = typeof ask.lang === "string" ? ask.lang : "en";
    return { head: hl.head, lang, standing: "given · ungrounded · undecided", surfaces: namesOf(hl, surfaces, lang) };
  }
  if (op === "context") {
    const words = Array.isArray(ask.words) ? ask.words.filter((w) => typeof w === "string").slice(0, 200) : null;
    if (!words) return refuse("no_words");
    const ground = ask.ground && typeof ask.ground === "object" ? ask.ground : {};
    const lang = typeof ask.lang === "string" ? ask.lang : ground.language ?? null;
    const out = {};
    for (const w of words) {
      const rows = hl.names.rows(w.toLowerCase()).filter((r) => !lang || r[2] === lang);
      const byNode = new Map();
      for (const r of rows) {
        const k = r[3] + "|" + r[4], c = byNode.get(k) ?? byNode.set(k, { node: r[3], kind: r[4], lang: r[2], lemma: null, givers: [], pos: [], of: [], gloss: [] }).get(k);
        c.givers.push(r[8]); if (r[6]) c.pos.push(r[6]); if (r[5]) c.of.push(r[5]);
        const n = hl.nodes.get(`${r[3]}|${r[8]}`); if (n) { c.lemma = n.lemma; for (const p of n.pos) c.pos.push(p); }
      }
      const cands = [...byNode.values()].map((c) => ({ ...c, givers: uniq(c.givers), pos: uniq(c.pos), of: uniq(c.of) }));
      const k = hl.counters.get(w.toLowerCase());
      const base = k ? { uses: +k[0], documents: +k[1], dated: { uses: +k[2], earliest: k[3] === "" ? null : +k[3], latest: k[4] === "" ? null : +k[4] }, undated: +k[0] - +k[2] }
        : { uses: 0, documents: 0, null: "never-set", gap: "not_counted", scope: "v2 keeps the counters of the types a giver names or a record slot holds; this one is neither (or never occurs)" };
      out[w] = { ...base, candidates: cands.slice(0, 6), candidatesTotal: cands.length, record: (hl.slots.get(w.toLowerCase()) ?? []).slice(0, 20), recordTotal: (hl.slots.get(w.toLowerCase()) ?? []).length };
    }
    return { head: hl.head, ground, lang, words: out };
  }
  if (op === "record") {
    const words = Array.isArray(ask.words) ? ask.words.filter((w) => typeof w === "string").slice(0, 200) : null;
    if (!words) return refuse("no_words");
    return { head: hl.head, words: Object.fromEntries(words.map((w) => [w, hl.slots.get(w.toLowerCase()) ?? []])) };
  }
  if (NEEDS_POSTINGS.includes(op)) return refuse("not_in_v2", V1);
  return refuse("unknown_op", "asks are: names, context, record (v2); " + NEEDS_POSTINGS.join(", ") + " are v1's");
}

const send = (res, status, obj) => { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(obj)); };
export function door2(hl) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/v1/hyperlexicon") return send(res, 200, { schema: "HyperlexiconDoor@2", head: hl.head, names: hl.names.lines, nodes: hl.nodes.size, counters: hl.counters.size, asks: ["names", "context", "record"] });
    if (req.method !== "POST" || !["/v1/ask", "/v1/batch"].includes(url.pathname)) return send(res, 404, { gap: "no_such_door" });
    const chunks = []; let n = 0; for await (const c of req) { n += c.length; if (n > 1 << 20) { req.destroy(); return; } chunks.push(c); }
    let body; try { body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { return send(res, 400, { gap: "body_is_not_json" }); }
    const safe = (a) => { try { return answer2(hl, a); } catch (e) { return refuse("ask_failed", String(e?.message ?? e).slice(0, 200)); } };
    if (url.pathname === "/v1/ask") return send(res, 200, safe(body));
    if (!Array.isArray(body.asks)) return send(res, 400, { gap: "no_asks" });
    return send(res, 200, { head: hl.head, answers: body.asks.slice(0, 64).map(safe) });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
  const dir = arg("dir"), port = +arg("port", 11451);
  if (!dir) { console.error("usage: hl2.mjs --dir <v2 dir> [--port 11451]"); process.exit(2); }
  const t0 = Date.now(), hl = openHyperlexicon2(dir);
  door2(hl).listen(port, "127.0.0.1", () => console.log(`${new Date().toISOString()} hyperlexicon v2 door on 127.0.0.1:${port} · head ${hl.head} · ${hl.names.lines} names, ${hl.nodes.size} nodes, ${hl.counters.size} counters · opened in ${Date.now() - t0} ms`));
}
