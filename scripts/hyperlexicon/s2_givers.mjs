// S2 (INS): a giver's dictionary pack -> giver, name, def, rel and link events, plus a names index (hyperlexicon v1; ported from v0 hl/dict.mjs).
// A giver's row is standing `given`, binding null: khora's licenseStanding classes it `ungrounded` (Wiktionary has no precedence; it licenses nothing).
//   node s2_givers.mjs --pack <file> --giver <name> --version <v> [--vocab <vocab.tsv.gz>]
// --vocab limits the run to entries whose lowercase headword is a corpus type (smoke runs only).
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import { join } from "node:path";
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const ZEN = (process.env.HL_ZEN || new URL("../../../Zenodotus/", import.meta.url).pathname).replace(/\/?$/, "/");
const OUT = process.env.HL_OUT || (process.env.HOME + "/.cache/janus-hyperlexicon/v1");
const { Dictionary } = await import(ZEN + "scripts/wiktionary/lookup.mjs");
const pack = arg("pack"), giver = arg("giver"), version = arg("version");
const sha = (s) => createHash("sha256").update(s).digest("hex");
const nid = (lang, lemma) => "n_" + sha(lang + "\0" + lemma).slice(0, 16);
const KINDS = ["syn", "ant", "hyper", "hypo", "holo", "mero", "derived", "coord"];
const items = (arr) => arr.map((x) => (Array.isArray(x) ? [x[0], x[1] ?? null] : [x, null]));
let VOC = null;
if (arg("vocab")) { VOC = new Set(); for (const l of gunzipSync(readFileSync(arg("vocab"))).toString("utf8").split("\n")) { const t = l.split("\t")[0]; if (t) VOC.add(t); } }
const evDir = join(OUT, "events"), nmDir = join(OUT, "names-index"); mkdirSync(evDir, { recursive: true }); mkdirSync(nmDir, { recursive: true });
class Sink {
  constructor(dir, prefix, ext, per) { this.dir = dir; this.prefix = prefix; this.ext = ext; this.per = per; this.buf = []; this.k = 0; this.total = 0; }
  add(line) { this.buf.push(line); this.total++; if (this.buf.length >= this.per) this.flush(); }
  flush() { if (!this.buf.length) return; writeFileSync(join(this.dir, `${this.prefix}-${String(this.k++).padStart(5, "0")}.${this.ext}.gz`), gzipSync(this.buf.join("\n") + "\n")); this.buf = []; }
}
const ev = new Sink(evDir, `dict-${giver}`, "jsonl", 200000), nm = new Sink(nmDir, `names-${giver}`, "tsv", 2000000);
const counts = { giver: 0, entries: 0, name: 0, def: 0, rel: 0, link: 0 };
const emit = (obj) => { const s = JSON.stringify(obj); ev.add(`{"id":"${sha(s).slice(0, 16)}",${s.slice(1)}`); counts[obj.k]++; };
const packSha = sha(readFileSync(pack));
emit({ k: "giver", name: giver, version, pack_sha256: packSha });
const d = new Dictionary({ pack, learned: "/dev/null", changed: "/dev/null", delta: "/dev/null" });
const nameRow = (surface, lang, node, kind) => nm.add(`${surface.toLowerCase()}\t${lang}\t${node}\t${kind}`);
for (const c of d.manifest.chunks) for (const line of d.loadChunk(c)) {
  const rec = JSON.parse(line), w = rec.w; if (VOC && !VOC.has(w.toLowerCase())) continue;
  const lemmaDone = new Set();
  for (const e of rec.e) {
    counts.entries++; const lang = e.c, node = nid(lang, w), pos = e.p ?? null; let lemma = !(e.s?.length);
    (e.s || []).forEach((s, i) => {
      if (s.of !== undefined) {
        const target = nid(lang, String(s.of));
        emit({ k: "name", node: target, surface: w, lang, kind: "form-of", of: s.of, pos, tags: s.tags ?? [], giver }); nameRow(w, lang, target, "form-of");
      } else {
        lemma = true;
        emit({ k: "def", node, lang, lemma: w, pos, sense: i, g: s.g ?? [], tags: s.tags ?? [], tpl: s.tpl ?? [], gaps: s.gaps ?? 0, giver });
      }
      for (const kind of KINDS) if (Array.isArray(s[kind])) for (const [to, label] of items(s[kind]))
        emit({ k: "rel", rel: kind, from: node, to: nid(lang, String(to)), to_lemma: String(to), label, level: "sense", sense: i, giver, standing: "given", binding: null, tier: "ungrounded" });
    });
    if (lemma && !lemmaDone.has(lang)) { lemmaDone.add(lang); emit({ k: "name", node, surface: w, lang, kind: "lemma", pos, tags: [], giver }); nameRow(w, lang, node, "lemma"); }
    if (e.rel) for (const kind of KINDS) if (Array.isArray(e.rel[kind])) for (const [to, label] of items(e.rel[kind]))
      emit({ k: "rel", rel: kind, from: node, to: nid(lang, String(to)), to_lemma: String(to), label, level: "entry", sense: null, giver, standing: "given", binding: null, tier: "ungrounded" });
    if (Array.isArray(e.t)) for (const t of e.t) if (Array.isArray(t) && t.length >= 2)
      emit({ k: "link", kind: "translation", from: node, to: nid(String(t[0]), String(t[1])), to_lang: t[0], to_lemma: String(t[1]), giver, standing: "given", binding: null, tier: "ungrounded" });
  }
}
ev.flush(); nm.flush();
const summary = { giver, version, packSha256: packSha, ...counts, eventShards: ev.k, nameRows: nm.total };
console.log(JSON.stringify(summary));
writeFileSync(join(OUT, `dict-${giver}.summary.json`), JSON.stringify(summary, null, 1));
