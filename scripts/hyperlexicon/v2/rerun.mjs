// v2/rerun.mjs — the bars that read again (V2-PREREG.md, Amendment 2): W1 (2,000 seeded record witnesses: the document still hashes to its
// ground sha256 and a re-read yields the key at that byte offset) and the re-read part of D1 (50 seeded documents re-read give byte-identical
// sightings once decompressed). Three steps: `prep` writes the lists, then v2/read.mjs reads them into <chk>/<bar>, then `score`.
//   HL_ZEN=<zen> node v2/rerun.mjs prep|score <W1|D1> --dir <v2 dir> --work <work dir> --chk <check dir> [--workers 7]
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";

const [mode, bar] = process.argv.slice(2, 4);
const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const DIR = arg("dir"), WORK = arg("work"), CHK = path.join(arg("chk"), bar), N = +arg("workers", 7), ZEN = process.env.HL_ZEN;
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const sample = (arr, n) => { const r = rng(1), a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
const docs = new Map(JSON.parse(fs.readFileSync(path.join(DIR, "docs.json"), "utf8")).map((d) => [d.id, d]));
const gz = (f) => zlib.gunzipSync(fs.readFileSync(f)).toString("utf8");

if (mode === "prep") {
  fs.rmSync(CHK, { recursive: true, force: true }); fs.mkdirSync(CHK, { recursive: true });
  let ids, expect = null;
  if (bar === "W1") {
    const ws = [];
    for (const l of gz(path.join(DIR, "record", "record.tsv.gz")).split("\n")) {
      if (!l) continue; const c = l.split("\t");
      for (const w of [c[2], c[3]]) { const [doc, at] = w.split("#"); ws.push({ grain: c[0], key: c[1], doc, at: +at }); }
    }
    expect = sample(ws, 2000); ids = [...new Set(expect.map((w) => w.doc))];
  } else {
    ids = sample(fs.readdirSync(path.join(WORK, "sightings")).map((f) => f.slice(0, -7)), 50);
  }
  fs.writeFileSync(path.join(CHK, "expect.json"), JSON.stringify({ expect, ids }));
  ids.sort((a, b) => docs.get(a).bytes - docs.get(b).bytes);
  for (let k = 0; k < N; k++) fs.writeFileSync(path.join(CHK, `list-${k}.tsv`), ids.filter((_, i) => i % N === k).map((id) => `${id}\t${docs.get(id).path}`).join("\n") + "\n");
  console.log(JSON.stringify({ bar, mode, witnesses: expect?.length ?? null, documents: ids.length, workers: N }));
} else {
  const { expect, ids } = JSON.parse(fs.readFileSync(path.join(CHK, "expect.json"), "utf8"));
  const sight = (dir, id) => { const f = path.join(dir, "sightings", id + ".tsv.gz"); return fs.existsSync(f) ? gz(f) : null; };
  if (bar === "W1") {
    const cache = new Map(), hashes = new Map(); let ok = 0; const bad = [];
    for (const w of expect) {
      const d = docs.get(w.doc);
      if (!hashes.has(w.doc)) hashes.set(w.doc, crypto.createHash("sha256").update(fs.readFileSync(path.join(ZEN, d.path))).digest("hex") === d.sha256);
      if (!cache.has(w.doc)) { const t = sight(CHK, w.doc); cache.set(w.doc, t == null ? null : new Set(t.split("\n").filter((l) => l && !l.startsWith("#")).map((l) => { const c = l.split("\t"); return `${c[0]}\t${c[1]}\t${c[2]}`; }))); }
      const set = cache.get(w.doc), found = set?.has(`${w.grain}\t${w.key}\t${w.at}`);
      if (hashes.get(w.doc) && found) ok++; else if (bad.length < 10) bad.push({ ...w, hashed: hashes.get(w.doc), reread: set == null ? "missing" : found });
    }
    console.log(JSON.stringify({ bar, witnesses: expect.length, ok, documents: ids.length, pass: ok === expect.length, bad }));
  } else {
    let same = 0; const bad = [];
    for (const id of ids) { const a = sight(CHK, id), b = sight(WORK, id); if (a != null && a === b) same++; else if (bad.length < 10) bad.push({ id, reread: a == null ? "missing" : "differs" }); }
    console.log(JSON.stringify({ bar: "D1 (re-read part)", documents: ids.length, identical: same, pass: same === ids.length, bad }));
  }
}
