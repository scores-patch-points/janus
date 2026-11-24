// build-grc-lexical-priors.mjs — THREE PRIORS FOR READING ANCIENT GREEK WORDS, each with its giver, licence, pinned source and measured evidence.
//
//   WIKT_PACK=<wiktionary-slim-2026-10-01-v2.pack> PROIEL_DIR=<UD_Ancient_Greek-PROIEL> node scripts/build-grc-lexical-priors.mjs [--out priors]
//
// Written 2026-11-24 for the fold's Greek translation (the verbs reached EOT unglossed: the codec hands a verb form it never saw back as its own lemma, and the dictionary
// files only the lemma). What it makes:
//
//   lexicon-grc-headwords.json     GreekHeadwords@1   the Greek LEMMA pages of the Wiktionary pack, indexed accent-insensitively: plain key -> the pack's own spellings and the
//                                  parts of speech each holds. Why: a lemma candidate made by an ending rule has no accents; the dictionary files the word with them.
//                                  Giver: Wiktionary contributors (English Wiktionary), through the slim pack. CC BY-SA 4.0 (the index is a derivative under the same licence).
//   lemma-rules-grc-verb.json      GreekVerbLemmaRules@1   how an inflected VERB form finds its lemma: the form's ending -> the lemma's ending, in the context of the form's last
//                                  2-6 letters. The rules PROPOSE a candidate; a candidate counts only if the headword index holds it as a verb (the dictionary disposes).
//                                  Giver: UD_Ancient_Greek-PROIEL TRAIN, gold lemmas. CC BY-NC-SA 3.0: the prior carries the treebank's licence (non-commercial).
//   elision-grc.json               GreekElision@1   an elided form (stem + the mark) and the word it stands for, from the gold lemmas. The UD codec's tokenizer cuts the mark off the
//                                  word, so a reader gives the codec the restored word. Giver and licence: as the rules.
//
// EVIDENCE is measured here, on the PROIEL DEV split (held out: the rules learned from TRAIN; the headword index has no treebank in it): of the dev verbs, how many are offered a
// candidate and how many candidates are the gold lemma. Recorded in the rules prior's `evaluation`. Nothing is typed by hand; every figure is a count.
//
// THE LICENCE RULING (priors/NOTICE-ud-priors.md, 2026-10-26): a prior derived from a CC BY-NC-SA treebank is POINTED AT, not committed: built on the machine that uses it from the
// treebank's own files, which is what this script does. The headword index is CC BY-SA and may be committed. Which of the three is committed is the owner's call.
// GETTING THE INPUTS (nothing is downloaded by this script; without them it says so and writes nothing):
//   WIKT_PACK   node <Zenodotus>/scripts/wiktionary/fetch-wiktionary-slim.mjs   (192 MB, sha256-checked against 11-multi-language/wiktionary/manifest.json)
//   PROIEL_DIR  git clone https://github.com/UniversalDependencies/UD_Ancient_Greek-PROIEL   (the commit is recorded in the prior when the directory is a git checkout)
import { readFileSync, writeFileSync, existsSync, statSync, openSync, readSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { brotliDecompressSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = resolve(HERE, "..", arg("--out", "priors"));
const PACK = process.env.WIKT_PACK, PROIEL = process.env.PROIEL_DIR;
const missing = [!PACK || !existsSync(PACK) ? "WIKT_PACK (the Wiktionary slim pack)" : null, !PROIEL || !existsSync(join(PROIEL, "grc_proiel-ud-train.conllu")) ? "PROIEL_DIR (UD_Ancient_Greek-PROIEL, with grc_proiel-ud-train.conllu)" : null].filter(Boolean);
if (missing.length) { console.log(`build-grc-lexical-priors: nothing written. Set ${missing.join(" and ")}. See the header for how to get them; nothing is downloaded here.`); process.exit(0); }

const sha = (b) => createHash("sha256").update(b).digest("hex");
const norm = (w) => String(w ?? "").normalize("NFD").replace(/[̀-ͯͅ]/g, "").toLowerCase().replace(/ς/g, "σ"); // accents, breathings and the final sigma off
const plain = (w) => String(w ?? "").replace(/<[^>]*>/g, "").normalize("NFD").replace(/[̄̆]/g, "").normalize("NFC"); // the pack files lemmas with macrons and breves
const parse = (text) => { const sents = []; let cur = []; for (const l of text.split("\n")) { if (!l.trim()) { if (cur.length) sents.push(cur); cur = []; continue; } if (l[0] === "#") continue; const c = l.split("\t"); if (c.length === 10 && /^\d+$/.test(c[0])) cur.push({ form: c[1], lemma: c[2], upos: c[3] }); } if (cur.length) sents.push(cur); return sents; };
const stamp = new Date().toISOString();

// ── the pack (WSLMPACK: brotli chunks back to back, the manifest as JSON, then u32 index length and the u32 footer 0x57534c31) ─────────────────────────────────────
const fd = openSync(PACK, "r"), size = statSync(PACK).size, foot = Buffer.alloc(8); readSync(fd, foot, 0, 8, size - 8);
if (foot.readUInt32LE(4) !== 0x57534c31) throw new Error(`not a wiktionary-slim pack (bad footer): ${PACK}`);
const len = foot.readUInt32LE(0), ix = Buffer.alloc(len); readSync(fd, ix, 0, len, size - 8 - len); const manifest = JSON.parse(ix.toString("utf8"));
const index = {}; let pages = 0;
for (const c of manifest.chunks) {
  const b = Buffer.alloc(c.bytes); readSync(fd, b, 0, c.bytes, c.off);
  for (const line of brotliDecompressSync(b).toString("utf8").split("\n")) {
    if (!line) continue; const row = JSON.parse(line); const es = (row.e ?? []).filter((e) => e.c === "grc" && !e.redirect); if (!es.length) continue;
    const pos = [...new Set(es.filter((e) => (e.s ?? []).some((s) => !s.of && s.g?.length)).map((e) => e.p))]; if (!pos.length) continue; // a form-of page only is not a lemma
    (index[norm(plain(row.w))] ??= []).push({ w: row.w, pos }); pages++;
  }
}
const packSha = sha(readFileSync(PACK));
writeFileSync(join(OUT, "lexicon-grc-headwords.json"), JSON.stringify({
  schema: "GreekHeadwords@1", language: "grc",
  provenance: { giver: "Wiktionary contributors, English Wiktionary (Ancient Greek lemma pages), through the slim pack " + (manifest.name ?? "wiktionary-slim") + " (Zenodotus scripts/wiktionary)", license: "CC BY-SA 4.0 (Wiktionary text; attribution: Wiktionary contributors; this index is a derivative under the same licence)",
    source: manifest.url ?? "https://en.wiktionary.org", source_sha256: packSha, snapshot: manifest.snapshot ?? null, builder: "janus scripts/build-grc-lexical-priors.mjs", built_at: stamp, lemma_pages: pages, plain_keys: Object.keys(index).length,
    note: "a page that is only a form-of pointer is not a lemma and is left out; a plain key keeps every spelling the pack files under it, with the parts of speech each holds (ambiguity kept)" },
  index }));

// ── the rules and the elisions, from the TRAIN gold; evidence on DEV ────────────────────────────────────────────────────────────────────────────────────────────
const trainRaw = readFileSync(join(PROIEL, "grc_proiel-ud-train.conllu"), "utf8"), devPath = join(PROIEL, "grc_proiel-ud-dev.conllu");
let commit = null; try { commit = execFileSync("git", ["-C", PROIEL, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { /* not a git checkout */ }
const table = {}, used = { n: 0 }, el = new Map();
for (const s of parse(trainRaw)) for (const t of s) {
  if (/’$/u.test(t.form) && t.lemma !== t.form) { const m = el.get(t.form.normalize("NFC")) ?? new Map(), v = `${t.lemma}|${t.upos}`; m.set(v, (m.get(v) ?? 0) + 1); el.set(t.form.normalize("NFC"), m); } // regex-ok: the elision mark is a print character closing a token
  if (!/^(VERB|AUX)$/.test(t.upos)) continue; const a = norm(t.form), b = norm(t.lemma); if (!a || !b || a === b || /[^\p{L}]/u.test(a)) continue;
  let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++; const fs = a.slice(p), ls = b.slice(p); if (fs.length > 6) continue; used.n++;
  for (let k = Math.max(2, fs.length); k <= 6; k++) { if (a.length < k) break; const key = a.slice(-k), T = `${fs}>${ls}`; ((table[key] ??= {})[T] = (table[key][T] ?? 0) + 1); }
}
const rules = {}; for (const [k, m] of Object.entries(table)) { const tot = Object.values(m).reduce((x, y) => x + y, 0); if (tot < 3) continue; rules[k] = Object.entries(m).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([T, n]) => ({ T, n, share: +(n / tot).toFixed(2) })); }
const verbHeads = (k) => (index[k] ?? []).filter((h) => h.pos.includes("verb")).map((h) => h.w);
const lemmas = (form) => {
  const f = norm(form), out = [], push = (xs) => { for (const x of xs) if (!out.includes(x)) out.push(x); };
  const byRules = (g) => { for (let k = 6; k >= 2 && !out.length; k--) { if (g.length < k) continue; for (const { T } of rules[g.slice(-k)] ?? []) { const [fs, ls] = T.split(">"); if (g.endsWith(fs)) push(verbHeads(g.slice(0, g.length - fs.length) + ls)); } } };
  push(verbHeads(f)); byRules(f);
  if (!out.length && f.length > 4 && f.startsWith("ε")) byRules(f.slice(1)); // an augmented past: the form without its augment (the same step lib/lemmatize.mjs takes in the fold's translator)
  return out;
};
let dev = null;
if (existsSync(devPath)) { const d = { verbs: 0, offered: 0, gold: 0 }; for (const s of parse(readFileSync(devPath, "utf8"))) for (const t of s) if (/^(VERB|AUX)$/.test(t.upos)) { d.verbs++; const c = lemmas(t.form); if (c.length) d.offered++; if (c.some((x) => norm(x) === norm(t.lemma))) d.gold++; } dev = { split: "UD_Ancient_Greek-PROIEL dev (held out: the rules learned from train, the headword index from the dictionary)", verbs: d.verbs, offered_a_candidate_pct: +(100 * d.offered / d.verbs).toFixed(1), candidate_is_gold_lemma_pct: +(100 * d.gold / d.verbs).toFixed(1), status: "exploratory" }; }
const giver = "UD_Ancient_Greek-PROIEL (Haug et al., University of Oslo; github.com/UniversalDependencies/UD_Ancient_Greek-PROIEL), train split, gold lemmas", licence = "CC BY-NC-SA 3.0: a prior derived from this treebank carries its licence (non-commercial); pointed at, not committed (priors/NOTICE-ud-priors.md)";
const prov = { giver, license: licence, source: "https://github.com/UniversalDependencies/UD_Ancient_Greek-PROIEL", source_file: "grc_proiel-ud-train.conllu", source_sha256: sha(trainRaw), source_commit: commit, builder: "janus scripts/build-grc-lexical-priors.mjs", built_at: stamp };
writeFileSync(join(OUT, "lemma-rules-grc-verb.json"), JSON.stringify({ schema: "GreekVerbLemmaRules@1", language: "grc", provenance: { ...prov, tokens_used: used.n, contexts: Object.keys(rules).length, note: "the rules propose; a candidate is accepted only if lexicon-grc-headwords.json holds it as a verb. A form no rule resolves is a typed gap, never a guess (middle and contract verbs, reduplicated and irregular perfects are the known misses)." }, evaluation: dev, rules }));
const table2 = {}; for (const [k, m] of el) { const tot = [...m.values()].reduce((a, b) => a + b, 0), [v, n] = [...m].sort((a, b) => b[1] - a[1])[0]; if (n / tot >= 0.8 && tot >= 2) { const [lemma, upos] = v.split("|"); table2[k] = { lemma, upos, n: tot, share: +(n / tot).toFixed(2) }; } }
writeFileSync(join(OUT, "elision-grc.json"), JSON.stringify({ schema: "GreekElision@1", language: "grc", provenance: { ...prov, entries: Object.keys(table2).length, note: "only elisions the gold resolves the same way at least 0.8 of the time, seen at least twice" }, table: table2 }));
console.log(`lexicon-grc-headwords.json ${pages} lemma pages; lemma-rules-grc-verb.json ${Object.keys(rules).length} contexts (${used.n} verb tokens)${dev ? `, dev: ${dev.offered_a_candidate_pct}% offered, ${dev.candidate_is_gold_lemma_pct}% gold` : ""}; elision-grc.json ${Object.keys(table2).length} forms → ${OUT}`);
