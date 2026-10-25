// v2/read.mjs — the record stage's reading (V2-PREREG.md part 3): khora's reader hears each English document whole, and its sightings
// are written per document, so the reading is resumable and every document's sightings can be re-derived byte for byte (bar D1).
//   node v2/read.mjs --khora <khora native dir> --list <file of "docid\tpath" lines> --work <dir>
// Env: HL_ZEN (Zenodotus root), KHORA_PRIORS_DIR (janus priors). A document whose sightings file exists is skipped.
// Per document, <work>/sightings/<docid>.tsv.gz holds, sorted:
//   s \t <head word>|<label>|<end1|end2> \t <first byte offset> \t <sightings>      a slot: a word, the label, the end it fills
//   c \t <label:end>\0<label:end>       \t <byte offset>       \t 1                 a composition: two (label, end) pairs sharing a head
// A byte offset is into the Zenodotus file (frontmatter included), at the start of the arrangement's first span: the composition's is
// where its second pair is first heard. The head word of an end is its last word, lower-cased (English's head-final noun phrase:
// a declared English-scope rule).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? null : process.argv[i + 1]; };
const KH = arg("khora"), LIST = arg("list"), WORK = arg("work");
const ZEN = process.env.HL_ZEN;
if (!KH || !LIST || !WORK || !ZEN) { console.error("usage: HL_ZEN=<zen> node v2/read.mjs --khora <native> --list <docs> --work <dir>"); process.exit(2); }
const { readDocument } = await import(path.join(KH, "reading.js"));
const OUT = path.join(WORK, "sightings"); fs.mkdirSync(OUT, { recursive: true });
const norm = (s) => String(s).toLowerCase().replace(/[\t\n\r\0|]/g, " ").replace(/\s+/g, " ").trim();
const head = (s) => { const w = String(s).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu); return w ? w[w.length - 1] : null; };

for (const line of fs.readFileSync(LIST, "utf8").split("\n")) {
  if (!line) continue;
  const [id, rel] = line.split("\t");
  const out = path.join(OUT, `${id}.tsv.gz`);
  if (fs.existsSync(out)) continue;
  const raw = fs.readFileSync(path.join(ZEN, rel));
  let text = raw.toString("utf8");
  const fm = text.match(/^---\n[\s\S]*?\n---\n/);
  const fmBytes = fm ? Buffer.byteLength(fm[0]) : 0;
  if (fm) text = text.slice(fm[0].length);
  const t0 = Date.now();
  let w = null;
  try { w = await readDocument(text, { language: "en", lexicon: false, address: rel }); } catch (e) { w = { error: String(e?.message ?? e).slice(0, 200), edges: [] }; }
  // UTF-16 index in the text -> byte offset in the file, walked once over the sorted starts
  const starts = [...new Set((w.edges ?? []).map((e) => e.spans?.[0]?.start).filter((x) => Number.isInteger(x)))].sort((a, b) => a - b);
  const byteAt = new Map(); let ci = 0, bi = fmBytes;
  for (const s of starts) { bi += Buffer.byteLength(text.slice(ci, s)); ci = s; byteAt.set(s, bi); }
  const slots = new Map(), pairsByHead = new Map();
  for (const e of w.edges ?? []) {
    if (!e.end1 || !e.label || !e.end2) continue;
    const at = byteAt.get(e.spans?.[0]?.start) ?? fmBytes, label = norm(e.label);
    if (!label) continue;
    for (const [end, role] of [[e.end1, "end1"], [e.end2, "end2"]]) {
      const h = head(end); if (!h) continue;
      const key = `${norm(h)}|${label}|${role}`;
      const s = slots.get(key); if (s) { s.n++; if (at < s.at) s.at = at; } else slots.set(key, { at, n: 1 });
      const ps = pairsByHead.get(h) ?? pairsByHead.set(h, new Map()).get(h);
      const p = `${label}:${role}`; if (!ps.has(p) || at < ps.get(p)) ps.set(p, at);
    }
  }
  const comps = new Map();
  for (const ps of pairsByHead.values()) {
    const u = [...ps.keys()].sort();
    for (let i = 0; i < u.length; i++) for (let j = i + 1; j < u.length; j++) {
      const key = `${u[i]}\u0000${u[j]}`, at = Math.max(ps.get(u[i]), ps.get(u[j]));
      if (!comps.has(key) || at < comps.get(key)) comps.set(key, at);
    }
  }
  const rows = [...[...slots].map(([k, v]) => `s\t${k}\t${v.at}\t${v.n}`), ...[...comps].map(([k, at]) => `c\t${k}\t${at}\t1`)].sort();
  const meta = JSON.stringify({ id, path: rel, ms: Date.now() - t0, edges: (w.edges ?? []).length, error: w.error ?? null, skipped: w.skipped ?? null });
  fs.writeFileSync(out + ".tmp", zlib.gzipSync(`#${meta}\n` + rows.join("\n") + (rows.length ? "\n" : "")));
  fs.renameSync(out + ".tmp", out);
  console.log(meta);
}
