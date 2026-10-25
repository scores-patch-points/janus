// v2/check.mjs — the bars of V2-PREREG.md (with its Amendment 2), scored once the build is done. Each bar prints one JSON line with its
// numbers beside its bar; nothing is adjusted after a result.
//   HL_ZEN=<zen> node v2/check.mjs <Z1|G1|R2|C1|DMD> --dir <v2 dir> --work <work dir> --packs <packs dir> [--khora <native>]
// Seeds are fixed (mulberry32, seed 1). G1 and R2 read the packs through Zenodotus's own reader (Dictionary.resolve), a different path
// from the walk that built v2's tables.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";

const which = process.argv[2];
const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? null : process.argv[i + 1]; };
const DIR = arg("dir"), WORK = arg("work"), PACKS = arg("packs"), ZEN = process.env.HL_ZEN;
const here = path.dirname(new URL(import.meta.url).pathname);
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const sample = (arr, n, seed = 1) => { const r = rng(seed), a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const nid = (lang, lemma) => "n_" + sha(lang + "\0" + lemma).slice(0, 16);
const out = (o) => console.log(JSON.stringify({ bar: which, ...o }));
const { openHyperlexicon2, answer2 } = await import(path.join(here, "hl2.mjs"));

const dicts = async () => {
  const { Dictionary } = await import(path.join(ZEN, "scripts/wiktionary/lookup.mjs"));
  return [["wiktionary-en", "wiktionary-slim-2026-10-01-v3.pack"], ["wiktionary-es", "wiktionary-es-slim-2026-10-01.pack"]].map(([g, f]) => ({ giver: g, d: new Dictionary({ pack: path.join(PACKS, f), learned: "/dev/null", changed: "/dev/null", delta: "/dev/null" }) }));
};
// what the packs give for one exact surface, per language: node -> kind -> { of, pos }, by Dictionary.resolve
function fromPacks(D, sf) {
  const per = new Map();   // lang -> Map(node|kind -> { node, kind, of:Set, pos:Set })
  for (const { d } of D) {
    const r = d.resolve(sf, { learn: false }); if (!r.found) continue;
    for (const e of r.entries) {
      const m = per.get(e.c) ?? per.set(e.c, new Map()).get(e.c), pos = e.p ?? null;
      const add = (node, kind, of) => { const k = node + "|" + kind, x = m.get(k) ?? m.set(k, { node, kind, of: new Set(), pos: new Set() }).get(k); if (of) x.of.add(of); if (pos) x.pos.add(pos); };
      let lemma = !(e.s?.length);
      for (const s of e.s || []) { if (s.of !== undefined) add(nid(e.c, String(s.of)), "form-of", String(s.of)); else lemma = true; }
      if (lemma) add(nid(e.c, sf), "lemma", null);
    }
  }
  return per;
}
const norm = (m) => [...m.values()].map((x) => `${x.node}|${x.kind}|${[...x.of].sort().join(",")}|${[...x.pos].sort().join(",")}`).sort();

if (which === "Z1") {
  let bytes = 0, files = 0;
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else { bytes += fs.statSync(p).size; files++; } } };
  walk(DIR);
  const parts = {}; for (const f of fs.readdirSync(DIR, { withFileTypes: true })) { let b = 0; const w = (p) => { const st = fs.statSync(p); if (st.isDirectory()) fs.readdirSync(p).forEach((x) => w(path.join(p, x))); else b += st.size; }; w(path.join(DIR, f.name)); parts[f.name] = b; }
  out({ bytes, files, parts, barBelow: 1e9, pass: bytes < 1e9 });
} else if (which === "G1") {
  const D = await dicts(), hl = openHyperlexicon2(DIR);
  // the surfaces: headwords and form-of names walked from the packs' own chunks, seeded
  const heads = [];
  for (const { d } of D) for (const c of d.manifest.chunks) for (const line of d.loadChunk(c)) heads.push(JSON.parse(line).w);
  const pick = sample([...new Set(heads)], 2000);
  let ok = 0; const bad = [];
  for (const sf of pick) {
    const per = fromPacks(D, sf); let same = true;
    const langs = new Set([...per.keys()]);
    for (const lang of langs) {
      const a = answer2(hl, { op: "names", surfaces: [sf], lang }).surfaces[sf].written;
      const mine = new Map(a.map((w) => [w.node + "|" + w.kind, { node: w.node, kind: w.kind, of: new Set(w.of), pos: new Set(w.pos) }]));
      if (JSON.stringify(norm(mine)) !== JSON.stringify(norm(per.get(lang)))) { same = false; if (bad.length < 10) bad.push({ sf, lang, v2: norm(mine).slice(0, 3), pack: norm(per.get(lang)).slice(0, 3) }); break; }
    }
    if (same) ok++;
  }
  out({ surfaces: pick.length, equal: ok, bar: "2000 of 2000", pass: ok === pick.length && pick.length === 2000, bad });
} else if (which === "R2") {
  const D = await dicts(), hl = openHyperlexicon2(DIR);
  const types = zlib.gunzipSync(fs.readFileSync(path.join(WORK, "counts-all.tsv.gz"))).toString("utf8").split("\n").filter(Boolean).map((l) => l.split("\t")[0]);
  const en = []; for (const t of sample(types, types.length)) { if (en.length >= 2000) break; if (!/^\p{L}[\p{L}'’-]*$/u.test(t)) continue; const r = D[0].d.resolve(t, { learn: false }); if (r.found && r.entries.some((e) => e.c === "en")) en.push(t); }
  let ok = 0, extras = 0; const bad = [];
  for (const t of en) {
    const per = fromPacks(D, t).get("en") ?? new Map();
    const c = answer2(hl, { op: "context", words: [t], lang: "en" }).words[t];
    // the candidates written exactly as the type; the folded index's other casings are the extras
    const rows = hl.names.rows(t).filter((r) => r[2] === "en");
    const exact = new Map();
    for (const r of rows) if (r[1] === t) { const k = r[3] + "|" + r[4], x = exact.get(k) ?? exact.set(k, { node: r[3], kind: r[4], of: new Set(), pos: new Set() }).get(k); if (r[5]) x.of.add(r[5]); if (r[6]) x.pos.add(r[6]); }
    extras += rows.filter((r) => r[1] !== t).length;
    // parts of speech as the context answer gives them: the names' own, plus the node's (a node record's pos is the lemma entry's)
    const ctxPos = new Map(c.candidates.concat([]).map((x) => [x.node + "|" + x.kind, new Set(x.pos)]));
    const a = [...exact.values()].map((x) => `${x.node}|${x.kind}|${[...x.of].sort().join(",")}|${[...x.pos].sort().join(",")}`).sort();
    if (JSON.stringify(a) === JSON.stringify(norm(per)) && c.candidatesTotal >= exact.size) ok++; else if (bad.length < 10) bad.push({ t, v2: a.slice(0, 3), pack: norm(per).slice(0, 3) });
  }
  out({ types: en.length, equal: ok, caseFoldExtraRows: extras, bar: "2000 of 2000", pass: ok === en.length && en.length === 2000, bad });
} else if (which === "DMD") {
  const { dmdWindow } = await import(path.join(arg("khora"), "kernel/activation.js"));
  const gaps = zlib.gunzipSync(fs.readFileSync(path.join(WORK, "gaps.tsv.gz"))).toString("utf8").split("\n").filter(Boolean).map((l) => l.split("\t"));
  const nDocs = JSON.parse(fs.readFileSync(path.join(DIR, "record", "summary.json"), "utf8")).documents_read;
  const obs = gaps.map(([g, birthToCorr, minGap]) => ({ g, birthToCorr: +birthToCorr, minGap: +minGap }));
  const depths = []; for (let d = 1; d < nDocs; d *= 2) depths.push(d); depths.push(nDocs);
  const r = dmdWindow(obs, (o) => o.length, { candidates: depths, restrict: (o, depth) => o.filter((x) => x.minGap <= depth), equal: (a, b) => a === b });
  const q = (k, p) => { const v = obs.filter((x) => x.g === k).map((x) => x.minGap).sort((a, b) => a - b); return v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] : null; };
  const kept = (depth) => depths.filter((d) => d <= depth || d === depth).map((d) => ({ depth: d, share: +(obs.filter((x) => x.minGap <= d).length / Math.max(1, obs.length)).toFixed(4) }));
  out({ corroborated: obs.length, documents: nDocs, window: r.window, gap: r.gap ?? null, minGapQuantiles: { slot: { p50: q("s", 0.5), p90: q("s", 0.9), p99: q("s", 0.99) }, composition: { p50: q("c", 0.5), p90: q("c", 0.9), p99: q("c", 0.99) } }, keptAtDepth: depths.map((d) => ({ depth: d, share: +(obs.filter((x) => x.minGap <= d).length / Math.max(1, obs.length)).toFixed(4) })), bar: "none (reported)" });
} else { console.error("usage: check.mjs <Z1|G1|R2|DMD> --dir <v2> --work <work> --packs <packs> [--khora <native>]"); process.exit(2); }
