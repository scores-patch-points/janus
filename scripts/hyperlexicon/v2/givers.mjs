// v2/givers.mjs — the givers' relational structure (V2-PREREG.md part 1): each pack walked as v1's S2 walks it, keeping every name AS
// WRITTEN, every relation between nodes, every translation link and per node its lemma, parts of speech and the tags its senses carry.
// No glosses: a definition is the giver's content and stays in the giver's pack. Node ids are v1's, so v1 and v2 name a node alike.
//   node v2/givers.mjs --out <v2 dir> --pack <file> --giver <name> --version <v> [--pack … --giver … --version …]
// Env: HL_ZEN (Zenodotus root, for its pack reader scripts/wiktionary/lookup.mjs). Writes <out>/givers/, every table sorted (gzip,
// mtime 0: a rebuild is byte-identical):
//   names.tsv.gz  lower(surface) \t surface \t lang \t node \t kind \t of \t pos \t tags \t giver      (sorted by the folded surface)
//   nodes.tsv.gz  node \t lang \t lemma \t pos,… \t tags,… \t giver
//   rels.tsv.gz   from \t rel \t to \t to_lemma \t level \t giver
//   links.tsv.gz  from \t to_lang \t to_lemma \t to \t giver
//   givers.json   each giver's name, version, pack sha256 and counts
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const all = (k) => process.argv.flatMap((x, i) => (x === `--${k}` ? [process.argv[i + 1]] : []));
const OUT = all("out")[0], PACKS = all("pack"), GIVERS = all("giver"), VERSIONS = all("version");
const ZEN = (process.env.HL_ZEN || "").replace(/\/?$/, "/");
if (!OUT || !PACKS.length || PACKS.length !== GIVERS.length || PACKS.length !== VERSIONS.length || !process.env.HL_ZEN) {
  console.error("usage: HL_ZEN=<zen> node v2/givers.mjs --out <dir> (--pack <file> --giver <name> --version <v>)+"); process.exit(2);
}
const { Dictionary } = await import(ZEN + "scripts/wiktionary/lookup.mjs");
const sha = (s) => createHash("sha256").update(s).digest("hex");
const nid = (lang, lemma) => "n_" + sha(lang + "\0" + lemma).slice(0, 16);           // v1's s2_givers.mjs rule
const KINDS = ["syn", "ant", "hyper", "hypo", "holo", "mero", "derived", "coord"];       // v1's
const items = (arr) => arr.map((x) => (Array.isArray(x) ? [x[0], x[1] ?? null] : [x, null]));
const f = (v) => String(v ?? "").replace(/[\t\n\r]/g, " ");
const names = [], rels = [], links = [], nodes = new Map(), givers = [];
for (let g = 0; g < PACKS.length; g++) {
  const pack = PACKS[g], giver = GIVERS[g], version = VERSIONS[g];
  const counts = { entries: 0, names: 0, rels: 0, links: 0 };
  const d = new Dictionary({ pack, learned: "/dev/null", changed: "/dev/null", delta: "/dev/null" });
  const node = (lang, lemma) => { const id = nid(lang, lemma), k = `${id}\t${giver}`; let n = nodes.get(k); if (!n) nodes.set(k, (n = { id, lang, lemma, pos: new Set(), tags: new Set(), giver })); return n; };
  for (const c of d.manifest.chunks) for (const line of d.loadChunk(c)) {
    const rec = JSON.parse(line), w = rec.w;
    const lemmaDone = new Set();
    for (const e of rec.e) {
      counts.entries++;
      const lang = e.c, pos = e.p ?? null; let lemma = !(e.s?.length);
      (e.s || []).forEach((s) => {
        if (s.of !== undefined) {
          const target = nid(lang, String(s.of));
          names.push([w.toLowerCase(), w, lang, target, "form-of", String(s.of), pos, (s.tags ?? []).join(","), giver]); counts.names++;
        } else {
          lemma = true;
          const n = node(lang, w); if (pos) n.pos.add(pos); for (const t of s.tags ?? []) n.tags.add(t);
        }
        for (const kind of KINDS) if (Array.isArray(s[kind])) for (const [to] of items(s[kind])) { rels.push([nid(lang, w), kind, nid(lang, String(to)), String(to), "sense", giver]); counts.rels++; }
      });
      if (lemma && !lemmaDone.has(lang)) {
        lemmaDone.add(lang);
        names.push([w.toLowerCase(), w, lang, nid(lang, w), "lemma", "", pos, "", giver]); counts.names++;
        const n = node(lang, w); if (pos) n.pos.add(pos);
      }
      if (e.rel) for (const kind of KINDS) if (Array.isArray(e.rel[kind])) for (const [to] of items(e.rel[kind])) { rels.push([nid(lang, w), kind, nid(lang, String(to)), String(to), "entry", giver]); counts.rels++; }
      if (Array.isArray(e.t)) for (const t of e.t) if (Array.isArray(t) && t.length >= 2) { links.push([nid(lang, w), String(t[0]), String(t[1]), nid(String(t[0]), String(t[1])), giver]); counts.links++; }
    }
  }
  givers.push({ giver, version, packSha256: sha(readFileSync(pack)), ...counts });
  console.log(JSON.stringify(givers.at(-1)));
}
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const rowsCmp = (a, b) => { for (let i = 0; i < a.length; i++) { const c = cmp(String(a[i] ?? ""), String(b[i] ?? "")); if (c) return c; } return 0; };
const write = (name, rows) => {
  rows.sort(rowsCmp);
  const lines = []; let last = null;
  for (const r of rows) { const l = r.map(f).join("\t"); if (l !== last) lines.push(l); last = l; }   // a row the walk met twice is one row
  writeFileSync(join(OUT, "givers", name), gzipSync(lines.join("\n") + "\n", { level: 9 }));
  return lines.length;
};
mkdirSync(join(OUT, "givers"), { recursive: true });
const out = {
  names: write("names.tsv.gz", names),
  nodes: write("nodes.tsv.gz", [...nodes.values()].map((n) => [n.id, n.lang, n.lemma, [...n.pos].sort().join(","), [...n.tags].sort().join(","), n.giver])),
  rels: write("rels.tsv.gz", rels),
  links: write("links.tsv.gz", links),
};
writeFileSync(join(OUT, "givers", "givers.json"), JSON.stringify({ schema: "HyperlexiconGivers@2", givers, rows: out, glosses: "not held: each giver's definitions stay in its pack" }, null, 1));
console.log(JSON.stringify({ rows: out }));
